/**
 * X (Twitter) OAuth 1.0a — 3-legged sign-in flow
 *
 * Steps:
 *  1. getOAuthRequestToken  → get a temporary request token
 *  2. buildAuthorizationUrl → open in browser so user can sign in
 *  3. getOAuthAccessToken   → exchange the verifier for the user's access token
 */

import QuickCrypto from 'react-native-quick-crypto'

const BASE = 'https://api.twitter.com'

// ── Helpers (duplicated from oauth1.ts to keep this module self-contained) ────

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
}

function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let nonce = ''
  for (let i = 0; i < 32; i++) nonce += chars[Math.floor(Math.random() * chars.length)]
  return nonce
}

function sign(method: string, url: string, params: Record<string, string>, signingKey: string): string {
  const normalizedParams = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join('&')

  const base = [method.toUpperCase(), percentEncode(url), percentEncode(normalizedParams)].join('&')
  const hmac = QuickCrypto.createHmac('sha1', signingKey)
  hmac.update(base)
  return hmac.digest('base64') as string
}

function buildAuthHeader(oauthParams: Record<string, string>): string {
  return (
    'OAuth ' +
    Object.entries(oauthParams)
      .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
      .join(', ')
  )
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Step 1 — Request a temporary token from Twitter.
 * `callbackUrl` is your app's deep-link URI (e.g. "echo://oauth-callback").
 */
export async function getOAuthRequestToken(
  consumerKey: string,
  consumerSecret: string,
  callbackUrl: string,
): Promise<{ requestToken: string; requestTokenSecret: string }> {
  const url = `${BASE}/oauth/request_token`
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = generateNonce()

  const params: Record<string, string> = {
    oauth_callback: callbackUrl,
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_version: '1.0',
  }

  // Signing key for request-token step: consumerSecret + '&' (no token secret yet)
  const signingKey = `${percentEncode(consumerSecret)}&`
  params.oauth_signature = sign('POST', url, params, signingKey)

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: buildAuthHeader(params) },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Request token failed (${response.status}): ${body}`)
  }

  const parsed = Object.fromEntries(new URLSearchParams(await response.text()))
  if (!parsed.oauth_token) throw new Error('No oauth_token in request_token response')

  return {
    requestToken: parsed.oauth_token,
    requestTokenSecret: parsed.oauth_token_secret,
  }
}

/**
 * Step 2 — Build the URL to open in a browser.
 * The user will be asked to sign in to X and authorize the app.
 */
export function buildAuthorizationUrl(requestToken: string): string {
  return `${BASE}/oauth/authorize?oauth_token=${encodeURIComponent(requestToken)}`
}

/**
 * Step 3 — Exchange the verifier (from the callback URL) for real access tokens.
 */
export async function getOAuthAccessToken(
  consumerKey: string,
  consumerSecret: string,
  requestToken: string,
  requestTokenSecret: string,
  verifier: string,
): Promise<{ accessToken: string; accessTokenSecret: string; screenName: string; userId: string }> {
  const url = `${BASE}/oauth/access_token`
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = generateNonce()

  // oauth_verifier goes in both the body AND the signature base string
  const bodyParams: Record<string, string> = { oauth_verifier: verifier }

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: requestToken,
    oauth_version: '1.0',
  }

  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(requestTokenSecret)}`
  oauthParams.oauth_signature = sign('POST', url, { ...bodyParams, ...oauthParams }, signingKey)

  const formBody = Object.entries(bodyParams)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: buildAuthHeader(oauthParams),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Access token failed (${response.status}): ${body}`)
  }

  const parsed = Object.fromEntries(new URLSearchParams(await response.text()))
  if (!parsed.oauth_token) throw new Error('No oauth_token in access_token response')

  return {
    accessToken: parsed.oauth_token,
    accessTokenSecret: parsed.oauth_token_secret,
    screenName: parsed.screen_name,
    userId: parsed.user_id,
  }
}
