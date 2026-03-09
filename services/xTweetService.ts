/**
 * X (Twitter) Tweet Service
 * Handles posting tweets for handshake interactions
 */

import { buildOAuth1Header, type OAuth1Credentials } from './oauth1'

const X_API_BASE_URL = 'https://api.twitter.com/2'

export type XAuthCredentials = OAuth1Credentials

/**
 * Tweet templates for handshake interactions WITH @username mention
 */
export const HANDSHAKE_TWEET_TEMPLATES = [
  "Just had an IRL connection with @{username} using the Seeker Mobile handshake feature! 🤝✨ Meeting fellow Seekers in the wild is what it's all about. #EchoSeeker #ProofOfSeeker",

  'IRL vibes only! 🌟 Just handshaked with @{username} via Seeker Mobile. Nothing beats meeting real people in the real world. #EchoSeeker #IRLConnections',

  'Seeker spotted! 📡 Connected with @{username} through NFC handshake. The future of IRL networking is here. #EchoSeeker #SeekerNetwork',

  "Real connections, real people! Just met @{username} IRL using Seeker Mobile's handshake feature. This is the way. 🚀 #EchoSeeker #ProofOfSeeker",

  'From digital to physical! ⚡ Just completed a Seeker handshake with @{username}. Building connections one tap at a time. #EchoSeeker #NFCHandshake',
]

/**
 * Generic tweet templates WITHOUT @username mention (fallback when pairing fails)
 */
export const GENERIC_HANDSHAKE_TWEET_TEMPLATES = [
  "Just completed an IRL Seeker handshake! 🤝✨ Meeting fellow Seekers in the wild is what it's all about. #EchoSeeker #ProofOfSeeker",

  'IRL vibes only! 🌟 Just completed a Seeker Mobile NFC handshake. Nothing beats meeting real people in the real world. #EchoSeeker #IRLConnections',

  'Seeker spotted! 📡 Just completed an NFC handshake with a fellow Seeker. The future of IRL networking is here. #EchoSeeker #SeekerNetwork',

  'Real connections, real people! Just completed a Seeker handshake IRL. This is the way. 🚀 #EchoSeeker #ProofOfSeeker',

  'From digital to physical! ⚡ Just completed a Seeker NFC handshake. Building connections one tap at a time. #EchoSeeker #NFCHandshake',
]

/**
 * Get a random tweet template and format it with the username
 * If username is null/empty, uses generic template without @mention
 */
export function getRandomHandshakeTweet(username: string | null): string {
  const MAX_TWEET_LENGTH = 280

  // If no username provided, use generic templates
  if (!username || username.trim() === '') {
    const randomIndex = Math.floor(Math.random() * GENERIC_HANDSHAKE_TWEET_TEMPLATES.length)
    return GENERIC_HANDSHAKE_TWEET_TEMPLATES[randomIndex]
  }

  const randomIndex = Math.floor(Math.random() * HANDSHAKE_TWEET_TEMPLATES.length)
  const template = HANDSHAKE_TWEET_TEMPLATES[randomIndex]
  let tweet = template.replace('{username}', username)

  // Check if tweet exceeds character limit
  if (tweet.length > MAX_TWEET_LENGTH) {
    // Try a simpler fallback template
    const fallbackTemplate = 'Just connected with @{username} via Seeker Mobile! 🤝 #EchoSeeker #ProofOfSeeker'
    tweet = fallbackTemplate.replace('{username}', username)

    // If still too long, truncate the username itself
    if (tweet.length > MAX_TWEET_LENGTH) {
      const overflow = tweet.length - MAX_TWEET_LENGTH
      const maxUsernameLength = username.length - overflow - 3 // -3 for ellipsis

      if (maxUsernameLength > 0) {
        const truncatedUsername = username.substring(0, maxUsernameLength) + '...'
        tweet = fallbackTemplate.replace('{username}', truncatedUsername)
      } else {
        // Username is extremely long, use generic message
        tweet = 'Just completed a Seeker handshake! 🤝 #EchoSeeker #ProofOfSeeker'
      }
    }
  }

  return tweet
}

/**
 * Post a tweet using OAuth 1.0a credentials
 * Uses POST /2/tweets endpoint
 */
export async function postTweet(text: string, credentials: XAuthCredentials): Promise<{ id: string; text: string }> {
  // Validate tweet length before posting
  const MAX_TWEET_LENGTH = 280
  if (text.length > MAX_TWEET_LENGTH) {
    throw new Error(`Tweet exceeds ${MAX_TWEET_LENGTH} character limit (${text.length} characters)`)
  }

  const url = `${X_API_BASE_URL}/tweets`

  const bodyData = { text }
  const bodyString = JSON.stringify(bodyData)

  // For POST requests with JSON body, we need to include empty body params for signature
  const authHeader = buildOAuth1Header('POST', url, credentials, {})

  console.log('[xTweetService] Posting tweet:', text)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: bodyString,
  })

  if (!response.ok) {
    const body = await response.text()
    console.error('[xTweetService] Tweet post failed:', response.status, body)
    throw new Error(`Failed to post tweet (${response.status}): ${body}`)
  }

  const data = await response.json()
  console.log('[xTweetService] Tweet posted successfully:', data.data.id)

  return {
    id: data.data.id,
    text: data.data.text,
  }
}

/**
 * Post a handshake tweet with a random template
 */
export async function postHandshakeTweet(
  otherUsername: string,
  credentials: XAuthCredentials,
): Promise<{ id: string; text: string }> {
  const tweetText = getRandomHandshakeTweet(otherUsername)
  return await postTweet(tweetText, credentials)
}
