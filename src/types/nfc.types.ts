/**
 * NFC Type Definitions
 * Strongly typed interfaces for NFC handshake functionality
 */

import type { NdefRecord } from 'react-native-nfc-manager'

/**
 * Credentials stored in AsyncStorage for X (Twitter) OAuth
 */
export interface StoredXCredentials {
  accessToken: string
  accessTokenSecret: string
  screenName: string
}

/**
 * Parsed NFC tag data with extracted user information
 */
export interface ParsedNfcTag {
  id: string | null
  username: string | null
}

/**
 * Extended TagEvent with proper typing for our use case
 * Based on react-native-nfc-manager TagEvent but with optional properties
 */
export interface NfcHandshakeTagEvent {
  id?: string
  serialNumber?: string
  tagId?: string
  ndefMessage?: NdefRecord[]
  maxSize?: number
  type?: string
  techTypes?: string[]
}

/**
 * Result of processing an NFC handshake
 */
export interface HandshakeProcessResult {
  success: boolean
  username: string | null
  tagId: string | null
  tweetPosted: boolean
  error?: string
}

/**
 * Configuration for NFC handshake processing
 */
export interface HandshakeProcessConfig {
  preventDuplicateWindow?: number // milliseconds
  autoPostTweet?: boolean
}
