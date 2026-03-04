/**
 * Solana Service - Mobile Wallet Adapter Implementation
 * Uses @solana-mobile/mobile-wallet-adapter-protocol-web3js for React Native
 */

import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js'
import { Connection, PublicKey } from '@solana/web3.js'
import { checkSeekerGenesisHolder, type SeekerGenesisResult } from './seekerGenesisService'

// Constants
const HELIUS_RPC_URL = process.env.EXPO_PUBLIC_HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com'
const SEEKER_GENESIS_TOKEN_MINT = 'SGTGenesisTokenMintAddress' // Replace with actual SGT mint
const SKR_TOKEN_MINT = 'SKRTokenMintAddress' // Replace with actual SKR mint

// App identity for MWA
const APP_IDENTITY = {
  name: 'Echo - Seeker Signal',
  uri: 'https://echo.seeker.app',
  icon: 'relative/path/to/icon.png', // Update with your app icon
}

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
   * Connect wallet using Mobile Wallet Adapter
   * This will prompt the user to authorize the app with their Solana mobile wallet
   */
  async connectWallet(): Promise<{ publicKey: string; authToken: string }> {
    try {
      const result = await transact(async (wallet) => {
        // Request authorization from the wallet
        const authorization = await wallet.authorize({
          cluster: 'mainnet-beta',
          identity: APP_IDENTITY,
        })

        // The authorization contains the selected account and auth token
        const selectedAccount = authorization.accounts[0]

        return {
          publicKey: selectedAccount.address,
          authToken: authorization.auth_token,
          walletUriBase: authorization.wallet_uri_base,
        }
      })

      // Store the connection state
      this.publicKey = new PublicKey(result.publicKey)
      this.authToken = result.authToken

      console.log('✅ Wallet connected:', result.publicKey)

      return {
        publicKey: result.publicKey,
        authToken: result.authToken,
      }
    } catch (error) {
      console.error('❌ Wallet connection failed:', error)
      throw new Error('Failed to connect wallet via Mobile Wallet Adapter')
    }
  }

  /**
   * Disconnect wallet and deauthorize the session
   */
  async disconnectWallet(): Promise<void> {
    if (!this.authToken) {
      console.log('⚠️ No active session to disconnect')
      this.publicKey = null
      this.authToken = null
      return
    }

    try {
      await transact(async (wallet) => {
        // Deauthorize the current session
        await wallet.deauthorize({ auth_token: this.authToken! })
      })

      console.log('✅ Wallet disconnected')
    } catch (error) {
      console.error('❌ Wallet disconnect failed:', error)
      // Continue with cleanup even if deauthorization fails
    } finally {
      this.publicKey = null
      this.authToken = null
    }
  }

  /**
   * Verify Seeker Genesis NFT ownership using official API
   * The Seeker Genesis NFT is immutable and non-transferable
   */
  async verifySeekerGenesisToken(walletAddress: string): Promise<SeekerGenesisToken | null> {
    try {
      const result = await checkSeekerGenesisHolder(walletAddress)

      if (!result.isHolder) {
        return null
      }

      return {
        mint: result.mint.mint,
        owner: walletAddress,
        verified: true,
        metadata: {
          name: 'Seeker Genesis NFT',
          symbol: 'SEEKER',
          uri: `https://seeker-genesis.colmena.dev/api/holders/${walletAddress}`,
        },
      }
    } catch (error) {
      console.error('Seeker Genesis verification failed:', error)
      throw new Error('Failed to verify Seeker Genesis NFT ownership')
    }
  }

  /**
   * Get Seeker Genesis holder result with full details
   */
  async getSeekerGenesisHolderDetails(walletAddress: string): Promise<SeekerGenesisResult> {
    try {
      return await checkSeekerGenesisHolder(walletAddress)
    } catch (error) {
      console.error('Failed to get Seeker Genesis holder details:', error)
      throw error
    }
  }

  /**
   * Fetch SKR token state using Helius RPC
   */
  async fetchSKRState(walletAddress: string): Promise<SKRState> {
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
      console.error('❌ SKR state fetch failed:', error)
      throw new Error('Failed to fetch SKR token state')
    }
  }

  private async getHistoricalBalance(walletAddress: string): Promise<number> {
    // TODO: Implement historical tracking
    return 0
  }

  /**
   * Sign a message using Mobile Wallet Adapter
   */
  async signMessage(message: string): Promise<SignedPayload> {
    if (!this.publicKey || !this.authToken) {
      throw new Error('Wallet not connected. Please connect your wallet first.')
    }

    try {
      const messageBuffer = new TextEncoder().encode(message)

      const signedPayloads = await transact(async (wallet) => {
        // Reauthorize if needed to ensure the session is valid
        const authResult = await wallet.reauthorize({
          auth_token: this.authToken!,
          identity: APP_IDENTITY,
        })

        // Update auth token if it changed
        if (authResult.auth_token !== this.authToken) {
          this.authToken = authResult.auth_token
        }

        // Sign the message
        const signatures = await wallet.signMessages({
          addresses: [this.publicKey!.toBase58()],
          payloads: [messageBuffer],
        })

        return signatures
      })

      const signature = signedPayloads[0]

      return {
        message,
        signature: Buffer.from(signature).toString('base64'),
        publicKey: this.publicKey.toBase58(),
        timestamp: Date.now(),
      }
    } catch (error) {
      console.error('❌ Message signing failed:', error)
      throw new Error('Failed to sign message')
    }
  }

  /**
   * Sign and send transaction using Mobile Wallet Adapter
   * @param transaction - The transaction to sign and send
   * @returns Transaction signature
   */
  async signAndSendTransaction(transaction: any): Promise<string> {
    if (!this.publicKey || !this.authToken) {
      throw new Error('Wallet not connected. Please connect your wallet first.')
    }

    try {
      const signature = await transact(async (wallet) => {
        // Reauthorize if needed to ensure the session is valid
        const authResult = await wallet.reauthorize({
          auth_token: this.authToken!,
          identity: APP_IDENTITY,
        })

        // Update auth token if it changed
        if (authResult.auth_token !== this.authToken) {
          this.authToken = authResult.auth_token
        }

        // Sign and send the transaction
        const signedTransactions = await wallet.signAndSendTransactions({
          transactions: [transaction],
        })

        return signedTransactions[0]
      })

      console.log('✅ Transaction sent:', signature)
      return Buffer.from(signature).toString('base64')
    } catch (error) {
      console.error('❌ Transaction failed:', error)
      throw new Error('Failed to sign and send transaction')
    }
  }

  /**
   * Sign transactions without sending (for cases where you want to send manually)
   */
  async signTransactions(transactions: any[]): Promise<any[]> {
    if (!this.publicKey || !this.authToken) {
      throw new Error('Wallet not connected. Please connect your wallet first.')
    }

    try {
      const signedTxs = await transact(async (wallet) => {
        // Reauthorize if needed to ensure the session is valid
        const authResult = await wallet.reauthorize({
          auth_token: this.authToken!,
          identity: APP_IDENTITY,
        })

        // Update auth token if it changed
        if (authResult.auth_token !== this.authToken) {
          this.authToken = authResult.auth_token
        }

        // Sign the transactions
        return await wallet.signTransactions({
          transactions,
        })
      })

      console.log('✅ Transactions signed')
      return signedTxs
    } catch (error) {
      console.error('❌ Transaction signing failed:', error)
      throw new Error('Failed to sign transactions')
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
