/**
 * X (Twitter) Banner Service
 * Handles banner upload and user authentication
 */

import { File } from 'expo-file-system'
import { buildOAuth1Header, type OAuth1Credentials } from './oauth1'

const X_API_BASE_URL = 'https://api.twitter.com/1.1'
const BANNER_WIDTH = 1500
const BANNER_HEIGHT = 500

/** OAuth 1.0a credentials required for user-context X API calls */
export type XAuthCredentials = OAuth1Credentials

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Upload banner to X/Twitter using OAuth 1.0a.
 *
 * Uses POST /1.1/account/update_profile_banner.json which accepts the image
 * as a base64-encoded `banner` body parameter — no separate media upload step.
 */
export async function uploadBannerToX(imageUri: string, credentials: XAuthCredentials): Promise<boolean> {
  const UPLOAD_URL = `${X_API_BASE_URL}/account/update_profile_banner.json`

  const file = new File(imageUri)
  const arrayBuffer = await file.arrayBuffer()
  const base64Image = arrayBufferToBase64(arrayBuffer)

  const bodyParams: Record<string, string> = {
    banner: base64Image,
    height: String(BANNER_HEIGHT),
    offset_left: '0',
    offset_top: '0',
    width: String(BANNER_WIDTH),
  }

  const authHeader = buildOAuth1Header('POST', UPLOAD_URL, credentials, bodyParams)

  const formBody = Object.entries(bodyParams)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Banner update failed (${response.status}): ${body}`)
  }

  return true
}

/**
 * Get the authenticated user's profile info using their OAuth 1.0a credentials.
 * Uses GET /1.1/account/verify_credentials.json
 */
export async function getAuthenticatedUser(
  credentials: XAuthCredentials,
): Promise<{ username: string; bannerUrl: string | null }> {
  const url = `${X_API_BASE_URL}/account/verify_credentials.json`
  const authHeader = buildOAuth1Header('GET', url, credentials)

  const response = await fetch(url, {
    headers: { Authorization: authHeader },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Connect to X failed (${response.status}): ${body}`)
  }

  const data = await response.json()
  return {
    username: data.screen_name as string,
    bannerUrl: (data.profile_banner_url as string) || null,
  }
}
