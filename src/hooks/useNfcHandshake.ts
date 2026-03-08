import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { HCESession, NFCTagType4, NFCTagType4NDEFContentType } from 'react-native-hce'
import NfcManager, { Ndef, NfcEvents } from 'react-native-nfc-manager'
import { postHandshakeTweet, type XAuthCredentials } from '../../services/xTweetService'
import { useHandshakeStore } from '../store/handshakeStore'

const STORAGE_KEY = 'x_oauth_credentials'

interface StoredCredentials {
  accessToken: string
  accessTokenSecret: string
  screenName: string
}

interface UseNfcHandshakeResult {
  supported: boolean | null
  enabled: boolean
  handshaking: boolean
  lastTagId: string | null
  lastUsername: string | null
  tweetPosted: boolean
  tweetError: string | null
  resetHandshake: () => void
}

export function useNfcHandshake(): UseNfcHandshakeResult {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [handshaking, setHandshaking] = useState(false)
  const [lastTagId, setLastTagId] = useState<string | null>(null)
  const [lastUsername, setLastUsername] = useState<string | null>(null)
  const [tweetPosted, setTweetPosted] = useState(false)
  const [tweetError, setTweetError] = useState<string | null>(null)

  // Use refs to track state that needs to be accessed in event listener
  const isProcessingRef = useRef(false)
  const recentHandshakesRef = useRef<Set<string>>(new Set())

  const addHandshake = useHandshakeStore((state) => state.addHandshake)

  // Start HCE broadcasting
  useEffect(() => {
    // HCE is only supported on Android
    if (Platform.OS !== 'android') {
      console.log('[useNfcHandshake] HCE only supported on Android')
      return
    }

    let mounted = true
    let hceSession: HCESession | null = null

    async function startHCEBroadcast() {
      try {
        // Get the user's screenName from storage
        const storedData = await AsyncStorage.getItem(STORAGE_KEY)
        if (!storedData) {
          console.warn('[useNfcHandshake] No user credentials found, skipping HCE broadcast')
          return
        }

        const stored: StoredCredentials = JSON.parse(storedData)
        const username = stored.screenName

        if (!username) {
          console.warn('[useNfcHandshake] No username found in credentials')
          return
        }

        // Get HCE session instance
        hceSession = await HCESession.getInstance()

        if (!mounted) return

        // Create an NFC Tag Type 4 with NDEF text record
        const tag = new NFCTagType4({
          type: NFCTagType4NDEFContentType.Text,
          content: `username:@${username}`,
          writable: false,
        })

        // Set the application (tag content)
        await hceSession.setApplication(tag)

        if (!mounted) return

        // Enable HCE broadcasting
        await hceSession.setEnabled(true)
        console.log('[useNfcHandshake] HCE broadcasting started for @' + username)
      } catch (e) {
        console.error('[useNfcHandshake] Failed to start HCE broadcast:', e)
      }
    }

    startHCEBroadcast()

    return () => {
      mounted = false
      // Stop HCE broadcasting on cleanup
      if (hceSession) {
        hceSession.setEnabled(false).catch((err) => {
          console.warn('[useNfcHandshake] Failed to disable HCE:', err)
        })
      }
    }
  }, [])

  // Start NFC scanning
  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const isSupported = await NfcManager.isSupported()
        if (!mounted) return

        setSupported(isSupported)

        if (!isSupported) {
          return
        }

        await NfcManager.start()
        if (!mounted) return

        const isEnabled = await NfcManager.isEnabled()
        if (!mounted) return

        setEnabled(isEnabled)

        if (!isEnabled) {
          return
        }

        // Listen for any NFC tag / peer detection.
        NfcManager.setEventListener(NfcEvents.DiscoverTag, async (tag: any) => {
          try {
            if (!mounted) return

            // Prevent multiple concurrent processing
            if (isProcessingRef.current) {
              console.log('[useNfcHandshake] Already processing a handshake, ignoring...')
              return
            }

            console.log('[useNfcHandshake] NFC tag detected:', tag)

            // Use a simple identifier from the tag
            const id = (tag as any)?.id ?? (tag as any)?.serialNumber ?? (tag as any)?.tagId ?? null
            const tagIdentifier = id || 'unknown'

            // Check if we've processed this tag recently (within last 5 seconds)
            if (recentHandshakesRef.current.has(tagIdentifier)) {
              console.log('[useNfcHandshake] Tag already processed recently, ignoring duplicate')
              return
            }

            isProcessingRef.current = true
            setHandshaking(true)
            setTweetPosted(false)
            setTweetError(null)
            setLastTagId(id)

            // Try to extract username from NFC tag data (if available)
            let otherUsername: string | null = null

            try {
              // Check if there's NDEF data with username
              const ndefRecords = (tag as any)?.ndefMessage
              if (ndefRecords && ndefRecords.length > 0) {
                // Parse the first record as text using proper NDEF decoder
                const record = ndefRecords[0]
                if (record.payload && record.payload.length > 0) {
                  try {
                    // Ensure payload is a Uint8Array
                    const payloadArray =
                      record.payload instanceof Uint8Array ? record.payload : new Uint8Array(record.payload)

                    // Use Ndef.text.decodePayload to properly decode the NDEF text record
                    // This handles the language code prefix automatically
                    const payload = Ndef.text.decodePayload(payloadArray)
                    console.log('[useNfcHandshake] Decoded payload:', payload)

                    // Extract username if it's in the format "username:@handle"
                    if (payload && payload.startsWith('username:@')) {
                      otherUsername = payload.replace('username:@', '')
                    }
                  } catch (decodeErr) {
                    console.error('[useNfcHandshake] Failed to decode NDEF payload:', decodeErr)
                    // Fallback: try to read as plain text
                    try {
                      const textPayload = String.fromCharCode.apply(null, Array.from(record.payload))
                      if (textPayload && textPayload.includes('username:@')) {
                        const match = textPayload.match(/username:@(\w+)/)
                        if (match && match[1]) {
                          otherUsername = match[1]
                        }
                      }
                    } catch (fallbackErr) {
                      console.error('[useNfcHandshake] Fallback decode also failed:', fallbackErr)
                    }
                  }
                }
              }
            } catch (e) {
              console.warn('[useNfcHandshake] Failed to parse NFC data:', e)
            }

            // For demo purposes, generate a placeholder username if none found
            if (!otherUsername) {
              otherUsername = `Seeker_${id?.substring(0, 8) || 'Unknown'}`
            }

            if (!mounted) {
              isProcessingRef.current = false
              return
            }
            setLastUsername(otherUsername)

            // Add to recent handshakes to prevent duplicates
            recentHandshakesRef.current.add(tagIdentifier)

            // Clear from recent after 5 seconds
            setTimeout(() => {
              recentHandshakesRef.current.delete(tagIdentifier)
              console.log('[useNfcHandshake] Cleared tag from recent:', tagIdentifier)
            }, 5000)

            // Store the handshake
            try {
              addHandshake({
                username: otherUsername,
                tagId: id || 'unknown',
              })
              console.log('[useNfcHandshake] Handshake stored for:', otherUsername)
            } catch (storeErr) {
              console.error('[useNfcHandshake] Failed to store handshake:', storeErr)
            }

            // Try to post a tweet if user is connected to Twitter
            try {
              const storedData = await AsyncStorage.getItem(STORAGE_KEY)
              if (storedData && mounted) {
                const stored: StoredCredentials = JSON.parse(storedData)

                // Get consumer keys from env
                const consumerKey = process.env.EXPO_PUBLIC_X_CONSUMER_KEY ?? ''
                const consumerSecret = process.env.EXPO_PUBLIC_X_CONSUMER_SECRET ?? ''

                if (consumerKey && consumerSecret) {
                  const credentials: XAuthCredentials = {
                    consumerKey,
                    consumerSecret,
                    accessToken: stored.accessToken,
                    accessTokenSecret: stored.accessTokenSecret,
                  }

                  await postHandshakeTweet(otherUsername, credentials)
                  if (mounted) {
                    setTweetPosted(true)
                    console.log('[useNfcHandshake] Tweet posted successfully')
                  }
                }
              }
            } catch (err) {
              console.error('[useNfcHandshake] Failed to post tweet:', err)
              if (mounted) {
                setTweetError(err instanceof Error ? err.message : 'Failed to post tweet')
              }
            }

            // Keep listening for more tags (don't unregister)
            // This allows bidirectional handshake and continuous scanning
            isProcessingRef.current = false
          } catch (error) {
            console.error('[useNfcHandshake] Critical error in NFC event handler:', error)
            if (mounted) {
              setTweetError(error instanceof Error ? error.message : 'NFC handling failed')
              setHandshaking(false)
              isProcessingRef.current = false
            }
          }
        })

        // Start a foreground tag scan session.
        await NfcManager.registerTagEvent()
      } catch (e) {
        console.warn('NFC handshake init failed:', e)
      }
    }

    init()

    return () => {
      mounted = false
      NfcManager.setEventListener(NfcEvents.DiscoverTag, null as any)
      NfcManager.unregisterTagEvent().catch(() => {})
    }
  }, [addHandshake])

  const resetHandshake = () => {
    console.log('[useNfcHandshake] Resetting handshake state')
    setHandshaking(false)
    setLastTagId(null)
    setLastUsername(null)
    setTweetPosted(false)
    setTweetError(null)
    isProcessingRef.current = false
    // No need to re-register - we keep the listener active for continuous scanning
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
  }
}
