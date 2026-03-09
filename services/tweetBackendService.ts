/**
 * Backend Tweet Service Client
 * Handles communication with the Node.js backend for queuing tweet posts
 */

import axios from 'axios'
import * as Device from 'expo-device'
import type { XAuthCredentials } from './xTweetService'

const BACKEND_URL = process.env.EXPO_PUBLIC_TWEET_BACKEND_URL || 'http://localhost:3000'

// Log the backend URL for debugging
console.log('[tweetBackendService] Backend URL:', BACKEND_URL)

export interface TweetJobRequest {
  username: string
  credentials: {
    consumerKey: string
    consumerSecret: string
    accessToken: string
    accessTokenSecret: string
  }
  deviceId?: string
}

export interface TweetJobResponse {
  jobId: string
  status: string
  message: string
}

export interface TweetStatusResponse {
  jobId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  tweetId?: string
  tweetText?: string
  error?: string
  createdAt: string
  completedAt?: string
}

export interface HandshakePairRequest {
  myUsername: string
  handshakeId: string
  deviceId?: string
}

export interface HandshakePairResponse {
  success: boolean
  pairedUsername?: string
  message: string
}

/**
 * Queue a handshake tweet for posting via the backend service
 * Returns immediately after queuing (non-blocking)
 */
export async function queueHandshakeTweet(username: string, credentials: XAuthCredentials): Promise<TweetJobResponse> {
  try {
    console.log('[tweetBackendService] Queuing tweet to:', `${BACKEND_URL}/api/tweet/handshake`)
    console.log('[tweetBackendService] Username:', username)

    const response = await axios.post<TweetJobResponse>(
      `${BACKEND_URL}/api/tweet/handshake`,
      {
        username,
        credentials,
        deviceId: Device.osInternalBuildId,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000, // 10 second timeout for queuing
      },
    )
    console.log('[tweetBackendService] Tweet queued successfully:', response.data.jobId)
    return response.data
  } catch (error) {
    console.error('[tweetBackendService] Full error:', error)
    if (axios.isAxiosError(error)) {
      console.error('[tweetBackendService] Axios error code:', error.code)
      console.error('[tweetBackendService] Axios error message:', error.message)
      console.error('[tweetBackendService] Response status:', error.response?.status)
      console.error('[tweetBackendService] Response data:', error.response?.data)

      const message = error.response?.data?.message || error.message || 'Failed to queue tweet'
      console.error('[tweetBackendService] Failed to queue tweet:', message)
      throw new Error(message)
    }
    console.error('[tweetBackendService] Unexpected error:', error)
    throw error
  }
}

/**
 * Get the status of a queued tweet job
 */
export async function getTweetStatus(jobId: string): Promise<TweetStatusResponse> {
  try {
    const response = await axios.get<TweetStatusResponse>(`${BACKEND_URL}/api/tweet/status/${jobId}`, {
      timeout: 5000, // 5 second timeout for status check
    })
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message || 'Failed to get tweet status'
      throw new Error(message)
    }
    throw error
  }
}

/**
 * Register handshake and attempt to pair with another device
 * Returns the paired user's username if found within timeout
 */
export async function registerHandshakePair(myUsername: string, handshakeId: string): Promise<HandshakePairResponse> {
  try {
    console.log('[tweetBackendService] Registering handshake pair:', { myUsername, handshakeId })

    const response = await axios.post<HandshakePairResponse>(
      `${BACKEND_URL}/api/handshake/pair`,
      {
        myUsername,
        handshakeId,
        deviceId: Device.osInternalBuildId,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 8000, // 8 second timeout for pairing
      },
    )

    console.log('[tweetBackendService] Pairing response:', response.data)
    return response.data
  } catch (error) {
    console.error('[tweetBackendService] Pairing failed:', error)
    // Return unsuccessful pairing, app will post generic tweet
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Pairing timeout',
    }
  }
}

/**
 * Poll for tweet completion with exponential backoff
 * Waits until the tweet is either completed or failed
 *
 * @param jobId - The job ID to poll
 * @param maxAttempts - Maximum number of polling attempts (default: 30)
 * @param initialIntervalMs - Initial polling interval in milliseconds (default: 1000)
 * @returns Promise that resolves when tweet is completed or failed
 */
export async function waitForTweetCompletion(
  jobId: string,
  maxAttempts: number = 30,
  initialIntervalMs: number = 1000,
): Promise<TweetStatusResponse> {
  let attempt = 0

  console.log('[tweetBackendService] Starting to poll for tweet completion:', jobId)

  while (attempt < maxAttempts) {
    try {
      const status = await getTweetStatus(jobId)

      console.log(`[tweetBackendService] Poll attempt ${attempt + 1}/${maxAttempts}, status: ${status.status}`)

      if (status.status === 'completed' || status.status === 'failed') {
        console.log('[tweetBackendService] Tweet processing finished:', status.status)
        return status
      }

      // Exponential backoff with max delay of 5 seconds
      const delay = Math.min(initialIntervalMs * Math.pow(1.5, attempt), 5000)
      await new Promise((resolve) => setTimeout(resolve, delay))
      attempt++
    } catch (error) {
      console.error('[tweetBackendService] Error polling tweet status:', error)
      // Wait 2 seconds before retrying on error
      await new Promise((resolve) => setTimeout(resolve, 2000))
      attempt++
    }
  }

  throw new Error('Tweet status polling timeout - check backend service')
}
