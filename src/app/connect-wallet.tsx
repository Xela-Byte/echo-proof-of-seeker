import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import React, { useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import solanaService from '../../services/solanaService'

export default function ConnectWalletScreen() {
  const [connecting, setConnecting] = useState(false)

  const handleConnect = async () => {
    setConnecting(true)
    try {
      await solanaService.connectWallet()
      router.push('/device-verification')
    } catch (error) {
      console.error('Connection failed:', error)
      Alert.alert(
        'Connection Failed',
        'Failed to connect wallet. In Expo Go, demo mode is used. For full functionality, create a custom dev client.',
        [{ text: 'OK' }],
      )
    } finally {
      setConnecting(false)
    }
  }

  return (
    <LinearGradient colors={['#0a0015', '#1a0030', '#0a0015']} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#14F195" />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.header}>
            <MaterialCommunityIcons name="wallet-outline" size={60} color="#14F195" style={styles.walletIcon} />
            <Text style={styles.title}>Connect Your Wallet</Text>
            <Text style={styles.description}>Echo requires a Solana wallet with Mobile Wallet Adapter support</Text>
          </View>

          <View style={styles.requirements}>
            <Text style={styles.requirementsTitle}>Requirements:</Text>
            {[
              'Solana Seeker device',
              'Compatible Solana wallet',
              'Seeker Genesis Token (SGT)',
            ].map((req) => (
              <View key={req} style={styles.requirement}>
                <Ionicons name="checkmark" size={18} color="#14F195" />
                <Text style={styles.requirementText}>{req}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, connecting && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={connecting}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#9945FF', '#14F195']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              {connecting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.buttonText}>Connect Wallet</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Running in Expo Go uses demo mode. For full Mobile Wallet Adapter support, create a custom dev client
              with: npx expo run:android
            </Text>
          </View>
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
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  walletIcon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  requirements: {
    backgroundColor: 'rgba(20, 241, 149, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(20, 241, 149, 0.2)',
  },
  requirementsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14F195',
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  requirementText: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  button: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  infoBox: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  infoText: {
    fontSize: 13,
    color: '#FFC107',
    lineHeight: 20,
    textAlign: 'center',
  },
})
