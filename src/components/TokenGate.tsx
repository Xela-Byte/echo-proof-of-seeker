/**
 * Token Gate Component
 * Displays Seeker Genesis NFT holder status with visual feedback
 */

import { MaterialCommunityIcons } from '@expo/vector-icons'
import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import type { SeekerGenesisResult } from '../../services/seekerGenesisService'

interface TokenGateProps {
  result: SeekerGenesisResult | null
  loading?: boolean
  error?: string | null
}

export default function TokenGate({ result, loading, error }: TokenGateProps) {
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#14F195" />
          <Text style={styles.loadingText}>Checking Seeker Genesis NFT...</Text>
        </View>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={[styles.card, styles.errorCard]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#FF5555" />
          <Text style={styles.title}>Verification Error</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    )
  }

  if (!result) {
    return null
  }

  if (result.isHolder) {
    return (
      <View style={styles.container}>
        <View style={[styles.card, styles.holderCard]}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="check-decagram" size={56} color="#14F195" />
          </View>
          <Text style={styles.title}>🔥 Seeker Genesis Holder</Text>
          <Text style={styles.holderSubtitle}>Access Granted</Text>

          <View style={styles.detailsBox}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Mint:</Text>
              <Text style={styles.detailValue} numberOfLines={1} ellipsizeMode="middle">
                {result.mint.mint}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Epoch:</Text>
              <Text style={styles.detailValue}>{result.mint.epoch}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Slot:</Text>
              <Text style={styles.detailValue}>{result.mint.slot}</Text>
            </View>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={[styles.card, styles.nonHolderCard]}>
        <MaterialCommunityIcons name="lock-outline" size={48} color="#888" />
        <Text style={styles.title}>Not a Seeker Genesis Holder</Text>
        <Text style={styles.nonHolderText}>You need a Seeker Genesis NFT to access this feature</Text>
        <Text style={styles.infoText}>The Seeker Genesis NFT is exclusive to Solana Mobile Seeker device owners</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
  },
  loadingCard: {
    backgroundColor: 'rgba(20, 241, 149, 0.05)',
    borderColor: 'rgba(20, 241, 149, 0.2)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  holderCard: {
    backgroundColor: 'rgba(20, 241, 149, 0.1)',
    borderColor: '#14F195',
  },
  nonHolderCard: {
    backgroundColor: 'rgba(136, 136, 136, 0.05)',
    borderColor: 'rgba(136, 136, 136, 0.3)',
  },
  errorCard: {
    backgroundColor: 'rgba(255, 85, 85, 0.05)',
    borderColor: 'rgba(255, 85, 85, 0.3)',
  },
  iconContainer: {
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  holderSubtitle: {
    fontSize: 16,
    color: '#14F195',
    fontWeight: '600',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
    marginTop: 12,
  },
  nonHolderText: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#FF5555',
    textAlign: 'center',
    marginTop: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  detailsBox: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    marginRight: 8,
  },
  detailValue: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    flex: 1,
    textAlign: 'right',
  },
})
