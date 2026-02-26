/**
 * Solana Service - Expo Go Compatible Version
 * NOTE: Full MWA features require custom dev client or standalone build
 */

import { Connection, PublicKey } from '@solana/web3.js'
import { Platform } from 'react-native'

// Constants
const HELIUS_RPC_URL = process.env.EXPO_PUBLIC_HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com'
const SEEKER_GENESIS_TOKEN_MINT = 'SGTGenesisTokenMintAddress' // Replace with actual SGT mint
const SKR_TOKEN_MINT = 'SKRTokenMintAddress' // Replace with actual SKR mint

// Check if we're in a native build with MWA support
const HAS_MWA_SUPPORT = Platform.OS === 'android' && !__DEV__

interface SignedPayload {
  message: string
  signature: string
  publicKey: string
  timestamp: number
}

interface SeekerGenesisToken {
  mint: string
  owner: string
  verified: boolean
  metadata: {
    name: string
    symbol: string
    uri: string
  }
}

interface SKRState {
  balance: number
  change24h: number
  changePercentage: number
  lastUpdated: number
  status: 'diamond_hands' | 'paper_hands' | 'neutral' | 'gold'
}

class SolanaService {
  private connection: Connection
  private publicKey: PublicKey | null = null
  private authToken: string | null = null

  constructor() {
    this.connection = new Connection(HELIUS_RPC_URL, 'confirmed')
  }

  /**
   * Connect wallet - Expo Go compatible version
   * In production, this will use Mobile Wallet Adapter
   */
  async connectWallet(): Promise<{ publicKey: string; authToken: string }> {
    if (!HAS_MWA_SUPPORT) {
      // Demo mode for Expo Go
      console.warn('⚠️ Running in Expo Go - MWA not available. Using demo wallet.')
      const demoPublicKey = '9HrG3UAvzjNChfJPJoazmxGHPcfP9hTfZzuFbGKXUryx'

      this.publicKey = new PublicKey(demoPublicKey)
      this.authToken = 'demo-auth-token'

      return {
        publicKey: demoPublicKey,
        authToken: this.authToken,
      }
    }

    // Production: Use Mobile Wallet Adapter
    try {
      const { transact } = await import('@solana-mobile/mobile-wallet-adapter-protocol-web3js')

      const result = await transact(async (wallet) => {
        const authorization = await wallet.authorize({
          cluster: 'mainnet-beta',
          identity: {
            name: 'Echo - Seeker Signal',
            uri: 'https://echo.seeker.app',
            icon: 'icon_base64_here',
          },
        })

        return {
          publicKey: authorization.accounts[0].address,
          authToken: authorization.auth_token,
        }
      })

      this.publicKey = new PublicKey(result.publicKey)
      this.authToken = result.authToken

      return result
    } catch (error) {
      console.error('Wallet connection failed:', error)
      throw new Error('Failed to connect wallet via Mobile Wallet Adapter')
    }
  }

  /**
   * Disconnect wallet
   */
  async disconnectWallet(): Promise<void> {
    if (!HAS_MWA_SUPPORT) {
      this.publicKey = null
      this.authToken = null
      return
    }

    try {
      const { transact } = await import('@solana-mobile/mobile-wallet-adapter-protocol-web3js')

      if (this.authToken) {
        await transact(async (wallet) => {
          await wallet.deauthorize({ auth_token: this.authToken! })
        })
      }
    } catch (error) {
      console.error('Wallet disconnect failed:', error)
    } finally {
      this.publicKey = null
      this.authToken = null
    }
  }

  /**
   * Verify SGT using Helius
   */
  async verifySeekerGenesisToken(walletAddress: string): Promise<SeekerGenesisToken | null> {
    if (!HAS_MWA_SUPPORT) {
      // Demo mode - return mock SGT
      console.warn('⚠️ Demo mode - returning mock SGT verification')
      return {
        mint: SEEKER_GENESIS_TOKEN_MINT,
        owner: walletAddress,
        verified: true,
        metadata: {
          name: 'Seeker Genesis Token (Demo)',
          symbol: 'SGT',
          uri: '',
        },
      }
    }

    try {
      const response = await fetch(HELIUS_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'sgt-verification',
          method: 'getAssetsByOwner',
          params: {
            ownerAddress: walletAddress,
            page: 1,
            limit: 1000,
          },
        }),
      })

      const data = await response.json()

      if (!data.result || !data.result.items) {
        return null
      }

      const sgtAsset = data.result.items.find((asset: any) => asset.id === SEEKER_GENESIS_TOKEN_MINT)

      if (!sgtAsset) {
        return null
      }

      return {
        mint: sgtAsset.id,
        owner: walletAddress,
        verified: true,
        metadata: {
          name: sgtAsset.content?.metadata?.name || 'Seeker Genesis Token',
          symbol: sgtAsset.content?.metadata?.symbol || 'SGT',
          uri: sgtAsset.content?.json_uri || '',
        },
      }
    } catch (error) {
      console.error('SGT verification failed:', error)
      throw new Error('Failed to verify Seeker Genesis Token')
    }
  }

  /**
   * Fetch SKR token state
   */
  async fetchSKRState(walletAddress: string): Promise<SKRState> {
    if (!HAS_MWA_SUPPORT) {
      // Demo mode - return mock data
      const mockBalance = 10000 + Math.random() * 5000
      const mockChange = -10 + Math.random() * 30

      return {
        balance: mockBalance,
        change24h: mockChange,
        changePercentage: (mockChange / mockBalance) * 100,
        lastUpdated: Date.now(),
        status: mockChange > 10 ? 'gold' : mockChange > 0 ? 'diamond_hands' : 'paper_hands',
      }
    }

    try {
      const response = await fetch(HELIUS_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'skr-balance',
          method: 'getTokenAccountsByOwner',
          params: [walletAddress, { mint: SKR_TOKEN_MINT }, { encoding: 'jsonParsed' }],
        }),
      })

      const data = await response.json()

      let currentBalance = 0
      if (data.result?.value?.length > 0) {
        currentBalance = parseFloat(data.result.value[0].account.data.parsed.info.tokenAmount.uiAmount)
      }

      const historicalBalance = await this.getHistoricalBalance(walletAddress)
      const change24h = currentBalance - historicalBalance
      const changePercentage = historicalBalance > 0 ? (change24h / historicalBalance) * 100 : 0

      let status: SKRState['status'] = 'neutral'
      if (changePercentage > 10) {
        status = 'gold'
      } else if (changePercentage >= 0) {
        status = 'diamond_hands'
      } else if (changePercentage < -10) {
        status = 'paper_hands'
      }

      return {
        balance: currentBalance,
        change24h,
        changePercentage,
        lastUpdated: Date.now(),
        status,
      }
    } catch (error) {
      console.error('SKR state fetch failed:', error)
      throw new Error('Failed to fetch SKR token state')
    }
  }

  private async getHistoricalBalance(walletAddress: string): Promise<number> {
    // TODO: Implement historical tracking
    return 0
  }

  /**
   * Sign message - Expo Go compatible
   */
  async signMessage(message: string): Promise<SignedPayload> {
    if (!HAS_MWA_SUPPORT) {
      // Demo mode - return mock signature
      return {
        message,
        signature: 'demo-signature-base64',
        publicKey: this.publicKey?.toBase58() || 'demo-public-key',
        timestamp: Date.now(),
      }
    }

    try {
      if (!this.publicKey || !this.authToken) {
        throw new Error('Wallet not connected')
      }

      const { transact } = await import('@solana-mobile/mobile-wallet-adapter-protocol-web3js')
      const messageBuffer = new TextEncoder().encode(message)

      const result = await transact(async (wallet) => {
        const signedMessages = await wallet.signMessages({
          auth_token: this.authToken!,
          addresses: [this.publicKey!.toBase58()],
          payloads: [messageBuffer],
        })

        return signedMessages[0]
      })

      return {
        message,
        signature: Buffer.from(result).toString('base64'),
        publicKey: this.publicKey.toBase58(),
        timestamp: Date.now(),
      }
    } catch (error) {
      console.error('Message signing failed:', error)
      throw new Error('Failed to sign message')
    }
  }

  getPublicKey(): string | null {
    return this.publicKey?.toBase58() || null
  }

  isConnected(): boolean {
    return this.publicKey !== null && this.authToken !== null
  }
}

export default new SolanaService()
