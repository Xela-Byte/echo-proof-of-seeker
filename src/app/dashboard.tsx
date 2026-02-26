/**
 * Dashboard Screen - Expo Router version
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import solanaService from '../../services/solanaService'

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false)
  const [skrState, setSkrState] = useState<any>(null)
  const [publicKey, setPublicKey] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const key = solanaService.getPublicKey()
    setPublicKey(key)

    if (key) {
      try {
        const state = await solanaService.fetchSKRState(key)
        setSkrState(state)
      } catch (error) {
        console.error('Failed to load SKR state:', error)
      }
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'gold':
        return '#FFD700'
      case 'diamond_hands':
        return '#14F195'
      case 'paper_hands':
        return '#FF4757'
      default:
        return '#FFFFFF'
    }
  }

  const getStatusEmoji = (status: string): string => {
    switch (status) {
      case 'gold':
        return '💎✨'
      case 'diamond_hands':
        return '💎'
      case 'paper_hands':
        return '📄'
      default:
        return '⚡'
    }
  }

  return (
    <LinearGradient colors={['#0a0015', '#1a0030', '#0a0015']} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#14F195"
              colors={['#14F195']}
            />
          }
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>ECHO</Text>
              <Text style={styles.subtitle}>Seeker Signal</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/settings')} hitSlop={8}>
              <Ionicons name="settings-outline" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {publicKey && (
            <View style={styles.walletCard}>
              <Text style={styles.cardLabel}>Connected Wallet</Text>
              <Text style={styles.walletAddress} numberOfLines={1}>
                {publicKey}
              </Text>
            </View>
          )}

          {skrState && (
            <View style={styles.skrCard}>
              <View style={styles.skrHeader}>
                <Text style={styles.cardTitle}>SKR Token Status</Text>
                <Text style={styles.statusEmoji}>{getStatusEmoji(skrState.status)}</Text>
              </View>

              <View style={styles.skrStats}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Balance</Text>
                  <Text style={styles.statValue}>{skrState.balance.toFixed(2)}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>24h Change</Text>
                  <Text style={[styles.statValue, { color: skrState.changePercentage >= 0 ? '#14F195' : '#FF4757' }]}>
                    {skrState.changePercentage >= 0 ? '+' : ''}
                    {skrState.changePercentage.toFixed(2)}%
                  </Text>
                </View>
              </View>

              <View style={styles.statusBadge}>
                <LinearGradient
                  colors={[getStatusColor(skrState.status), getStatusColor(skrState.status) + '88']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.statusBadgeGradient}
                >
                  <Text style={styles.statusText}>{skrState.status.toUpperCase().replace('_', ' ')}</Text>
                </LinearGradient>
              </View>
            </View>
          )}

          <View style={styles.statsGrid}>
            <View style={styles.statsCard}>
              <Text style={styles.statsNumber}>0</Text>
              <Text style={styles.statsLabel}>Handshakes</Text>
            </View>
            <View style={styles.statsCard}>
              <Text style={styles.statsNumber}>0</Text>
              <Text style={styles.statsLabel}>Events</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/nfc-handshake')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#9945FF', '#14F195']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <MaterialCommunityIcons name="handshake-outline" size={24} color="#FFFFFF" />
                <Text style={styles.buttonText}>New Handshake</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/x-banner-update')}
              activeOpacity={0.8}
            >
              <Ionicons name="image-outline" size={20} color="#14F195" />
              <Text style={styles.secondaryButtonText}>Update Banner</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color="#FFC107" />
            <Text style={styles.infoText}>Running in demo mode. For full features, build with custom dev client.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 3,
  },
  subtitle: {
    fontSize: 14,
    color: '#14F195',
    letterSpacing: 2,
    marginTop: 4,
  },
  walletCard: {
    backgroundColor: 'rgba(153, 69, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(153, 69, 255, 0.3)',
  },
  cardLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.6,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  walletAddress: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  skrCard: {
    backgroundColor: 'rgba(20, 241, 149, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(20, 241, 149, 0.2)',
  },
  skrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  statusEmoji: { fontSize: 24 },
  skrStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  stat: { alignItems: 'center' },
  statLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.6,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statusBadge: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  statusBadgeGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 24,
    gap: 12,
  },
  statsCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statsNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#14F195',
    marginBottom: 8,
  },
  statsLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  actions: {
    marginHorizontal: 24,
    marginBottom: 24,
    gap: 12,
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    backgroundColor: 'rgba(20, 241, 149, 0.1)',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(20, 241, 149, 0.3)',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#14F195',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#FFC107',
    lineHeight: 20,
  },
})
