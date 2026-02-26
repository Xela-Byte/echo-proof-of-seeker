/**
 * Banner Overlay Service
 * Generates Twitter banners with phone overlays and text using react-native-view-shot
 */

import { File, Paths } from 'expo-file-system'

export const BANNER_WIDTH = 1500
export const BANNER_HEIGHT = 500

export type PhonePosition = 'left' | 'right'
export type PhoneAsset = 'phone_1' | 'phone_2'

export interface OverlayConfig {
  phoneAsset: PhoneAsset
  phonePosition: PhonePosition
  mainText: string
  footnoteText: string
}

/**
 * Download the user's Twitter banner image to local file system
 */
export async function downloadBannerImage(bannerUrl: string): Promise<string> {
  // Twitter banner URLs often don't include the size suffix, so we add it
  const fullSizeUrl = bannerUrl.includes('/1500x500') ? bannerUrl : `${bannerUrl}/1500x500`

  const cacheFile = new File(Paths.cache, `user-banner-${Date.now()}.jpg`)

  // Download file directly using expo-file-system
  await File.downloadFileAsync(fullSizeUrl, cacheFile)

  return cacheFile.uri
}

/**
 * Get phone asset module based on asset name
 */
export function getPhoneAssetModule(phoneAsset: PhoneAsset): number {
  return phoneAsset === 'phone_1' ? require('../src/assets/phone_1.png') : require('../src/assets/phone_2.png')
}

/**
 * Cleanup temporary banner files
 */
export async function cleanupTempBanners(): Promise<void> {
  try {
    const cacheDir = Paths.cache
    const files = await cacheDir.list()

    const bannerFiles = files.filter((f) => f.name.startsWith('user-banner-') || f.name.startsWith('generated-banner-'))

    await Promise.all(
      bannerFiles.map(async (f) => {
        try {
          // @ts-ignore - delete method may not be in types yet
          await f.delete()
        } catch (err) {
          console.warn(`Failed to delete ${f.name}:`, err)
        }
      }),
    )
  } catch (err) {
    console.warn('Failed to cleanup temp banners:', err)
  }
}

/**
 * Get default overlay config
 */
export function getDefaultOverlayConfig(): OverlayConfig {
  return {
    phoneAsset: 'phone_1',
    phonePosition: 'right',
    mainText: 'Your Solana identity, powered by Echo',
    footnoteText: 'Generated on Echo, download on Solana Seeker dApp Store',
  }
}
