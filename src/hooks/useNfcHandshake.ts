import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { HCESession, NFCTagType4, NFCTagType4NDEFContentType } from 'react-native-hce'
import NfcManager, { Ndef, NfcEvents } from 'react-native-nfc-manager'
import { postHandshakeTweet, type XAuthCredentials } from '../../services/xTweetService'
import { useHandshakeStore } from '../store/handshakeStore'
import type { NfcHandshakeTagEvent, StoredXCredentials } from '../types/nfc.types'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'x_oauth_credentials'
const DUPLICATE_TAG_TTL_MS = 5_000
const __DEV__ = process.env.NODE_ENV === 'development'

// Custom AID for Xelabyte (F078656C61627974 = "xelabyt" in hex with F0 prefix)
const XELABYTE_AID = 'F078656C61627974'

// Read env keys once at module level — they are constant and do not belong
// inside hot-path event handlers.
const CONSUMER_KEY = process.env.EXPO_PUBLIC_X_CONSUMER_KEY ?? ''
const CONSUMER_SECRET = process.env.EXPO_PUBLIC_X_CONSUMER_SECRET ?? ''

interface UseNfcHandshakeResult {
  supported: boolean | null
  enabled: boolean
  handshaking: boolean
  lastTagId: string | null
  lastUsername: string | null
  tweetPosted: boolean
  tweetError: string | null
  resetHandshake: () => void
  refreshCredentials: () => Promise<void>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNfcHandshake(): UseNfcHandshakeResult {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [handshaking, setHandshaking] = useState(false)
  const [lastTagId, setLastTagId] = useState<string | null>(null)
  const [lastUsername, setLastUsername] = useState<string | null>(null)
  const [tweetPosted, setTweetPosted] = useState(false)
  const [tweetError, setTweetError] = useState<string | null>(null)

  // Refs are used for values accessed inside NFC event listeners to avoid
  // stale closure issues with React state.
  const mounted = useRef(true)
  const isProcessingRef = useRef(false)
  const recentHandshakesRef = useRef<Set<string>>(new Set())

  // Cache credentials in a ref so AsyncStorage is not called on every tag
  // detection. Credentials are loaded once on mount and can be refreshed manually.
  const credentialsRef = useRef<StoredXCredentials | null>(null)

  const addHandshake = useHandshakeStore((state) => state.addHandshake)

  // ── Load credentials with refresh mechanism ───────────────────────────────
  const refreshCredentials = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      credentialsRef.current = raw ? (JSON.parse(raw) as StoredXCredentials) : null
      if (__DEV__) {
        console.log('[useNfcHandshake] Credentials refreshed:', credentialsRef.current ? 'Found' : 'Not found')
      }
    } catch (err) {
      console.warn('[useNfcHandshake] Failed to refresh credentials:', err)
      credentialsRef.current = null
    }
  }, [])

  // Load credentials once on mount
  useEffect(() => {
    refreshCredentials()
  }, [refreshCredentials])

  // ── HCE broadcasting (Android only) ───────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android') {
      console.log('[useNfcHandshake] HCE only supported on Android')
      return
    }

    let mounted = true
    // The docs require us to keep a reference to the HCESession so we can
    // call setEnabled(false) on cleanup. HCESession.getInstance() returns
    // the singleton — storing it here is safe.
    let hceSession: HCESession | null = null
    // The `on()` method returns a cancel function — store it so we can remove
    // the read-event listener on cleanup.
    let removeReadListener: (() => void) | null = null

    async function startHCEBroadcast() {
      try {
        // Prefer the already-cached credentials; fall back to AsyncStorage.
        const stored =
          credentialsRef.current ??
          (await AsyncStorage.getItem(STORAGE_KEY).then((raw) =>
            raw ? (JSON.parse(raw) as StoredXCredentials) : null,
          ))

        if (!stored?.screenName) {
          console.warn('[useNfcHandshake] No username found, skipping HCE broadcast')
          return
        }

        // Update cache in case it was empty.
        credentialsRef.current = stored

        hceSession = await HCESession.getInstance()
        if (!mounted) return

        const tag = new NFCTagType4({
          type: NFCTagType4NDEFContentType.Text,
          content: `username:@${stored.screenName}`,
          writable: false,
        })

        // Per docs: call setApplication BEFORE setEnabled(true).
        await hceSession.setApplication(tag)
        if (!mounted) return

        await hceSession.setEnabled(true)
        if (__DEV__) {
          console.log('[useNfcHandshake] HCE broadcasting started for @' + stored.screenName)
        } else {
          console.log('[useNfcHandshake] HCE broadcasting started')
        }

        // The HCESession exposes an HCE_STATE_READ event that fires when
        // another device has successfully read our emulated tag. We use this
        // to confirm that our broadcast side was consumed — useful for logging
        // or future feedback UI.
        removeReadListener = hceSession.on(HCESession.Events.HCE_STATE_READ, () => {
          console.log('[useNfcHandshake] Our HCE tag was read by a remote device')
        })
      } catch (error) {
        console.error('[useNfcHandshake] Failed to start HCE broadcast:', error)
      }
    }

    startHCEBroadcast()

    return () => {
      mounted = false
      removeReadListener?.()
      hceSession?.setEnabled(false).catch((error) => {
        console.warn('[useNfcHandshake] Failed to disable HCE on cleanup:', error)
      })
    }
  }, [])

  // ── NFC scanning ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const isSupported = await NfcManager.isSupported()
        if (!mounted.current) return
        setSupported(isSupported)
        if (!isSupported) return

        await NfcManager.start()
        if (!mounted.current) return

        const isNfcEnabled = await NfcManager.isEnabled()
        if (!mounted.current) return
        setEnabled(isNfcEnabled)
        if (!isNfcEnabled) return

        // Also listen for SessionClosed so we can clean up gracefully if the
        // OS terminates the scanning session (e.g., screen-off on some devices).
        NfcManager.setEventListener(NfcEvents.SessionClosed, () => {
          console.log('[useNfcHandshake] NFC session closed by OS')
          isProcessingRef.current = false
          recentHandshakesRef.current.clear() // Clear recent handshakes on session close
          if (mounted.current) setHandshaking(false)
        })

        NfcManager.setEventListener(NfcEvents.DiscoverTag, async (rawTag: NfcHandshakeTagEvent) => {
          console.log('[useNfcHandshake] ★★★ Tag discovered! ★★★', {
            id: rawTag?.id,
            serialNumber: rawTag?.serialNumber,
            tagId: rawTag?.tagId,
            hasNdefMessage: !!rawTag?.ndefMessage,
            ndefLength: rawTag?.ndefMessage?.length || 0,
          })

          // Wrap entire handler in try-finally to GUARANTEE state cleanup
          try {
            if (!mounted.current) {
              console.log('[useNfcHandshake] Component unmounted, ignoring tag')
              return
            }

            if (isProcessingRef.current) {
              console.log('[useNfcHandshake] Already processing a handshake, ignoring...')
              return
            }

            const id = rawTag?.id ?? rawTag?.serialNumber ?? rawTag?.tagId ?? null
            const tagIdentifier = id ?? 'unknown'

            if (recentHandshakesRef.current.has(tagIdentifier)) {
              console.log('[useNfcHandshake] Duplicate tag ignored:', tagIdentifier)
              return
            }

            isProcessingRef.current = true
            console.log('[useNfcHandshake] Setting handshaking to TRUE, showing modal...')

            if (mounted.current) {
              setHandshaking(true)
              setTweetPosted(false)
              setTweetError(null)
              setLastTagId(id)
            }

            try {
              // ── Parse NDEF payload ───────────────────────────────────────
              console.log('[useNfcHandshake] Starting NDEF parsing...')
              let otherUsername: string | null = null
              const ndefRecords = rawTag?.ndefMessage

              if (!ndefRecords || ndefRecords.length === 0) {
                console.warn('[useNfcHandshake] No NDEF records found in tag!')
                console.log('[useNfcHandshake] Tag details:', JSON.stringify(rawTag, null, 2))
              } else {
                console.log(`[useNfcHandshake] Found ${ndefRecords.length} NDEF record(s)`)
              }

              if (ndefRecords && ndefRecords.length > 0) {
                const record = ndefRecords[0]
                console.log('[useNfcHandshake] First NDEF record:', {
                  hasPayload: !!record.payload,
                  payloadLength: record.payload?.length || 0,
                  tnf: record.tnf,
                  type: record.type,
                })

                if (record.payload && record.payload.length > 0) {
                  try {
                    // Try simple approach first (matches old working version)
                    const payloadBytes = Array.from(record.payload as number[])
                    const raw = String.fromCharCode(...payloadBytes)
                    console.log('[useNfcHandshake] Raw payload string:', raw)

                    // Look for username pattern
                    if (raw.includes('username:@')) {
                      const match = raw.match(/username:@(\w+)/)
                      if (match?.[1]) {
                        otherUsername = match[1]
                        console.log('[useNfcHandshake] ✓ Username extracted:', otherUsername)
                      }
                    }

                    // If simple approach didn't work, try proper NDEF decoding
                    if (!otherUsername) {
                      const payloadArray =
                        record.payload instanceof Uint8Array ? record.payload : new Uint8Array(record.payload)
                      const decoded = Ndef.text.decodePayload(payloadArray)
                      console.log('[useNfcHandshake] Ndef.text decoded:', decoded)

                      if (decoded?.startsWith('username:@')) {
                        otherUsername = decoded.replace('username:@', '')
                        console.log('[useNfcHandshake] ✓ Username from NDEF decoder:', otherUsername)
                      }
                    }
                  } catch (parseErr) {
                    console.warn('[useNfcHandshake] Failed to parse NDEF payload:', parseErr)
                  }
                }
              }

              // Fallback: Generate a placeholder username if parsing failed
              // This matches the old working behavior
              if (!otherUsername) {
                console.warn('[useNfcHandshake] Could not parse username from tag, generating placeholder')
                otherUsername = `Seeker_${tagIdentifier.substring(0, 8)}`
                console.log('[useNfcHandshake] Generated placeholder username:', otherUsername)
              }

              console.log('[useNfcHandshake] ✓ SUCCESS: Handshake with @' + otherUsername)
              if (mounted.current) setLastUsername(otherUsername)

              // Mark tag as recently processed to suppress duplicates.
              recentHandshakesRef.current.add(tagIdentifier)
              setTimeout(() => {
                recentHandshakesRef.current.delete(tagIdentifier)
              }, DUPLICATE_TAG_TTL_MS)

              // ── Store handshake ──────────────────────────────────────────
              try {
                addHandshake({ username: otherUsername, tagId: tagIdentifier })
                if (__DEV__) {
                  console.log('[useNfcHandshake] Handshake stored for:', otherUsername)
                } else {
                  console.log('[useNfcHandshake] Handshake stored')
                }
              } catch (storeErr) {
                console.error('[useNfcHandshake] Failed to store handshake:', storeErr)
              }

              // ── Post tweet ───────────────────────────────────────────────
              // Use cached credentials — no AsyncStorage call in the hot path.
              const stored = credentialsRef.current
              console.log('[useNfcHandshake] Checking tweet credentials...', {
                hasCredentials: !!stored,
                hasConsumerKey: !!CONSUMER_KEY,
                hasConsumerSecret: !!CONSUMER_SECRET,
              })

              if (stored && CONSUMER_KEY && CONSUMER_SECRET) {
                console.log('[useNfcHandshake] Posting tweet for @' + otherUsername + '...')
                try {
                  const credentials: XAuthCredentials = {
                    consumerKey: CONSUMER_KEY,
                    consumerSecret: CONSUMER_SECRET,
                    accessToken: stored.accessToken,
                    accessTokenSecret: stored.accessTokenSecret,
                  }
                  await postHandshakeTweet(otherUsername, credentials)
                  if (mounted.current) {
                    setTweetPosted(true)
                    console.log('[useNfcHandshake] ✓ Tweet posted successfully')
                  }
                } catch (err) {
                  console.error('[useNfcHandshake] ✗ Failed to post tweet:', err)
                  if (mounted.current) {
                    setTweetError(err instanceof Error ? err.message : 'Failed to post tweet')
                  }
                }
              } else {
                console.warn('[useNfcHandshake] Skipping tweet — missing credentials or consumer keys')
              }
            } catch (error) {
              console.error('[useNfcHandshake] Error in handshake processing:', error)
              if (mounted.current) {
                setTweetError(error instanceof Error ? error.message : 'NFC handling failed')
              }
            }
          } catch (outerError) {
            // Catch any errors from the outer try block (early returns, etc.)
            console.error('[useNfcHandshake] ✗✗✗ Critical error in NFC event handler:', outerError)
          } finally {
            // CRITICAL FIX: This finally block ALWAYS runs, even with early returns
            // Reset processing lock but KEEP handshaking=true so modal stays visible
            // User must manually close modal via resetHandshake()
            console.log('[useNfcHandshake] Finally block: resetting processing lock, keeping modal visible')
            if (mounted.current) {
              isProcessingRef.current = false
              // DON'T set handshaking to false - let modal stay visible until user closes it
            }
          }
        })

        // registerTagEvent keeps the foreground scanning session alive
        // continuously — the listener above handles each detected tag without
        // calling unregisterTagEvent, which is the correct pattern for ongoing
        // bidirectional scanning.
        await NfcManager.registerTagEvent({
          alertMessage: 'Tap to connect',
          invalidateAfterFirstRead: false,
          isReaderModeEnabled: true,
          readerModeFlags:
            Platform.OS === 'android'
              ? // NFC_A | NFC_B | NFC_F | NFC_V
                // Handle all NFC tag types - removed SKIP_NDEF_CHECK to allow automatic NDEF reading
                0x01 | 0x02 | 0x04 | 0x08
              : undefined,
        })
      } catch (error) {
        console.warn('[useNfcHandshake] NFC init failed:', error)
      }
    }

    init()

    return () => {
      mounted.current = false
      NfcManager.setEventListener(NfcEvents.DiscoverTag, null as any)
      NfcManager.setEventListener(NfcEvents.SessionClosed, null as any)
      NfcManager.unregisterTagEvent().catch(() => {})
    }
  }, [addHandshake])

  // ── Public reset ──────────────────────────────────────────────────────────
  const resetHandshake = () => {
    setHandshaking(false)
    setLastTagId(null)
    setLastUsername(null)
    setTweetPosted(false)
    setTweetError(null)
    isProcessingRef.current = false
  }

  return {
    supported,
    enabled,
    handshaking,
    lastTagId,
    lastUsername,
    tweetPosted,
    tweetError,
    resetHandshake,
    refreshCredentials,
  }
}
