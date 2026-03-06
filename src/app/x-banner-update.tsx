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
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SvgXml } from 'react-native-svg'
import ViewShot from 'react-native-view-shot'
import {
  getDefaultOverlayConfig,
  type OverlayConfig,
  type PhoneAsset,
  type PhonePosition,
} from '../../services/bannerOverlayService'
import { useXBannerUpdate } from '../../services/useXBannerUpdate'
import { getAuthenticatedUser, type XAuthCredentials } from '../../services/xBannerService'
import { buildAuthorizationUrl, getOAuthRequestToken } from '../../services/xOAuthFlow'
import { BannerComposer } from '../components/BannerComposer'
import BrutalistBox from '../components/BrutalistBox'

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

// SVG scribble decorations (inline for simplicity)
const scrSparkSvg = `<svg width="60" height="60" viewBox="0 0 194 195" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M59.8843 35.9229C61.4674 38.5554 63.3298 41.0397 65.5104 43.1886C66.5968 44.265 67.7414 45.2751 68.9674 46.176C70.1935 47.073 71.4778 47.8764 72.8203 48.5667C73.9532 49.1556 75.1366 49.6236 76.3356 50.037L76.4636 50.0799C77.744 50.5245 78.4269 51.9285 77.9846 53.2155C77.7595 53.8746 77.2784 54.3777 76.6964 54.6507C74.7021 55.5789 72.6884 56.3979 70.76 57.2325C69.08 57.9618 67.4659 58.6833 65.9682 59.5062C64.4666 60.3213 63.097 61.2651 61.8205 62.3454C61.5023 62.6145 61.1842 62.8875 60.8854 63.1839L60.4276 63.6168C60.2801 63.7611 60.1792 63.8976 60.0551 64.0341C59.8145 64.311 59.5623 64.5606 59.3373 64.9077C59.1083 65.2392 58.8639 65.5356 58.6466 65.8944L57.9948 66.963C57.7814 67.3257 57.5874 67.7157 57.3856 68.0901L57.083 68.6556L56.8036 69.2484L56.2449 70.4301C54.8248 73.6515 53.6492 77.0523 52.6637 80.4999C52.1903 82.2276 51.7286 83.9631 51.3678 85.7025C51.0069 87.4341 50.681 89.1852 50.5219 90.8388C50.3667 92.4573 48.935 93.6429 47.3248 93.4869C46.0987 93.366 45.121 92.5041 44.795 91.3809L44.7873 91.3458C44.1781 89.232 43.794 87.2235 43.4176 85.2306L42.3662 79.3377C41.7919 76.1436 41.1789 72.9924 40.3292 70.0518C39.8946 68.5971 39.3863 67.2009 38.7927 65.9958L38.3232 65.1612C38.1369 64.8765 37.9313 64.584 37.7373 64.2954C37.3183 63.726 36.8837 63.1605 36.3948 62.6223C35.4365 61.5381 34.3617 60.5124 33.2093 59.5491C32.0492 58.5975 30.8193 57.7044 29.5389 56.8737C26.9781 55.2162 24.2116 53.8122 21.3792 52.7007C19.7884 52.0767 19.0008 50.271 19.6255 48.672C19.9436 47.8491 20.5722 47.2407 21.3249 46.9287L21.3521 46.917C23.5908 45.9966 25.8257 45.0723 27.9093 43.9842C30.0316 42.939 31.9833 41.7144 33.7797 40.3533L35.095 39.3003L36.3017 38.1498C36.7246 37.7832 37.0661 37.3464 37.4347 36.933C37.7878 36.5079 38.1913 36.1218 38.4939 35.6499L39.4678 34.2966C39.7743 33.8286 40.042 33.3294 40.333 32.8536L40.7637 32.1282C40.8956 31.8747 41.012 31.6134 41.1362 31.3599L41.8773 29.8194C43.146 26.871 44.2557 23.7042 45.2024 20.5062C45.412 19.734 45.637 19.032 45.8776 18.4002C45.9978 18.0843 46.122 17.784 46.25 17.4993C46.285 17.4135 46.3044 17.394 46.3315 17.355C46.3548 17.3199 46.382 17.2848 46.4091 17.2536C46.4634 17.1873 46.5216 17.1249 46.5876 17.0625C46.8437 16.8129 47.1968 16.5555 47.5382 16.1967C47.8835 15.8418 48.2056 15.4011 48.4616 14.937C49.2066 13.5603 49.3075 12.7374 49.7847 13.2717C49.9011 13.4082 50.0408 13.6383 50.196 13.9971C50.3512 14.352 50.518 14.8473 50.6383 15.4791C50.7586 16.107 50.8168 16.8636 50.7896 17.6553C50.7819 17.8503 50.7702 18.0609 50.7586 18.2442C50.747 18.3768 50.7392 18.5133 50.7276 18.6537C50.7043 18.9345 50.6732 19.2231 50.6344 19.5234C50.5413 20.2839 50.4288 21.0561 50.3046 21.84C50.1727 22.6239 49.971 23.4117 49.7886 24.2034C49.451 25.7907 48.8807 27.3663 48.3685 28.8873C48.1008 29.5737 47.8059 30.2523 47.5266 30.9348L47.1036 31.9566L46.607 32.955C46.2656 33.618 45.9552 34.2927 45.5865 34.9401L44.4187 36.8628C42.7619 39.3744 40.756 41.6793 38.4862 43.6371L36.7402 45.0372C36.1465 45.4818 35.5296 45.8796 34.9204 46.3047C34.319 46.7415 33.6866 47.0964 33.058 47.4708C32.4295 47.8413 31.8087 48.2352 31.1646 48.5511L29.2517 49.5573L27.3195 50.4777L26.3534 50.934L25.3834 51.3591L23.4395 52.2132L23.4162 47.3694C26.3767 48.4575 29.2246 49.7796 31.9639 51.3552C33.7448 52.3809 35.5218 53.5236 37.1863 54.8496C38.8509 56.1717 40.399 57.681 41.6639 59.3892C42.0751 59.982 42.5058 60.5475 42.8783 61.1754C43.0684 61.4913 43.2702 61.7682 43.4487 62.1192L43.9802 63.141C44.1742 63.4842 44.279 63.8157 44.4303 64.155C44.5661 64.4904 44.7213 64.8297 44.8377 65.1612C45.055 65.8242 45.3188 66.495 45.4973 67.1502C46.2888 69.7866 46.8243 72.3762 47.317 74.9424C47.802 77.5086 48.2211 80.0553 48.6518 82.5591C49.0863 85.0551 49.5209 87.5472 50.1184 89.7975L44.9852 90.2499C45.218 88.1985 45.6254 86.2953 46.0832 84.3999C46.638 82.1379 47.2782 79.9227 47.9883 77.7192C48.6944 75.5157 49.4665 73.3317 50.3589 71.175C51.2514 69.0183 52.2058 66.8772 53.4319 64.7907C54.0488 63.7494 54.7084 62.7159 55.5038 61.7097C55.6008 61.5849 55.6901 61.4562 55.7987 61.3314L56.1363 60.9609L56.8192 60.2277C57.0481 59.982 57.2692 59.8065 57.4982 59.5959C57.7271 59.3931 57.9444 59.1825 58.181 58.9914C59.4188 57.9267 60.7729 56.979 62.1736 56.1483C63.5742 55.3176 65.0176 54.6195 66.4454 53.9955C69.3089 52.7553 72.0714 51.7413 74.7021 50.4972L75.0086 54.4245C72.4478 53.5977 70.0189 52.4238 67.7763 50.9964C65.5453 49.5495 63.5044 47.853 61.6536 45.9888C59.8145 44.1129 58.1733 42.0615 56.7183 39.8931C55.2672 37.7286 54.0411 35.3847 53.009 33.0213C51.6937 29.9832 50.7819 26.9178 50.1921 23.9421C49.5946 20.9664 49.323 18.0726 49.3191 15.327C49.323 14.2935 49.5442 13.6695 49.8662 13.4979L49.5131 14.3949C49.4278 14.4729 49.2997 14.5431 49.1717 14.5743C49.0436 14.6055 48.9234 14.6055 48.838 14.5977C48.6634 14.5782 48.5974 14.5548 48.5819 14.5782C48.5742 14.5977 48.6207 14.6718 48.8147 14.7459C48.9117 14.781 49.0514 14.8122 49.2143 14.7966C49.3773 14.7849 49.5558 14.7264 49.6877 14.6445L50.1611 13.4394C50.5801 13.4862 51.0729 14.1453 51.4919 15.4206C52.7452 19.2426 54.0411 23.1972 55.5543 26.9607C56.7881 30.0495 58.0763 33.1734 59.7873 35.9268C59.8145 35.919 59.8417 35.9112 59.8766 35.9034L59.8843 35.9229Z" fill="#0A0A18"/></svg>`

const scrArrowSvg = `<svg width="80" height="80" viewBox="0 0 230 228" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M126.412 155.281L120.075 148.582C119.009 147.476 117.98 146.335 116.951 145.194L113.853 141.782C112.761 140.573 111.647 139.38 110.562 138.16C109.483 136.936 108.394 135.722 107.285 134.531C105.809 132.938 104.314 131.362 102.85 129.759L98.5119 124.901C95.5848 121.691 92.8019 118.358 89.9777 115.058L87.869 112.575L85.8154 110.047L81.7132 104.986L80.6912 103.718L79.6976 102.427L77.7122 99.8451L73.7548 94.669L69.0463 88.1733C68.2666 87.0871 67.4705 86.0121 66.7054 84.9157L64.4338 81.6097C62.9285 79.3997 61.3897 77.2118 59.9161 74.9808L55.5419 68.2575C49.8019 59.2363 44.2719 50.0783 39.1567 40.6942C38.3757 39.284 37.6375 37.8415 36.9257 36.3919C36.2378 34.9293 35.5914 33.4513 34.9452 31.9947C33.7131 29.2006 33.4318 27.1322 33.6957 25.6351C34.0813 23.4571 36.2104 24.3894 38.5173 28.0085C39.2479 29.1544 39.959 30.3801 40.642 31.6337C41.3106 32.8946 41.9846 34.1657 42.6399 35.4017C48.4989 46.8608 55.2097 57.872 62.7166 68.3442C63.7494 69.7875 64.8032 71.2603 65.8499 72.7233C66.9116 74.1754 67.9314 75.6398 68.829 77.115C71.652 81.8584 74.9031 86.3399 78.1317 90.8354C79.7839 93.0561 81.4778 95.247 83.1392 97.4602C83.9767 98.5617 84.7922 99.6794 85.6362 100.775L88.1643 104.063C89.4049 105.7 90.6583 107.33 91.9245 108.954C93.2058 110.566 94.5304 112.145 95.8382 113.738L99.783 118.502L103.808 123.196C113.346 134.373 123.342 145.174 133.84 155.491C134.888 156.519 135.903 157.55 136.883 158.584C137.377 159.097 137.842 159.631 138.302 160.159C138.773 160.677 139.235 161.195 139.688 161.712C141.497 163.782 143.15 165.851 144.626 167.9C145.979 169.788 145.142 170.499 142.95 168.971C141.403 167.887 139.831 166.757 138.256 165.599C136.691 164.429 135.07 163.284 133.597 161.99C131.172 159.863 128.847 157.507 126.498 155.236L126.412 155.281Z" fill="#0A0A18"/></svg>`

const scrSmileSvg = `<svg width="70" height="70" viewBox="0 0 194 195" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M132.305 31.5302C135.744 33.4455 139.05 35.6154 142.169 38.0494C145.281 40.4846 148.23 43.1785 150.86 46.1653C156.1 52.0721 160.354 58.7426 163.675 65.8173C167.204 73.3223 169.63 81.3469 171.017 89.5234C171.461 92.256 171.787 95.0125 171.958 97.7874C172.11 100.564 172.12 103.354 171.967 106.146C171.808 108.938 171.447 111.727 170.917 114.492C170.77 115.181 170.654 115.876 170.48 116.561L169.966 118.616L169.359 120.652C169.168 121.334 168.9 121.994 168.673 122.667C168.552 123 168.442 123.338 168.312 123.668L167.907 124.656C167.637 125.314 167.371 125.983 167.077 126.596L166.215 128.474C165.918 129.096 165.604 129.711 165.299 130.329L164.838 131.255L164.349 132.168C164.02 132.775 163.7 133.387 163.362 133.99C162.667 135.185 161.989 136.39 161.24 137.554C160.524 138.739 159.73 139.876 158.961 141.028C158.149 142.151 157.355 143.289 156.491 144.376C154.793 146.572 152.986 148.69 151.049 150.688C149.116 152.689 147.09 154.607 144.942 156.385C142.795 158.162 140.55 159.825 138.218 161.357C133.553 164.422 128.515 166.913 123.277 168.834C118.029 170.732 112.571 172.024 107.045 172.722C101.515 173.4 95.9213 173.474 90.3815 172.98C76.7396 171.724 63.453 166.976 52.0807 159.29C46.3958 155.449 41.1884 150.881 36.6431 145.717L35.7921 144.748L34.9588 143.733C34.3945 143.063 33.8673 142.362 33.3427 141.66C32.2884 140.259 31.3211 138.794 30.3905 137.307C28.5588 134.315 27.0041 131.158 25.7205 127.902C23.1362 121.388 21.7478 114.469 21.3061 107.557C20.8953 100.635 21.4454 93.7042 22.8029 86.9687C25.5447 73.4976 31.3878 60.76 39.757 49.8996C44.8186 43.3529 51.1174 37.6544 58.0247 33.2842C61.3444 31.2039 64.3268 29.9087 66.8515 29.1372C68.1095 28.7392 69.272 28.5069 70.3016 28.3323C71.3488 28.1987 72.2617 28.1137 73.0818 28.1445C75.4624 28.2197 75.6813 29.1032 74.2187 30.4173C74.0357 30.5822 73.8253 30.7515 73.5906 30.9311C73.3585 31.1181 73.1009 31.3121 72.8184 31.5124C72.5359 31.7128 72.2283 31.9192 71.8964 32.1317C71.5697 32.357 71.2189 32.5889 70.8443 32.8266C69.3484 33.7824 67.5007 34.8994 65.3835 36.2687C60.0095 39.6995 54.5663 44.1134 49.9795 48.9217C44.6799 54.4336 40.219 60.8042 36.7354 67.6714C33.2407 74.5339 30.7149 81.9052 29.3305 89.4647C28.6266 93.2425 28.2415 97.0694 28.1384 100.891C28.0674 104.713 28.2815 108.533 28.8735 112.282C30.0301 119.78 32.6226 127.005 36.6371 133.294C37.7538 135.022 38.9801 136.698 40.2956 138.307C41.6128 139.891 43.0853 141.469 44.5569 142.977C47.5463 145.975 50.7102 148.743 53.9197 151.24C56.4762 153.243 59.1826 155.068 62.0071 156.699C64.8345 158.326 67.7824 159.752 70.814 160.975C76.8773 163.424 83.2847 165.051 89.7885 165.766C102.794 167.245 116.164 165.074 127.909 159.432C136.658 155.271 144.435 149.034 150.625 141.44C152.161 139.532 153.636 137.568 154.996 135.52C156.343 133.464 157.645 131.373 158.805 129.195L159.25 128.385L159.672 127.561L160.513 125.911L161.303 124.235L161.699 123.397L162.05 122.57C162.274 122.015 162.536 121.477 162.731 120.909L163.35 119.22C163.71 118.073 164.09 116.933 164.374 115.759C164.671 114.726 164.864 113.663 165.101 112.611L165.378 111.014L165.516 110.215L165.618 109.409C165.934 107.266 166.055 105.09 166.14 102.914C166.228 98.5565 165.938 94.1667 165.212 89.8329C164.882 87.6608 164.394 85.5134 163.886 83.3722C163.325 81.2442 162.738 79.1187 162.01 77.0379C160.608 72.8584 158.838 68.8025 156.774 64.9089C152.625 57.1479 147.25 49.9707 140.548 44.3857C133.839 38.7531 125.94 34.5102 117.613 31.6162C110.954 29.3224 104.225 27.8677 97.6768 27.1735C91.1252 26.481 84.7508 26.5535 78.711 27.3612C78.0189 27.4633 77.4032 27.5056 76.8835 27.5562C76.3633 27.605 75.9264 27.6168 75.5755 27.5952C74.8739 27.5519 74.5161 27.3752 74.5315 27.0913C74.5467 26.8076 74.9361 26.4161 75.7261 25.9458C76.1211 25.7111 76.614 25.4479 77.2199 25.2152C77.8249 24.9806 78.5262 24.7008 79.3429 24.4772C81.6476 23.7982 84.029 23.3064 86.4481 22.9084C88.8706 22.5463 91.3331 22.3155 93.8141 22.2173C98.7743 22.055 103.799 22.4116 108.72 23.2795C116.831 24.6671 124.824 27.6609 132.189 31.5903C132.226 31.5689 132.262 31.5496 132.305 31.5302Z" fill="#0A0A18"/></svg>`

const scrCirclySvg = `<svg width="80" height="80" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="100" cy="100" r="90" stroke="#0A0A18" stroke-width="4" fill="none"/></svg>`

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
      checkOAuthResult()
    }, [reset]),
  )

  // ── Check for OAuth result after redirect ─────────────────────────────────
  const checkOAuthResult = async () => {
    try {
      const resultData = await AsyncStorage.getItem('x_oauth_result')
      if (!resultData) return

      const result = JSON.parse(resultData)
      await AsyncStorage.removeItem('x_oauth_result')

      if (result.success) {
        // OAuth succeeded, load the credentials
        const stored = await AsyncStorage.getItem(STORAGE_KEY)
        if (stored) {
          const creds: StoredCredentials = JSON.parse(stored)
          setUserCredentials({
            consumerKey: CONSUMER_KEY,
            consumerSecret: CONSUMER_SECRET,
            accessToken: creds.accessToken,
            accessTokenSecret: creds.accessTokenSecret,
          })
          setConnectedUsername(creds.screenName)
          setUserBannerUrl(result.bannerUrl)
          setXConnected(true)
          console.log('[OAuth] Successfully connected as', creds.screenName)
        }
      } else if (result.error) {
        // OAuth failed
        setConnectError(result.error)
      }
    } catch (err) {
      console.error('[OAuth] Failed to check result:', err)
    }
  }

  // ── OAuth sign-in ─────────────────────────────────────────────────────────
  const handleConnect = async () => {
    setIsConnecting(true)
    setConnectError(null)

    try {
      // Validate environment variables
      if (!CONSUMER_KEY || !CONSUMER_SECRET) {
        throw new Error('X API credentials are not configured. Please check your environment variables.')
      }

      console.log('[OAuth] Requesting OAuth token...')
      const { requestToken, requestTokenSecret } = await getOAuthRequestToken(
        CONSUMER_KEY,
        CONSUMER_SECRET,
        CALLBACK_URL,
      )

      // Store the request token data temporarily so the callback screen can use it
      await AsyncStorage.setItem('x_oauth_temp', JSON.stringify({ requestToken, requestTokenSecret }))
      console.log('[OAuth] Stored temp OAuth data')

      // Open the authorization URL in the system browser
      const authUrl = buildAuthorizationUrl(requestToken)
      console.log('[OAuth] Opening authorization URL:', authUrl)

      const canOpen = await Linking.canOpenURL(authUrl)
      if (!canOpen) {
        throw new Error('Cannot open browser')
      }

      await Linking.openURL(authUrl)
      console.log('[OAuth] Browser opened, waiting for callback...')

      // The user will be redirected to echo://oauth-callback which opens our oauth-callback screen
      // That screen will handle the token exchange and navigate back here
    } catch (err) {
      console.error('OAuth sign-in error:', err)
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8D7BF' }}>
      <ScrollView style={styles.container}>
        <View style={styles.backRowContainer}>
          <TouchableOpacity style={styles.backRow} onPress={() => router.replace('/dashboard')} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="#0A0A18" />
          </TouchableOpacity>
          <SvgXml xml={scrArrowSvg} width="35" height="35" style={styles.scrArrowBack} />
        </View>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Update X Banner</Text>
              <SvgXml xml={scrSmileSvg} width="45" height="45" style={styles.scrSmileTitle} />
            </View>
            <Text style={styles.subtitle}>Overlay your banner with a phone mockup and custom text</Text>
          </View>

          {xConnected ? (
            <View style={styles.connectedGroup}>
              <SvgXml xml={scrCirclySvg} width="40" height="40" style={styles.scrCirclyConnected} />
              <BrutalistBox
                backgroundColor="#0A0A18"
                offset={4}
                borderWidth={2}
                borderColor="#74C69D"
                contentStyle={styles.connectedPillContent}
              >
                <View style={styles.connectedPillInner}>
                  <View style={styles.connectedDot} />
                  <Text style={styles.connectedPillText}>@{connectedUsername}</Text>
                </View>
              </BrutalistBox>
              <TouchableOpacity onPress={handleDisconnect} activeOpacity={0.7} style={styles.signOutWrapper}>
                <Text style={styles.signOutText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <TouchableOpacity
                onPress={handleConnect}
                disabled={isConnecting}
                activeOpacity={0.8}
                style={styles.connectButtonWrapper}
              >
                <BrutalistBox
                  backgroundColor="#0A0A18"
                  offsetColor="#74C69D"
                  offset={4}
                  contentStyle={styles.connectButtonContent}
                >
                  {isConnecting ? (
                    <ActivityIndicator size="small" color="#74C69D" />
                  ) : (
                    <Text style={styles.connectButtonText}>Sign in with X</Text>
                  )}
                </BrutalistBox>
              </TouchableOpacity>
              <SvgXml xml={scrSparkSvg} width="40" height="40" style={styles.scrSparkConnect} />
            </View>
          )}
        </View>

        {/* ── Connect error ─────────────────────────────────────────── */}
        {connectError && (
          <View style={styles.connectErrorContainer}>
            <SvgXml xml={scrArrowSvg} width="30" height="30" style={styles.scrArrowError} />
            <BrutalistBox
              backgroundColor="#0A0A18"
              borderColor="#FF4444"
              offset={4}
              style={styles.connectErrorWrapper}
              contentStyle={styles.connectErrorContent}
            >
              <Text style={styles.connectErrorText}>{connectError}</Text>
              <TouchableOpacity onPress={handleConnect} style={styles.retryWrapper}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </BrutalistBox>
          </View>
        )}

        {/* ── Banner preview ───────────────────────────────────────── */}
        {previewBannerUri && (
          <View style={styles.previewWrapper}>
            <View style={styles.sectionLabelRow}>
              <Text style={styles.sectionLabel}>Preview</Text>
              <SvgXml xml={scrArrowSvg} width="35" height="35" style={styles.scrArrowPreview} />
            </View>
            <BrutalistBox offset={8} contentStyle={styles.previewImageContainer}>
              <Image source={{ uri: previewBannerUri }} style={styles.previewBannerImage} resizeMode="cover" />
              <View style={styles.previewOverlay} />
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
                  <ActivityIndicator size="large" color="#0A0A18" />
                  <Text style={styles.uploadingText}>{stepLabel}</Text>
                </View>
              )}
            </BrutalistBox>
          </View>
        )}

        {/* ── Customization Options ─────────────────────────────────── */}
        {xConnected && !isDone && (
          <View style={styles.randomizeSection}>
            <TouchableOpacity
              onPress={randomizeBanner}
              disabled={isUploading}
              activeOpacity={0.8}
              style={styles.randomizeButtonWrapper}
            >
              <BrutalistBox
                backgroundColor="#74C69D"
                offset={6}
                contentStyle={styles.randomizeButtonContent}
                style={isUploading ? styles.buttonDisabled : undefined}
              >
                <Ionicons name="shuffle" size={24} color="#0A0A18" />
                <Text style={styles.randomizeButtonText}>Randomize Banner</Text>
              </BrutalistBox>
            </TouchableOpacity>
            <SvgXml xml={scrSparkSvg} width="45" height="45" style={styles.scrSparkRandomize} />
            <SvgXml xml={scrCirclySvg} width="50" height="50" style={styles.scrCirclyRandomize} />
          </View>
        )}

        {/* ── Success state ─────────────────────────────────────────── */}
        {isDone && (
          <View style={styles.statusBoxSection}>
            <SvgXml xml={scrSmileSvg} width="50" height="50" style={styles.scrSmileSuccess} />
            <BrutalistBox backgroundColor="#74C69D" offset={8} contentStyle={styles.successBoxContent}>
              <Text style={styles.successTitle}>Done!</Text>
              <Text style={styles.successText}>Your X banner has been updated.</Text>
              <View style={styles.successActions}>
                <TouchableOpacity onPress={shareBanner} style={styles.outlineButtonWrapper}>
                  <BrutalistBox offset={3} borderWidth={2} contentStyle={styles.outlineButtonContent}>
                    <Text style={styles.outlineButtonText}>Share</Text>
                  </BrutalistBox>
                </TouchableOpacity>
                <TouchableOpacity onPress={reset} style={styles.outlineButtonWrapper}>
                  <BrutalistBox offset={3} borderWidth={2} contentStyle={styles.outlineButtonContent}>
                    <Text style={styles.outlineButtonText}>Update Again</Text>
                  </BrutalistBox>
                </TouchableOpacity>
              </View>
            </BrutalistBox>
          </View>
        )}

        {/* ── Error state ───────────────────────────────────────────── */}
        {isError && (
          <View style={styles.statusBoxSection}>
            {' '}
            <SvgXml xml={scrArrowSvg} width="40" height="40" style={styles.scrArrowError2} />
            <SvgXml xml={scrSparkSvg} width="35" height="35" style={styles.scrSparkError} />{' '}
            <BrutalistBox backgroundColor="#F8D7BF" offset={8} contentStyle={styles.errorBoxContent}>
              <Text style={styles.errorTitle}>Something went wrong</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={reset} style={styles.outlineButtonWrapper}>
                <BrutalistBox offset={3} borderWidth={2} contentStyle={styles.outlineButtonContent}>
                  <Text style={styles.outlineButtonText}>Try Again</Text>
                </BrutalistBox>
              </TouchableOpacity>
            </BrutalistBox>
          </View>
        )}

        {/* ── Primary action ────────────────────────────────────────── */}
        {!isDone && (
          <View style={styles.primaryActionWrapper}>
            <TouchableOpacity
              onPress={handleApply}
              disabled={!canUpdate}
              activeOpacity={0.85}
              style={styles.primaryButtonWrapper}
            >
              <BrutalistBox
                backgroundColor="#74C69D"
                offset={8}
                contentStyle={styles.primaryButtonContent}
                style={!canUpdate ? styles.buttonDisabled : undefined}
              >
                {isUploading ? (
                  <View style={styles.buttonRow}>
                    <ActivityIndicator size="small" color="#0A0A18" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryButtonText}>{stepLabel || 'Processing...'}</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {xConnected ? 'Generate & Apply Banner' : 'Sign in with X to Enable'}
                  </Text>
                )}
              </BrutalistBox>
            </TouchableOpacity>
            <SvgXml xml={scrCirclySvg} width="55" height="55" style={styles.scrCirclyApply} />
            <SvgXml xml={scrSparkSvg} width="50" height="50" style={styles.scrSparkApply} />
            <SvgXml xml={scrSmileSvg} width="45" height="45" style={styles.scrSmileApply} />
          </View>
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
  container: { flex: 1, backgroundColor: '#F8D7BF' },
  backRowContainer: {
    position: 'relative',
  },
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
  titleContainer: {
    position: 'relative',
    marginBottom: 6,
  },
  title: { fontSize: 28, fontFamily: 'ClashDisplay-Bold', color: '#0A0A18' },
  subtitle: { fontSize: 14, fontFamily: 'ClashDisplay-Bold', color: '#0A0A18', opacity: 0.6, lineHeight: 20 },

  connectButtonWrapper: {
    marginTop: 4,
    minWidth: 110,
  },
  connectButtonContent: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
  },
  connectButtonText: { color: '#74C69D', fontSize: 13, fontFamily: 'ClashDisplay-Bold' },

  connectedGroup: { marginTop: 4, alignItems: 'flex-end' },
  connectedPillContent: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  connectedPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectedDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#74C69D' },
  connectedPillText: { color: '#74C69D', fontSize: 13, fontFamily: 'ClashDisplay-Bold' },
  signOutWrapper: { marginTop: 4 },
  signOutText: {
    fontSize: 12,
    fontFamily: 'ClashDisplay-Bold',
    color: '#0A0A18',
    opacity: 0.5,
    textDecorationLine: 'underline',
  },

  connectErrorContainer: {
    position: 'relative',
  },
  connectErrorWrapper: {
    marginHorizontal: 24,
    marginBottom: 12,
  },
  connectErrorContent: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  connectErrorText: { flex: 1, fontSize: 12, fontFamily: 'ClashDisplay-Bold', color: '#ff6666', lineHeight: 17 },
  retryWrapper: { paddingLeft: 8 },
  retryText: { fontSize: 13, fontFamily: 'ClashDisplay-Bold', color: '#74C69D' },

  previewWrapper: { marginHorizontal: 24, marginBottom: 20 },
  previewImageContainer: {
    height: PREVIEW_HEIGHT,
    width: '100%',
    overflow: 'hidden',
  },
  previewBannerImage: {
    width: '100%',
    height: PREVIEW_HEIGHT,
    position: 'absolute',
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
    maxWidth: '55%',
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
    fontFamily: 'ClashDisplay-Bold',
    color: '#74C69D',
    marginBottom: 6,
    lineHeight: 20,
  },
  previewFootnoteText: {
    fontSize: 9,
    fontFamily: 'ClashDisplay-Bold',
    color: '#F8D7BF',
    lineHeight: 12,
    textTransform: 'uppercase',
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'ClashDisplay-Bold',
    color: '#0A0A18',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(248, 215, 191, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  uploadingText: { color: '#0A0A18', fontSize: 13, fontFamily: 'ClashDisplay-Bold' },

  randomizeSection: {
    marginHorizontal: 24,
    marginBottom: 20,
  },
  randomizeButtonWrapper: {
    width: '100%',
  },
  randomizeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  randomizeButtonText: {
    fontSize: 16,
    fontFamily: 'ClashDisplay-Bold',
    color: '#0A0A18',
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  statusBoxSection: {
    marginHorizontal: 24,
    marginBottom: 20,
  },
  successBoxContent: {
    padding: 20,
  },
  successTitle: { fontSize: 20, fontFamily: 'ClashDisplay-Bold', color: '#0A0A18', marginBottom: 6 },
  successText: { fontSize: 14, fontFamily: 'ClashDisplay-Medium', color: '#0A0A18', opacity: 0.8, marginBottom: 16 },
  successActions: { flexDirection: 'row', gap: 12 },

  errorBoxContent: {
    padding: 20,
  },
  errorTitle: { fontSize: 16, fontFamily: 'ClashDisplay-Bold', color: '#0A0A18', marginBottom: 6 },
  errorText: {
    fontSize: 13,
    fontFamily: 'ClashDisplay-Medium',
    color: '#0A0A18',
    opacity: 0.8,
    marginBottom: 16,
    lineHeight: 18,
  },

  outlineButtonWrapper: {
    flex: 1,
  },
  outlineButtonContent: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  outlineButtonText: { color: '#0A0A18', fontSize: 14, fontFamily: 'ClashDisplay-Bold' },

  buttonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  primaryActionWrapper: {
    position: 'relative',
  },
  primaryButtonWrapper: {
    marginHorizontal: 24,
    marginBottom: 32,
  },
  primaryButtonContent: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0A0A18',
    fontSize: 18,
    fontFamily: 'ClashDisplay-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Scribble decorations
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  scrArrowBack: {
    position: 'absolute',
    zIndex: -1,
    width: 35,
    height: 35,
    left: 50,
    top: 10,
    opacity: 0.4,
    transform: [{ rotate: '-25deg' }],
  },
  scrSmileTitle: {
    position: 'absolute',
    zIndex: -1,
    width: 45,
    height: 45,
    right: -20,
    top: -10,
    opacity: 0.5,
    transform: [{ rotate: '20deg' }],
  },
  scrCirclyConnected: {
    position: 'absolute',
    zIndex: -1,
    width: 40,
    height: 40,
    right: -10,
    top: -10,
    opacity: 0.4,
    transform: [{ rotate: '-10deg' }],
  },
  scrSparkConnect: {
    position: 'absolute',
    zIndex: -1,
    width: 40,
    height: 40,
    right: -15,
    top: -10,
    opacity: 0.6,
    transform: [{ rotate: '15deg' }],
  },
  scrArrowError: {
    position: 'absolute',
    zIndex: -1,
    width: 30,
    height: 30,
    right: 30,
    top: 5,
    opacity: 0.5,
    transform: [{ rotate: '30deg' }],
  },
  scrArrowPreview: {
    zIndex: -1,
    width: 35,
    height: 35,
    opacity: 0.5,
    transform: [{ rotate: '-5deg' }],
  },
  scrSparkRandomize: {
    position: 'absolute',
    zIndex: -1,
    width: 45,
    height: 45,
    left: -20,
    top: 0,
    opacity: 0.5,
    transform: [{ rotate: '-20deg' }],
  },
  scrCirclyRandomize: {
    position: 'absolute',
    zIndex: -1,
    width: 50,
    height: 50,
    right: -15,
    bottom: -10,
    opacity: 0.3,
    transform: [{ rotate: '25deg' }],
  },
  scrSmileSuccess: {
    position: 'absolute',
    zIndex: -1,
    width: 50,
    height: 50,
    right: 20,
    top: -15,
    opacity: 0.6,
    transform: [{ rotate: '10deg' }],
  },
  scrArrowError2: {
    position: 'absolute',
    zIndex: -1,
    width: 40,
    height: 40,
    left: 15,
    top: -15,
    opacity: 0.4,
    transform: [{ rotate: '-20deg' }],
  },
  scrSparkError: {
    position: 'absolute',
    zIndex: -1,
    width: 35,
    height: 35,
    right: 25,
    bottom: 20,
    opacity: 0.5,
    transform: [{ rotate: '15deg' }],
  },
  scrCirclyApply: {
    position: 'absolute',
    zIndex: -1,
    width: 55,
    height: 55,
    right: 15,
    bottom: 15,
    opacity: 0.4,
    transform: [{ rotate: '-15deg' }],
  },
  scrSparkApply: {
    position: 'absolute',
    zIndex: -1,
    width: 50,
    height: 50,
    left: 10,
    bottom: 25,
    opacity: 0.45,
    transform: [{ rotate: '30deg' }],
  },
  scrSmileApply: {
    position: 'absolute',
    zIndex: -1,
    width: 45,
    height: 45,
    left: 50,
    top: -5,
    opacity: 0.35,
    transform: [{ rotate: '-25deg' }],
  },

  offScreen: {
    position: 'absolute',
    left: -10000,
    top: -10000,
  },
})
