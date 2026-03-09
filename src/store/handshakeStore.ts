/**
 * Handshake Store with Zustand + AsyncStorage persistence
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface Handshake {
  id: string
  username: string
  tagId: string
  timestamp: number
}

interface HandshakeStore {
  handshakes: Handshake[]
  count: number
  addHandshake: (handshake: Omit<Handshake, 'id' | 'timestamp'>) => void
  clearHandshakes: () => void
  getHandshakeByUsername: (username: string) => Handshake | undefined
}

export const useHandshakeStore = create<HandshakeStore>()(
  persist(
    (set, get) => ({
      handshakes: [],
      count: 0,

      addHandshake: (handshake) => {
        const newHandshake: Handshake = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          ...handshake,
        }

        console.log('[handshakeStore] Stored handshake model:', newHandshake)

        set((state) => ({
          handshakes: [...state.handshakes, newHandshake],
          count: state.count + 1,
        }))
      },

      clearHandshakes: () => {
        set({ handshakes: [], count: 0 })
      },

      getHandshakeByUsername: (username) => {
        return get().handshakes.find((h) => h.username === username)
      },
    }),
    {
      name: 'handshake-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)
