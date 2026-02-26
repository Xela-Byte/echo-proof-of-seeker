/**
 * NFC Handshake Screen (Placeholder)
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function NFCHandshakeScreen() {
  return (
    <LinearGradient colors={['#0a0015', '#1a0030', '#0a0015']} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="#14F195" />
          </TouchableOpacity>
          <Text style={styles.title}>Handshake</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.content}>
          <MaterialCommunityIcons name="handshake-outline" size={80} color="#FFFFFF" style={styles.icon} />
          <Text style={styles.mainTitle}>NFC Handshake</Text>
          <Text style={styles.description}>NFC features require custom dev client build</Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>Build with: npx expo run:android</Text>
          </View>
        </View>
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
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    marginBottom: 20,
    opacity: 0.9,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 30,
  },
  infoBox: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  infoText: {
    fontSize: 14,
    color: '#FFC107',
    textAlign: 'center',
  },
})
