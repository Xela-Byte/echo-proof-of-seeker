/**
 * Token Gate Demo Screen
 * Demonstrates the Seeker Genesis NFT token gate feature
 */

import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import React, { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import TokenGate from '../components/TokenGate'
import { useTokenGate } from '../hooks/useTokenGate'

export default function TokenGateDemoScreen() {
  const [walletInput, setWalletInput] = useState('')
  const { result, loading, error, checkHolder, reset } = useTokenGate()

  const handleCheck = async () => {
    if (!walletInput || walletInput.length < 32) {
      Alert.alert('Invalid Address', 'Please enter a valid Solana wallet address')
      return
    }

    await checkHolder(walletInput)
  }

  const handleReset = () => {
    reset()
    setWalletInput('')
  }

  // Example addresses for testing
  const exampleAddresses = [
    {
      label: 'Holder Example',
      address: '4pNxsmr4zu1RPQ6VLJBtZsm7cqCQwE9q6VSL8wJ8rzFX',
    },
  ]

  return (
    <LinearGradient colors={['#0a0015', '#1a0030', '#0a0015']} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="#14F195" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Token Gate Demo</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>🔥 Seeker Genesis NFT Token Gate</Text>
            <Text style={styles.infoDescription}>
              Enter a Solana wallet address to check if it holds a Seeker Genesis NFT. This NFT is exclusive to Solana
              Mobile Seeker device owners and is immutable & non-transferable.
            </Text>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Wallet Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter Solana wallet address..."
              placeholderTextColor="#666"
              value={walletInput}
              onChangeText={setWalletInput}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleCheck}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>{loading ? 'Checking...' : 'Check Holder'}</Text>
              </TouchableOpacity>

              {(result || error) && (
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleReset}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.buttonText, styles.secondaryButtonText]}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.examplesSection}>
            <Text style={styles.examplesTitle}>Example Addresses:</Text>
            {exampleAddresses.map((example) => (
              <TouchableOpacity
                key={example.address}
                style={styles.exampleCard}
                onPress={() => setWalletInput(example.address)}
                activeOpacity={0.7}
              >
                <View style={styles.exampleContent}>
                  <Text style={styles.exampleLabel}>{example.label}</Text>
                  <Text style={styles.exampleAddress} numberOfLines={1} ellipsizeMode="middle">
                    {example.address}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#14F195" />
              </TouchableOpacity>
            ))}
          </View>

          <TokenGate result={result} loading={loading} error={error} />

          {result?.isHolder && (
            <View style={styles.apiInfoCard}>
              <Text style={styles.apiInfoTitle}>API Response Details</Text>
              <View style={styles.apiInfoRow}>
                <Text style={styles.apiInfoLabel}>Holder Count:</Text>
                <Text style={styles.apiInfoValue}>{result.details?.count || 1}</Text>
              </View>
              <View style={styles.apiInfoRow}>
                <Text style={styles.apiInfoLabel}>Block Time:</Text>
                <Text style={styles.apiInfoValue}>{new Date(result.mint.blockTime * 1000).toLocaleString()}</Text>
              </View>
              <View style={styles.apiInfoRow}>
                <Text style={styles.apiInfoLabel}>ATA:</Text>
                <Text style={styles.apiInfoValue} numberOfLines={1} ellipsizeMode="middle">
                  {result.mint.ata}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(20, 241, 149, 0.1)',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: 'rgba(153, 69, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(153, 69, 255, 0.3)',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  infoDescription: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#14F195',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#14F195',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
  },
  examplesSection: {
    marginBottom: 24,
  },
  examplesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
  },
  exampleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  exampleContent: {
    flex: 1,
    marginRight: 12,
  },
  exampleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#14F195',
    marginBottom: 4,
  },
  exampleAddress: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'monospace',
  },
  apiInfoCard: {
    backgroundColor: 'rgba(20, 241, 149, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(20, 241, 149, 0.2)',
  },
  apiInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14F195',
    marginBottom: 16,
  },
  apiInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  apiInfoLabel: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
  },
  apiInfoValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
})
