/**
 * Settings Screen
 */

import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import React from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const FEATURES = [
  { label: 'Wallet Connection (Demo)', enabled: true },
  { label: 'SGT Verification (Demo)', enabled: true },
  { label: 'SKR Tracking (Demo)', enabled: true },
  { label: 'NFC Handshakes (Requires build)', enabled: false },
  { label: 'Twitter Integration (Requires build)', enabled: false },
  { label: 'Geo-fencing (Requires build)', enabled: false },
]

export default function SettingsScreen() {
  return (
    <LinearGradient colors={['#0a0015', '#1a0030', '#0a0015']} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="#14F195" />
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Echo - Seeker Signal</Text>
              <Text style={styles.infoText}>Version 1.0.0 (Demo)</Text>
              <Text style={styles.infoText}>Proof of Physical Status Protocol</Text>
              <Text style={styles.infoText}>Powered by Solana Mobile Stack</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Development Mode</Text>
            <View style={styles.warningBox}>
              <View style={styles.warningHeader}>
                <Ionicons name="warning-outline" size={18} color="#FFC107" />
                <Text style={styles.warningTitle}>Running in Expo Go with limited features.</Text>
              </View>
              <Text style={styles.warningText}>
                {
                  'For full functionality:\n  • Build custom dev client: npx expo run:android\n  • Or create standalone build'
                }
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Features</Text>
            <View style={styles.featureList}>
              {FEATURES.map(({ label, enabled }) => (
                <View key={label} style={styles.featureRow}>
                  <Ionicons
                    name={enabled ? 'checkmark' : 'close'}
                    size={16}
                    color={enabled ? '#14F195' : 'rgba(255,255,255,0.35)'}
                  />
                  <Text style={enabled ? styles.featureItem : styles.featureDisabled}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  scrollView: { flex: 1 },
  section: {
    marginBottom: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  infoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14F195',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.7,
    marginBottom: 4,
  },
  warningBox: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFC107',
    flex: 1,
  },
  warningText: {
    fontSize: 14,
    color: '#FFC107',
    lineHeight: 22,
    opacity: 0.85,
  },
  featureList: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureItem: {
    fontSize: 14,
    color: '#14F195',
    lineHeight: 20,
  },
  featureDisabled: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.35)',
    lineHeight: 20,
  },
})
