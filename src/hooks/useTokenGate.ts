/**
 * Hook for managing Seeker Genesis token gate flow
 */

import { useState } from 'react'
import type { SeekerGenesisResult } from '../../services/seekerGenesisService'
import solanaService from '../../services/solanaService'

interface UseTokenGateReturn {
  result: SeekerGenesisResult | null
  loading: boolean
  error: string | null
  checkHolder: (walletAddress: string) => Promise<void>
  reset: () => void
}

export function useTokenGate(): UseTokenGateReturn {
  const [result, setResult] = useState<SeekerGenesisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkHolder = async (walletAddress: string) => {
    setLoading(true)
    setError(null)

    try {
      const holderResult = await solanaService.getSeekerGenesisHolderDetails(walletAddress)
      setResult(holderResult)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to verify Seeker Genesis NFT'
      setError(errorMessage)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setResult(null)
    setLoading(false)
    setError(null)
  }

  return {
    result,
    loading,
    error,
    checkHolder,
    reset,
  }
}
