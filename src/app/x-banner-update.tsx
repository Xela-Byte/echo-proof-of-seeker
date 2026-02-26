/**
 * X Banner Update Screen
 *
 * Flow:
 *  1. User taps "Sign in with X" — app requests a temporary token, then opens
 *     the X auth page in an ASWebAuthenticationSession (iOS) / Chrome Custom
 *     Tab (Android) via expo-web-browser.
 *  2. The browser sheet intercepts the echo://oauth-callback redirect and
 *     returns the full URL directly to the app — no separate route needed.
 *  3. App exchanges the verifier for real access tokens and enables the picker.
 *  4. User customizes the overlay (phone position, text)
 *  5. App fetches user's Twitter banner, creates overlay with phone and text
 *  6. App uploads the composed banner via OAuth 1.0a.
 */

import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { router, useFocusEffect } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import ViewShot from 'react-native-view-shot'
import {
  getDefaultOverlayConfig,
  type OverlayConfig,
  type PhoneAsset,
  type PhonePosition,
} from '../../services/bannerOverlayService'
import { useXBannerUpdate } from '../../services/useXBannerUpdate'
import { getAuthenticatedUser, type XAuthCredentials } from '../../services/xBannerService'
import { buildAuthorizationUrl, getOAuthAccessToken, getOAuthRequestToken } from '../../services/xOAuthFlow'
import { BannerComposer } from '../components/BannerComposer'

const SCREEN_WIDTH = Dimensions.get('window').width
const PREVIEW_H_MARGIN = 24
const PREVIEW_WIDTH = SCREEN_WIDTH - PREVIEW_H_MARGIN * 2
const PREVIEW_HEIGHT = Math.round(PREVIEW_WIDTH / 3)

const CONSUMER_KEY = process.env.EXPO_PUBLIC_X_CONSUMER_KEY ?? ''
const CONSUMER_SECRET = process.env.EXPO_PUBLIC_X_CONSUMER_SECRET ?? ''
const CALLBACK_URL = 'echo://oauth-callback'
const STORAGE_KEY = 'x_oauth_credentials'

// Fallback banner when user has no Twitter banner
const FALLBACK_BANNER = require('../assets/banner_1.jpg')

interface StoredCredentials {
  accessToken: string
  accessTokenSecret: string
  screenName: string
}

export default function XBannerUpdateScreen() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [xConnected, setXConnected] = useState(false)
  const [connectedUsername, setConnectedUsername] = useState('')
  const [userBannerUrl, setUserBannerUrl] = useState<string | null>(null)
  const [userCredentials, setUserCredentials] = useState<XAuthCredentials | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)

  // Overlay configuration
  const [overlayConfig, setOverlayConfig] = useState<OverlayConfig>(getDefaultOverlayConfig())

  // For capturing the composed banner
  const composerRef = useRef<View>(null)
  const [composerBannerUri, setComposerBannerUri] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [previewBannerUri, setPreviewBannerUri] = useState<string | null>(null)

  const { step, stepLabel, error, uploadedUri, generatedUri, uploadBannerWithOverlay, shareBanner, reset } =
    useXBannerUpdate()

  const isUploading = step === 'downloading' || step === 'generating' || step === 'uploading'
  const isDone = step === 'done'
  const isError = step === 'error'
  const canUpdate = !isUploading && xConnected && !!userCredentials

  // ── Auto-reset after successful upload ───────────────────────────────────────
  useEffect(() => {
    if (!isDone) return
    const timer = setTimeout(reset, 2500)
    return () => clearTimeout(timer)
  }, [isDone, reset])

  // ── Load preview banner when user connects ────────────────────────────────
  useEffect(() => {
    if (!xConnected) {
      setPreviewBannerUri(null)
      return
    }

    // Use user's banner if available, otherwise use fallback
    if (userBannerUrl) {
      // For preview, we can directly use the user's banner URL
      const previewUrl = userBannerUrl.includes('/1500x500') ? userBannerUrl : `${userBannerUrl}/1500x500`
      setPreviewBannerUri(previewUrl)
    } else {
      // Use fallback banner asset
      const Asset = require('expo-asset').Asset
      Asset.fromModule(FALLBACK_BANNER)
        .downloadAsync()
        .then((asset: any) => {
          if (asset.localUri) {
            setPreviewBannerUri(asset.localUri)
          }
        })
        .catch((err: any) => console.warn('Failed to load preview:', err))
    }
  }, [xConnected, userBannerUrl])

  // ── Restore persisted session ─────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return
        const stored: StoredCredentials = JSON.parse(raw)
        const creds: XAuthCredentials = {
          consumerKey: CONSUMER_KEY,
          consumerSecret: CONSUMER_SECRET,
          accessToken: stored.accessToken,
          accessTokenSecret: stored.accessTokenSecret,
        }

        // Fetch user's banner URL
        getAuthenticatedUser(creds)
          .then((user) => {
            setUserBannerUrl(user.bannerUrl)
            setUserCredentials(creds)
            setConnectedUsername(stored.screenName)
            setXConnected(true)
          })
          .catch(() => {
            // Session expired, clear it
            AsyncStorage.removeItem(STORAGE_KEY)
          })
      })
      .catch(() => {})
  }, [])

  // ── Clear update state every time the screen comes into focus ────────────
  useFocusEffect(
    useCallback(() => {
      reset()
    }, [reset]),
  )

  // ── OAuth sign-in ─────────────────────────────────────────────────────────
  const handleConnect = async () => {
    setIsConnecting(true)
    setConnectError(null)

    try {
      const { requestToken, requestTokenSecret } = await getOAuthRequestToken(
        CONSUMER_KEY,
        CONSUMER_SECRET,
        CALLBACK_URL,
      )

      const result = await WebBrowser.openAuthSessionAsync(buildAuthorizationUrl(requestToken), CALLBACK_URL)

      if (result.type !== 'success') {
        setIsConnecting(false)
        return
      }

      const callbackUrl = new URL(result.url)
      const verifier = callbackUrl.searchParams.get('oauth_verifier')
      const returnedToken = callbackUrl.searchParams.get('oauth_token')

      if (!verifier || returnedToken !== requestToken) {
        throw new Error('Invalid callback — please try again.')
      }

      const { accessToken, accessTokenSecret, screenName } = await getOAuthAccessToken(
        CONSUMER_KEY,
        CONSUMER_SECRET,
        requestToken,
        requestTokenSecret,
        verifier,
      )

      const creds: XAuthCredentials = {
        consumerKey: CONSUMER_KEY,
        consumerSecret: CONSUMER_SECRET,
        accessToken,
        accessTokenSecret,
      }

      // Verify credentials and get user's banner URL
      const user = await getAuthenticatedUser(creds)

      const stored: StoredCredentials = { accessToken, accessTokenSecret, screenName }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

      setUserCredentials(creds)
      setConnectedUsername(screenName)
      setUserBannerUrl(user.bannerUrl)
      setXConnected(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setConnectError(msg)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY)
    setXConnected(false)
    setConnectedUsername('')
    setUserBannerUrl(null)
    setUserCredentials(null)
    setConnectError(null)
    setComposerBannerUri(null)
    reset()
  }

  // ── Capture banner composition ────────────────────────────────────────────
  const captureBanner = useCallback(async (bannerUri: string, config: OverlayConfig): Promise<string> => {
    // Set the banner URI for the composer
    setComposerBannerUri(bannerUri)
    setIsCapturing(true)

    // Wait for the component to render
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Capture the view
    if (!composerRef.current) {
      throw new Error('Composer ref not available')
    }

    try {
      // @ts-ignore - ViewShot types might not be perfect
      const uri = await composerRef.current.capture()
      return uri
    } finally {
      setIsCapturing(false)
      setComposerBannerUri(null)
    }
  }, [])

  const handleApply = async () => {
    if (!userCredentials) return

    await uploadBannerWithOverlay(userBannerUrl, FALLBACK_BANNER, overlayConfig, userCredentials, captureBanner)
  }

  const randomizeBanner = () => {
    const phoneAssets: PhoneAsset[] = ['phone_1', 'phone_2']
    const positions: PhonePosition[] = ['left', 'right']

    const textVariations = [
      {
        main: 'Your Solana identity, powered by Echo',
        footnote: 'Generated on Echo, download on Solana Seeker dApp Store',
      },
      {
        main: 'Secure Solana identity on-chain',
        footnote: 'Powered by Echo • Available on Seeker dApp Store',
      },
      {
        main: 'On-chain identity for Solana',
        footnote: 'Built with Echo • Get it on Solana Seeker',
      },
      {
        main: 'Your decentralized Solana ID',
        footnote: 'Echo powered • Download on Seeker dApp Store',
      },
    ]

    const randomPhone = phoneAssets[Math.floor(Math.random() * phoneAssets.length)]
    const randomPosition = positions[Math.floor(Math.random() * positions.length)]
    const randomText = textVariations[Math.floor(Math.random() * textVariations.length)]

    setOverlayConfig({
      phoneAsset: randomPhone,
      phonePosition: randomPosition,
      mainText: randomText.main,
      footnoteText: randomText.footnote,
    })
  }

  const updateOverlayConfig = (updates: Partial<OverlayConfig>) => {
    setOverlayConfig((prev) => ({ ...prev, ...updates }))
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a18' }}>
      <ScrollView style={styles.container}>
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#14F195" />
        </TouchableOpacity>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Update X Banner</Text>
            <Text style={styles.subtitle}>Overlay your banner with a phone mockup and custom text</Text>
          </View>

          {xConnected ? (
            <View style={styles.connectedGroup}>
              <View style={styles.connectedPill}>
                <View style={styles.connectedDot} />
                <Text style={styles.connectedPillText}>@{connectedUsername}</Text>
              </View>
              <TouchableOpacity onPress={handleDisconnect} activeOpacity={0.7}>
                <Text style={styles.signOutText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.connectButton, isConnecting && styles.connectButtonBusy]}
              onPress={handleConnect}
              disabled={isConnecting}
              activeOpacity={0.8}
            >
              {isConnecting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.connectButtonText}>Sign in with X</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* ── Connect error ─────────────────────────────────────────── */}
        {connectError && (
          <View style={styles.connectErrorBox}>
            <Text style={styles.connectErrorText}>{connectError}</Text>
            <TouchableOpacity onPress={handleConnect}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Banner preview ───────────────────────────────────────── */}
        {previewBannerUri && (
          <View style={styles.previewWrapper}>
            <Text style={[styles.sectionLabel, { paddingHorizontal: 0 }]}>Preview</Text>
            <View style={styles.previewImageContainer}>
              <Image source={{ uri: previewBannerUri }} style={styles.previewBannerImage} resizeMode="cover" />
              {/* Semi-transparent overlay for better text visibility */}
              <View style={styles.previewOverlay} />
              {/* Phone overlay preview */}
              <Image
                source={
                  overlayConfig.phoneAsset === 'phone_1'
                    ? require('../assets/phone_1.png')
                    : require('../assets/phone_2.png')
                }
                style={[
                  styles.previewPhoneImage,
                  overlayConfig.phonePosition === 'left' ? styles.previewPhoneLeft : styles.previewPhoneRight,
                ]}
                resizeMode="contain"
              />
              {/* Text preview */}
              <View
                style={[
                  styles.previewTextContainer,
                  overlayConfig.phonePosition === 'left' ? styles.previewTextRight : styles.previewTextLeft,
                ]}
              >
                <Text style={styles.previewMainText}>{overlayConfig.mainText}</Text>
                <Text style={styles.previewFootnoteText}>{overlayConfig.footnoteText}</Text>
              </View>
              {isUploading && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="large" color="#14F195" />
                  <Text style={styles.uploadingText}>{stepLabel}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Customization Options ─────────────────────────────────── */}
        {xConnected && !isDone && (
          <View style={styles.randomizeSection}>
            <TouchableOpacity
              style={styles.randomizeButton}
              onPress={randomizeBanner}
              disabled={isUploading}
              activeOpacity={0.8}
            >
              <Ionicons name="shuffle" size={24} color={isUploading ? '#666' : '#14F195'} />
              <Text style={[styles.randomizeButtonText, isUploading && styles.randomizeButtonTextDisabled]}>
                Randomize Banner
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Success state ─────────────────────────────────────────── */}
        {isDone && (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>Done!</Text>
            <Text style={styles.successText}>Your X banner has been updated.</Text>
            <View style={styles.successActions}>
              <TouchableOpacity style={styles.outlineButton} onPress={shareBanner}>
                <Text style={styles.outlineButtonText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineButton} onPress={reset}>
                <Text style={styles.outlineButtonText}>Update Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Error state ───────────────────────────────────────────── */}
        {isError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.outlineButton} onPress={reset}>
              <Text style={styles.outlineButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Primary action ────────────────────────────────────────── */}
        {!isDone && (
          <TouchableOpacity
            style={[styles.primaryButton, !canUpdate && styles.primaryButtonDisabled]}
            onPress={handleApply}
            disabled={!canUpdate}
            activeOpacity={0.85}
          >
            {isUploading ? (
              <View style={styles.buttonRow}>
                <ActivityIndicator size="small" color="#000" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>{stepLabel || 'Processing...'}</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>
                {xConnected ? 'Generate & Apply Banner' : 'Sign in with X to Enable'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* ── Off-screen composer for capturing ─────────────────────── */}
        {isCapturing && composerBannerUri && (
          <View style={styles.offScreen}>
            <ViewShot ref={composerRef} options={{ format: 'jpg', quality: 0.95 }}>
              <BannerComposer bannerUri={composerBannerUri} config={overlayConfig} />
            </ViewShot>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a18' },
  backRow: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 4,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 24,
    paddingBottom: 12,
    gap: 12,
  },
  headerText: { flex: 1 },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#666', lineHeight: 20 },

  connectButton: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#555',
    minWidth: 110,
    alignItems: 'center',
  },
  connectButtonBusy: { opacity: 0.6 },
  connectButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  connectedGroup: { marginTop: 4, alignItems: 'flex-end', gap: 6 },
  connectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#0d1f17',
    borderWidth: 1,
    borderColor: '#14F195',
  },
  connectedDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#14F195' },
  connectedPillText: { color: '#14F195', fontSize: 13, fontWeight: '600' },
  signOutText: { fontSize: 12, color: '#555', textDecorationLine: 'underline' },

  connectErrorBox: {
    marginHorizontal: 24,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#1f0d0d',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ff4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  connectErrorText: { flex: 1, fontSize: 12, color: '#ff6666', lineHeight: 17 },
  retryText: { fontSize: 13, color: '#9945FF', fontWeight: '600' },

  previewWrapper: { marginHorizontal: PREVIEW_H_MARGIN, marginBottom: 20 },
  previewImageContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    height: PREVIEW_HEIGHT,
    width: PREVIEW_WIDTH,
    position: 'relative',
    backgroundColor: '#000',
  },
  previewBannerImage: {
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  previewPhoneImage: {
    position: 'absolute',
    width: PREVIEW_HEIGHT * 1.4,
    height: PREVIEW_HEIGHT * 1.7,
    top: PREVIEW_HEIGHT * 0.075,
    left: PREVIEW_WIDTH * 0.6,
  },
  previewPhoneLeft: {
    left: 0,
  },
  previewPhoneRight: {
    right: 0,
  },
  previewTextContainer: {
    position: 'absolute',
    top: PREVIEW_HEIGHT * 0.1,
    maxWidth: PREVIEW_WIDTH * 0.52,
    paddingHorizontal: 14,
  },
  previewTextLeft: {
    left: 0,
    alignItems: 'flex-start',
  },
  previewTextRight: {
    right: 0,
    alignItems: 'flex-end',
  },
  previewMainText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#14F195',
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
    lineHeight: 20,
  },
  previewFootnoteText: {
    fontSize: 9,
    fontWeight: '500',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 2,
    lineHeight: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  uploadingText: { color: '#14F195', fontSize: 13, fontWeight: '600' },

  randomizeSection: {
    marginHorizontal: 24,
    marginBottom: 20,
  },
  randomizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#14F195',
    backgroundColor: '#0d1f17',
    gap: 12,
  },
  randomizeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14F195',
  },
  randomizeButtonTextDisabled: {
    color: '#666',
  },

  successBox: {
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#0d1f17',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#14F195',
  },
  successTitle: { fontSize: 20, fontWeight: '700', color: '#14F195', marginBottom: 6 },
  successText: { fontSize: 14, color: '#aaa', marginBottom: 16 },
  successActions: { flexDirection: 'row', gap: 12 },

  errorBox: {
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#1f0d0d',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  errorTitle: { fontSize: 16, fontWeight: '700', color: '#ff6666', marginBottom: 6 },
  errorText: { fontSize: 13, color: '#aaa', marginBottom: 16, lineHeight: 18 },

  outlineButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#444',
  },
  outlineButtonText: { color: '#fff', fontSize: 14, fontWeight: '500' },

  buttonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  primaryButton: {
    marginHorizontal: 24,
    marginBottom: 32,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#14F195',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: { backgroundColor: '#1a2e24', opacity: 0.5 },
  primaryButtonText: { color: '#000', fontSize: 16, fontWeight: '700' },

  offScreen: {
    position: 'absolute',
    left: -10000,
    top: -10000,
  },
})
