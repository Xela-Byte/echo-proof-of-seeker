import { Asset } from 'expo-asset'
import * as Sharing from 'expo-sharing'
import { useCallback, useState } from 'react'
import type { OverlayConfig } from './bannerOverlayService'
import { uploadBannerToX, type XAuthCredentials } from './xBannerService'

export type UpdateStep = 'idle' | 'downloading' | 'generating' | 'uploading' | 'done' | 'error'

const STEP_LABELS: Record<UpdateStep, string> = {
  idle: '',
  downloading: 'Downloading your banner...',
  generating: 'Generating overlay...',
  uploading: 'Uploading to X...',
  done: 'Banner updated!',
  error: '',
}

export interface UseXBannerUpdateResult {
  step: UpdateStep
  stepLabel: string
  error: string | null
  uploadedUri: string | null
  generatedUri: string | null
  uploadBanner: (assetModule: number, credentials: XAuthCredentials) => Promise<void>
  uploadBannerWithOverlay: (
    userBannerUrl: string | null,
    fallbackAssetModule: number,
    overlayConfig: OverlayConfig,
    credentials: XAuthCredentials,
    captureCallback: (bannerUri: string, config: OverlayConfig) => Promise<string>,
  ) => Promise<void>
  shareBanner: () => Promise<void>
  reset: () => void
}

export function useXBannerUpdate(): UseXBannerUpdateResult {
  const [step, setStep] = useState<UpdateStep>('idle')
  const [error, setError] = useState<string | null>(null)
  const [uploadedUri, setUploadedUri] = useState<string | null>(null)
  const [generatedUri, setGeneratedUri] = useState<string | null>(null)

  const uploadBanner = useCallback(async (assetModule: number, credentials: XAuthCredentials) => {
    setError(null)
    setUploadedUri(null)
    setGeneratedUri(null)
    setStep('uploading')

    try {
      // Resolve the bundled asset to a file:// URI
      const asset = Asset.fromModule(assetModule)
      await asset.downloadAsync()
      const uri = asset.localUri
      if (!uri) throw new Error('Could not resolve banner asset URI')

      await uploadBannerToX(uri, credentials)

      setUploadedUri(uri)
      setStep('done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setStep('error')
      console.error('Banner upload failed:', err)
    }
  }, [])

  const uploadBannerWithOverlay = useCallback(
    async (
      userBannerUrl: string | null,
      fallbackAssetModule: number,
      overlayConfig: OverlayConfig,
      credentials: XAuthCredentials,
      captureCallback: (bannerUri: string, config: OverlayConfig) => Promise<string>,
    ) => {
      setError(null)
      setUploadedUri(null)
      setGeneratedUri(null)

      try {
        // Step 1: Get banner URI (either user's or fallback)
        let bannerUri: string
        if (userBannerUrl) {
          setStep('downloading')
          const { downloadBannerImage } = await import('./bannerOverlayService')
          bannerUri = await downloadBannerImage(userBannerUrl)
        } else {
          // Use fallback banner
          const asset = Asset.fromModule(fallbackAssetModule)
          await asset.downloadAsync()
          bannerUri = asset.localUri!
          if (!bannerUri) throw new Error('Could not resolve fallback banner')
        }

        // Step 2: Generate overlay
        setStep('generating')
        const composedUri = await captureCallback(bannerUri, overlayConfig)
        setGeneratedUri(composedUri)

        // Step 3: Upload to X
        setStep('uploading')
        await uploadBannerToX(composedUri, credentials)

        setUploadedUri(composedUri)
        setStep('done')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        setStep('error')
        console.error('Banner overlay upload failed:', err)
      }
    },
    [],
  )

  const shareBanner = useCallback(async () => {
    if (!uploadedUri) return
    try {
      const available = await Sharing.isAvailableAsync()
      if (available) {
        await Sharing.shareAsync(uploadedUri, {
          mimeType: 'image/jpeg',
          dialogTitle: 'Share your Seeker banner',
        })
      }
    } catch (err) {
      console.error('Share error:', err)
    }
  }, [uploadedUri])

  const reset = useCallback(() => {
    setStep('idle')
    setError(null)
    setUploadedUri(null)
    setGeneratedUri(null)
  }, [])

  return {
    step,
    stepLabel: STEP_LABELS[step],
    error,
    uploadedUri,
    generatedUri,
    uploadBanner,
    uploadBannerWithOverlay,
    shareBanner,
    reset,
  }
}
