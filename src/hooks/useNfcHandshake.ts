import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'
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

  const addHandshake = useHandshakeStore((state) => state.addHandshake)

  // Start HCE broadcasting
  useEffect(() => {
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

        // Get HCE session instance
        hceSession = await HCESession.getInstance()

        // Create an NFC Tag Type 4 with NDEF text record
        const tag = new NFCTagType4({
          type: NFCTagType4NDEFContentType.Text,
          content: `username:@${username}`,
          writable: false,
        })

        // Set the application (tag content)
        await hceSession.setApplication(tag)

        // Enable HCE broadcasting
        await hceSession.setEnabled(true)
        console.log('[useNfcHandshake] HCE broadcasting started for @' + username)
      } catch (e) {
        console.warn('[useNfcHandshake] Failed to start HCE broadcast:', e)
      }
    }

    startHCEBroadcast()

    return () => {
      mounted = false
      // Stop HCE broadcasting on cleanup
      if (hceSession) {
        hceSession.setEnabled(false).catch(() => {})
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
          setHandshaking(true)
          setTweetPosted(false)
          setTweetError(null)

          // Use a simple identifier from the tag so we can show something in the UI.
          const id = (tag as any)?.id ?? (tag as any)?.serialNumber ?? (tag as any)?.tagId ?? null

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
                // Use Ndef.text.decodePayload to properly decode the NDEF text record
                // This handles the language code prefix automatically
                const payload = Ndef.text.decodePayload(new Uint8Array(record.payload))
                // Extract username if it's in the format "username:@handle"
                if (payload.startsWith('username:@')) {
                  otherUsername = payload.replace('username:@', '')
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

          setLastUsername(otherUsername)

          // Store the handshake
          addHandshake({
            username: otherUsername,
            tagId: id || 'unknown',
          })

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

          // Immediately stop listening so the modal only triggers once per tap.
          NfcManager.unregisterTagEvent().catch(() => {})
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
    setHandshaking(false)
    setLastTagId(null)
    setLastUsername(null)
    setTweetPosted(false)
    setTweetError(null)
    // Re-register scan session so the user can handshake again.
    NfcManager.registerTagEvent().catch(() => {})
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
