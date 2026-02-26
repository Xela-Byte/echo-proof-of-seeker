/**
 * Echo - Root Layout for Expo Router
 * This replaces the NavigationContainer approach
 */

import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import React from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AppProvider } from '../../context/AppContext'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0a0015' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="connect-wallet" />
          <Stack.Screen name="device-verification" />
          <Stack.Screen name="dashboard" />
          <Stack.Screen name="nfc-handshake" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
          <Stack.Screen name="x-banner-update" />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  )
}
