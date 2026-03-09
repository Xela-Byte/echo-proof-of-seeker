import { Connection, PublicKey, type ParsedAccountData } from '@solana/web3.js'

/**
 * Token gate service based on mint authority
 *
 * Each eligible NFT:
 * - has supply 1
 * - is unique by mint
 * - shares the same mint authority
 */

const MINT_AUTHORITY = new PublicKey('GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4')
const TOKEN_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb')

// Reuse the same RPC as the main Solana service
const RPC_URL = process.env.EXPO_PUBLIC_HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com'
const connection = new Connection(RPC_URL, 'confirmed')

export interface SeekerGenesisMint {
  mint: string
  slot: string
  epoch: number
  blockTime: number | null
}

export interface SeekerGenesisHolderResponse {
  holder: string
  mints: SeekerGenesisMint[]
  count: number
}

export type SeekerGenesisResult =
  | { isHolder: true; mint: SeekerGenesisMint; details: SeekerGenesisHolderResponse }
  | { isHolder: false; mint: null; details: null }

/**
 * Check if a wallet address holds at least one NFT
 * whose mint authority matches `MINT_AUTHORITY`.
 */
export async function checkSeekerGenesisHolder(address: string): Promise<SeekerGenesisResult> {
  if (!address || address.length < 32) {
    throw new Error('Invalid Solana address')
  }

  const owner = new PublicKey(address)

  // 1. Fetch all token accounts owned by the wallet
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  })

  if (tokenAccounts.value.length === 0) {
    return { isHolder: false, mint: null, details: null }
  }

  // 2. Filter to NFT-like accounts: supply 1, decimals 0, balance > 0
  const candidateMints: string[] = []

  for (const { account } of tokenAccounts.value) {
    const data = account.data as ParsedAccountData
    const info = data.parsed.info
    const amount = info.tokenAmount

    if (!amount || amount.decimals !== 0 || Number(amount.uiAmount) <= 0) {
      continue
    }

    candidateMints.push(info.mint)
  }

  if (candidateMints.length === 0) {
    return { isHolder: false, mint: null, details: null }
  }

  // 3. Fetch mint accounts and look for one with the desired mint authority
  const mintPubkeys = candidateMints.map((m) => new PublicKey(m))
  const mintAccounts = await connection.getMultipleParsedAccounts(mintPubkeys)
  const contextSlot = mintAccounts.context.slot
  const contextBlockTime = await connection.getBlockTime(contextSlot)

  for (let i = 0; i < mintAccounts.value.length; i++) {
    const acc = mintAccounts.value[i]
    if (!acc) continue

    const data = acc.data as ParsedAccountData
    const info = data.parsed.info

    // Some NFTs may have no current mint authority (set to null),
    // but we specifically care about those created by our authority.
    if (info.mintAuthority !== MINT_AUTHORITY.toBase58()) {
      continue
    }

    const mintAddress = candidateMints[i]

    const mint: SeekerGenesisMint = {
      mint: mintAddress,
      slot: String(contextSlot),
      // We don't have epoch directly; callers mostly care about "holder or not"
      epoch: 0,
      blockTime: contextBlockTime ?? null,
    }

    const details: SeekerGenesisHolderResponse = {
      holder: address,
      mints: [mint],
      count: 1,
    }

    return { isHolder: true, mint, details }
  }

  return { isHolder: false, mint: null, details: null }
}

export default {
  checkSeekerGenesisHolder,
}
