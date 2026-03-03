/**
 * Seeker Genesis Token Gate Service
 * Checks if a wallet holds a Solana Mobile Seeker Genesis NFT
 *
 * The Seeker Genesis NFT collection is immutable and non-transferable.
 * Once a wallet holds one, it holds it forever.
 */

const SEEKER_GENESIS_API = 'https://seeker-genesis.colmena.dev'

export interface SeekerGenesisMint {
  ata: string
  blockTime: number
  epoch: number
  mint: string
  signature: string
  slot: string
}

export interface SeekerGenesisHolderResponse {
  count: number
  holder: string
  mints: SeekerGenesisMint[]
}

export type SeekerGenesisResult =
  | { isHolder: true; mint: SeekerGenesisMint; details: SeekerGenesisHolderResponse }
  | { isHolder: false; mint: null; details: null }

/**
 * Check if a wallet address holds a Seeker Genesis NFT
 * @param address - Solana wallet address to check
 * @returns Promise with holder status and mint details
 */
export async function checkSeekerGenesisHolder(address: string): Promise<SeekerGenesisResult> {
  if (!address || address.length < 32) {
    throw new Error('Invalid Solana address')
  }

  try {
    const response = await fetch(`${SEEKER_GENESIS_API}/api/holders/${address}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // 404 means wallet is not a holder
    if (response.status === 404) {
      return { isHolder: false, mint: null, details: null }
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as SeekerGenesisHolderResponse

    // Return first mint (users should only have one since it's non-transferable)
    return data.mints[0]
      ? { isHolder: true, mint: data.mints[0], details: data }
      : { isHolder: false, mint: null, details: null }
  } catch (error) {
    if (error instanceof Error && error.message.includes('API error')) {
      throw error
    }
    throw new Error(`Failed to connect to Seeker Genesis API: ${error}`)
  }
}

/**
 * Get API health status
 */
export async function getSeekerGenesisAPIHealth(): Promise<{
  status: string
  totalHolders: number
  uptime: number
}> {
  const response = await fetch(`${SEEKER_GENESIS_API}/health`)

  if (!response.ok) {
    throw new Error('Health check failed')
  }

  return response.json()
}

export default {
  checkSeekerGenesisHolder,
  getSeekerGenesisAPIHealth,
}
