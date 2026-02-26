/**
 * OAuth 1.0a signing utility for X (Twitter) API
 * Uses react-native-quick-crypto for HMAC-SHA1
 */

import QuickCrypto from 'react-native-quick-crypto'

export interface OAuth1Credentials {
  consumerKey: string
  consumerSecret: string
  accessToken: string
  accessTokenSecret: string
}

/**
 * RFC 3986 percent encoding (stricter than encodeURIComponent)
 */
function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
}

/**
 * Generate a random nonce string
 */
function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let nonce = ''
  for (let i = 0; i < 32; i++) {
    nonce += chars[Math.floor(Math.random() * chars.length)]
  }
  return nonce
}

/**
 * Build the OAuth 1.0a Authorization header for a request.
 *
 * @param method      HTTP method (GET, POST, …)
 * @param url         The fully-qualified request URL (without query string)
 * @param credentials OAuth consumer + access token credentials
 * @param bodyParams  Form-encoded body params that must be included in the signature
 */
export function buildOAuth1Header(
  method: string,
  url: string,
  credentials: OAuth1Credentials,
  bodyParams: Record<string, string> = {},
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = generateNonce()

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: credentials.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: credentials.accessToken,
    oauth_version: '1.0',
  }

  // Merge all params (body + oauth) for the signature base string
  const allParams: Record<string, string> = { ...bodyParams, ...oauthParams }

  // Sort alphabetically and build the normalized parameter string
  const normalizedParams = Object.entries(allParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join('&')

  // Signature base string: METHOD&encoded_url&encoded_params
  const signatureBase = [method.toUpperCase(), percentEncode(url), percentEncode(normalizedParams)].join('&')

  // Signing key: encoded_consumer_secret&encoded_access_token_secret
  const signingKey = `${percentEncode(credentials.consumerSecret)}&${percentEncode(credentials.accessTokenSecret)}`

  // HMAC-SHA1
  const hmac = QuickCrypto.createHmac('sha1', signingKey)
  hmac.update(signatureBase)
  const signature = hmac.digest('base64') as string

  oauthParams['oauth_signature'] = signature

  // Build Authorization header value
  const headerValue =
    'OAuth ' +
    Object.entries(oauthParams)
      .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
      .join(', ')

  return headerValue
}
