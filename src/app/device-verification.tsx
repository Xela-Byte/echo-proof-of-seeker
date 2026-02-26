/**
 * Device Verification Screen
 */

import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import solanaService from '../../services/solanaService'

export default function DeviceVerificationScreen() {
  const [verifying, setVerifying] = useState(true)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [publicKey, setPublicKey] = useState<string | null>(null)

  useEffect(() => {
    verifyDevice()
  }, [])

  const verifyDevice = async () => {
    const key = solanaService.getPublicKey()
    setPublicKey(key)

    if (!key) {
      setError('No wallet connected')
      setVerifying(false)
      return
    }

    setVerifying(true)
    setError(null)

    try {
      const sgt = await solanaService.verifySeekerGenesisToken(key)

      if (sgt) {
        setVerified(true)
        setTimeout(() => {
          router.replace('/dashboard')
        }, 2000)
      } else {
        setError('No Seeker Genesis Token found in this wallet')
      }
    } catch (err) {
      console.error('Verification failed:', err)
      setError('Failed to verify device. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <LinearGradient colors={['#0a0015', '#1a0030', '#0a0015']} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#14F195" />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.statusContainer}>
            {verifying && (
              <>
                <ActivityIndicator size="large" color="#14F195" />
                <Text style={styles.statusTitle}>Verifying Device</Text>
                <Text style={styles.statusText}>Checking for Seeker Genesis Token...</Text>
              </>
            )}

            {!verifying && verified && (
              <>
                <Ionicons name="checkmark-circle" size={80} color="#14F195" style={styles.statusIcon} />
                <Text style={styles.statusTitle}>Device Verified!</Text>
                <Text style={styles.statusText}>Seeker Genesis Token confirmed</Text>
                {publicKey && <Text style={styles.walletAddress}>{publicKey}</Text>}
              </>
            )}

            {!verifying && error && (
              <>
                <Ionicons name="close-circle" size={80} color="#FF4757" style={styles.statusIcon} />
                <Text style={styles.statusTitle}>Verification Failed</Text>
                <Text style={styles.errorText}>{error}</Text>
                {publicKey && <Text style={styles.walletAddress}>{publicKey}</Text>}
              </>
            )}
          </View>

          {!verifying && error && (
            <TouchableOpacity style={styles.button} onPress={verifyDevice}>
              <LinearGradient
                colors={['#9945FF', '#14F195']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Retry Verification</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backRow: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 4,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  statusIcon: {
    marginBottom: 4,
  },
  statusTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  statusText: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF4757',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  walletAddress: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.5,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  button: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
})
