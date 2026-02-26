/**
 * Splash Screen - Index Route
 */

import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animated entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Navigate after delay
    const timer = setTimeout(() => {
      router.replace('/connect-wallet');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient
      colors={['#0a0015', '#1a0030', '#0a0015']}
      style={styles.container}
    >
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Text style={styles.logo}>◈</Text>
        </Animated.View>

        <Text style={styles.title}>ECHO</Text>
        <Text style={styles.subtitle}>Seeker Signal</Text>
        
        <View style={styles.taglineContainer}>
          <Text style={styles.tagline}>Proof of Physical Status</Text>
          <View style={styles.divider} />
          <Text style={styles.powered}>Powered by Solana Mobile Stack</Text>
        </View>
      </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 30,
  },
  logo: {
    fontSize: 100,
    color: '#14F195',
    textShadowColor: '#14F195',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  title: {
    fontSize: 64,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 8,
    textShadowColor: '#9945FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#14F195',
    letterSpacing: 4,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  taglineContainer: {
    marginTop: 60,
    alignItems: 'center',
  },
  tagline: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  divider: {
    width: 100,
    height: 1,
    backgroundColor: '#14F195',
    marginVertical: 15,
    opacity: 0.5,
  },
  powered: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.6,
    letterSpacing: 1,
  },
});
