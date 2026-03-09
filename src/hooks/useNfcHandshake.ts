import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useRef, useState } from 'react'
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager'
import { postHandshakeTweet, type XAuthCredentials } from '../../services/xTweetService'
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
      setTweetPosted(false)
      setTweetError(null)
      setExchangeStatus(null)

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

      // Try to post a tweet if user is connected to Twitter
      try {
        const storedData = await AsyncStorage.getItem(STORAGE_KEY)
        if (storedData) {
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
            setTweetPosted(true)
            console.log('[useNfcHandshake] Tweet posted successfully')
          }
        }
      } catch (err) {
        console.error('[useNfcHandshake] Failed to post tweet:', err)
        setTweetError(err instanceof Error ? err.message : 'Failed to post tweet')
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown NFC error'
      console.warn('[useNfcHandshake] NDEF session failed:', error)

      setHandshaking(true)
      setLastTagId(null)
      setLastUsername(null)
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
    tweetPosted,
    tweetError,
    resetHandshake,
  }
}
