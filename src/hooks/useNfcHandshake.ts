import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useRef, useState } from 'react'
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager'
import { queueHandshakeTweet, registerHandshakePair, waitForTweetCompletion } from '../../services/tweetBackendService'
import { type XAuthCredentials } from '../../services/xTweetService'
import { useHandshakeStore } from '../store/handshakeStore'

const STORAGE_KEY = 'x_oauth_credentials'
const HANDSHAKE_PREFIX = 'echo-handshake-v1:'

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
  exchangeStatus: string | null
  pairing: boolean
  pairingSuccess: boolean
  pairedUsername: string | null
  tweetPosting: boolean
  tweetPosted: boolean
  tweetError: string | null
  resetHandshake: () => void
}

function sanitizeUsername(value: string): string {
  return value.replace(/^@+/, '').trim()
}

function parseUsernameFromTag(tag: any): string | null {
  const ndefRecords = (tag as any)?.ndefMessage
  if (!Array.isArray(ndefRecords) || ndefRecords.length === 0) {
    return null
  }

  for (const record of ndefRecords) {
    try {
      if (Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_TEXT)) {
        const text = Ndef.text.decodePayload(record.payload)
        if (text?.startsWith(HANDSHAKE_PREFIX)) {
          return sanitizeUsername(text.replace(HANDSHAKE_PREFIX, ''))
        }

        if (text?.startsWith('username:@')) {
          return sanitizeUsername(text.replace('username:@', ''))
        }
      }
    } catch (error) {
      console.warn('[useNfcHandshake] Failed to parse NDEF record:', error)
    }
  }

  return null
}

async function getLocalHandshakeUsername(tagId: string | null): Promise<string> {
  try {
    const storedData = await AsyncStorage.getItem(STORAGE_KEY)
    if (storedData) {
      const stored: StoredCredentials = JSON.parse(storedData)
      if (stored.screenName) {
        return sanitizeUsername(stored.screenName)
      }
    }
  } catch (error) {
    console.warn('[useNfcHandshake] Failed to load local username from storage:', error)
  }

  return `Seeker_${tagId?.substring(0, 8) || 'Local'}`
}

export function useNfcHandshake(): UseNfcHandshakeResult {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [handshaking, setHandshaking] = useState(false)
  const [lastTagId, setLastTagId] = useState<string | null>(null)
  const [lastUsername, setLastUsername] = useState<string | null>(null)
  const [exchangeStatus, setExchangeStatus] = useState<string | null>(null)
  const [pairing, setPairing] = useState(false)
  const [pairingSuccess, setPairingSuccess] = useState(false)
  const [pairedUsername, setPairedUsername] = useState<string | null>(null)
  const [tweetPosting, setTweetPosting] = useState(false)
  const [tweetPosted, setTweetPosted] = useState(false)
  const [tweetError, setTweetError] = useState<string | null>(null)
  const sessionInProgressRef = useRef(false)

  const addHandshake = useHandshakeStore((state) => state.addHandshake)

  const runNdefHandshakeSession = useCallback(async () => {
    if (sessionInProgressRef.current) {
      return
    }

    sessionInProgressRef.current = true

    try {
      setTweetPosting(false)
      setTweetPosted(false)
      setTweetError(null)
      setExchangeStatus(null)
      setPairing(false)
      setPairingSuccess(false)
      setPairedUsername(null)

      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: 'Hold your phone near another NFC target',
      })

      const tag = await NfcManager.getTag()

      setHandshaking(true)
      console.log('[useNfcHandshake] DiscoverTag raw payload:', tag)

      // Use a simple identifier from the tag so we can show something in the UI.
      const id = (tag as any)?.id ?? (tag as any)?.serialNumber ?? (tag as any)?.tagId ?? null
      setLastTagId(id)

      const localUsername = await getLocalHandshakeUsername(id)
      console.log('[useNfcHandshake] Local handshake username:', localUsername)

      // Read remote username if target exposes NDEF payload.
      const parsedRemoteUsername = parseUsernameFromTag(tag)
      if (parsedRemoteUsername) {
        console.log('[useNfcHandshake] Remote username read from NDEF:', parsedRemoteUsername)
      } else {
        console.log('[useNfcHandshake] No remote handshake payload found on target')
      }

      // Attempt to publish local username so another device can read it.
      const outboundPayload = `${HANDSHAKE_PREFIX}${localUsername}`
      let publishedLocalPayload = false
      let publishFailureReason: string | null = null

      try {
        const bytes = Ndef.encodeMessage([Ndef.textRecord(outboundPayload)])
        if (bytes) {
          await NfcManager.ndefHandler.writeNdefMessage(bytes)
          publishedLocalPayload = true
          console.log('[useNfcHandshake] Published local handshake payload:', outboundPayload)
        } else {
          publishFailureReason = 'Failed to encode NDEF payload'
          console.log('[useNfcHandshake] Skipped publish: failed to encode NDEF payload')
        }
      } catch (publishError) {
        publishFailureReason = publishError instanceof Error ? publishError.message : 'Unknown write error'
        console.log('[useNfcHandshake] Publish failed:', publishError)
      }

      let otherUsername: string | null = parsedRemoteUsername

      // Fallback username when remote payload is not available.
      if (!otherUsername) {
        otherUsername = `Seeker_${id?.substring(0, 8) || 'Unknown'}`
      }

      const didReadRemotePayload = Boolean(parsedRemoteUsername)
      const usedFallbackIdentity = !didReadRemotePayload

      let status: string
      if (didReadRemotePayload && publishedLocalPayload) {
        status = 'Read remote + published local payload'
      } else if (didReadRemotePayload) {
        status = `Read remote payload; local publish unavailable (${publishFailureReason || 'target not writable'})`
      } else if (publishedLocalPayload) {
        status = 'Published local payload; remote payload not found'
      } else if (usedFallbackIdentity) {
        status = `Peer target is not NDEF-writable/readable (${publishFailureReason || 'no remote payload'})`
      } else {
        status = 'Handshake recorded'
      }

      setExchangeStatus(status)
      console.log('[useNfcHandshake] Exchange status:', status)

      setLastUsername(otherUsername)

      // Store the handshake
      const handshakeData = {
        username: otherUsername,
        tagId: id || 'unknown',
      }

      console.log('[useNfcHandshake] Normalized handshake data:', handshakeData)

      addHandshake(handshakeData)

      // Queue tweet posting via backend service with pairing (non-blocking)
      // Step 1: Try to pair with another device to get their username
      // Step 2: Tweet mentioning the other user (or generic if pairing fails)
      try {
        const storedData = await AsyncStorage.getItem(STORAGE_KEY)
        if (storedData) {
          const stored: StoredCredentials = JSON.parse(storedData)

          // Get consumer keys from env
          const consumerKey = process.env.EXPO_PUBLIC_X_CONSUMER_KEY ?? ''
          const consumerSecret = process.env.EXPO_PUBLIC_X_CONSUMER_SECRET ?? ''

          if (consumerKey && consumerSecret && stored.screenName) {
            const credentials: XAuthCredentials = {
              consumerKey,
              consumerSecret,
              accessToken: stored.accessToken,
              accessTokenSecret: stored.accessTokenSecret,
            }

            const myUsername = sanitizeUsername(stored.screenName)
            // Use timestamp as handshake ID (both devices will use same timestamp window)
            const handshakeId = `${id}_${Math.floor(Date.now() / 5000)}` // 5 second window

            console.log('[useNfcHandshake] Attempting to pair with other device...')
            console.log('[useNfcHandshake] My username:', myUsername)
            console.log('[useNfcHandshake] Handshake ID:', handshakeId)

            // Show pairing status in UI
            setPairing(true)

            // Try to pair with other device (has 8 second timeout)
            const pairResult = await registerHandshakePair(myUsername, handshakeId)

            setPairing(false)

            let usernameForTweet: string | null = null
            if (pairResult.success && pairResult.pairedUsername) {
              console.log('[useNfcHandshake] 🎉 Pairing successful! Other user:', pairResult.pairedUsername)
              usernameForTweet = pairResult.pairedUsername
              setPairingSuccess(true)
              setPairedUsername(pairResult.pairedUsername)
              setLastUsername(`@${pairResult.pairedUsername}`)
            } else {
              console.log('[useNfcHandshake] Pairing failed, will use generic tweet')
              usernameForTweet = null // Will trigger generic tweet
              setPairingSuccess(false)
              setPairedUsername(null)
            }

            console.log('[useNfcHandshake] Queueing tweet to backend service...')

            // Queue the tweet (returns immediately)
            // Pass pairedUsername if found, or null for generic tweet (never send own username!)
            console.log('[useNfcHandshake] Username for tweet:', usernameForTweet || 'generic (no @mention)')
            const response = await queueHandshakeTweet(usernameForTweet || '', credentials)
            console.log('[useNfcHandshake] Tweet queued with jobId:', response.jobId)

            // Start background polling for tweet status
            setTweetPosting(true)

            // Poll for completion in the background (doesn't block)
            waitForTweetCompletion(response.jobId)
              .then((status) => {
                if (status.status === 'completed') {
                  setTweetPosted(true)
                  setTweetError(null)
                  console.log('[useNfcHandshake] Tweet posted successfully:', status.tweetId)
                } else if (status.status === 'failed') {
                  setTweetError(status.error || 'Tweet posting failed')
                  console.error('[useNfcHandshake] Tweet posting failed:', status.error)
                }
              })
              .catch((error) => {
                const errorMessage = error instanceof Error ? error.message : 'Failed to post tweet'
                setTweetError(errorMessage)
                console.error('[useNfcHandshake] Tweet polling error:', errorMessage)
              })
              .finally(() => {
                setTweetPosting(false)
              })
          }
        }
      } catch (err) {
        console.error('[useNfcHandshake] Failed to queue tweet:', err)
        setTweetError(err instanceof Error ? err.message : 'Failed to queue tweet')
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown NFC error'
      console.warn('[useNfcHandshake] NDEF session failed:', error)

      setHandshaking(true)
      setLastTagId(null)
      setLastUsername(null)
      setTweetPosting(false)
      setTweetPosted(false)
      setTweetError(null)
      setExchangeStatus(`Peer target is not NDEF-capable or access was cancelled (${reason})`)
    } finally {
      await NfcManager.cancelTechnologyRequest().catch(() => {})
      sessionInProgressRef.current = false
    }
  }, [addHandshake])

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

        await runNdefHandshakeSession()
      } catch (e) {
        console.warn('NFC handshake init failed:', e)
      }
    }

    init()

    return () => {
      mounted = false
      NfcManager.cancelTechnologyRequest().catch(() => {})
    }
  }, [runNdefHandshakeSession])

  const resetHandshake = () => {
    setHandshaking(false)
    setLastTagId(null)
    setLastUsername(null)
    setExchangeStatus(null)
    setPairing(false)
    setPairingSuccess(false)
    setPairedUsername(null)
    setTweetPosting(false)
    setTweetPosted(false)
    setTweetError(null)
    runNdefHandshakeSession().catch(() => {})
  }

  return {
    supported,
    enabled,
    handshaking,
    lastTagId,
    lastUsername,
    exchangeStatus,
    pairing,
    pairingSuccess,
    pairedUsername,
    tweetPosting,
    tweetPosted,
    tweetError,
    resetHandshake,
  }
}
