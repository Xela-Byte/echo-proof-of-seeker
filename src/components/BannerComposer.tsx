/**
 * Banner Composer Component
 * Renders a banner with phone overlay and text that can be captured as an image
 */

import React, { forwardRef } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { BANNER_HEIGHT, BANNER_WIDTH, type OverlayConfig } from '../../services/bannerOverlayService'

interface BannerComposerProps {
  bannerUri: string
  config: OverlayConfig
}

/**
 * Component that renders the banner composition
 * Use with react-native-view-shot to capture as image
 */
export const BannerComposer = forwardRef<View, BannerComposerProps>(({ bannerUri, config }, ref) => {
  const phoneAssetModule =
    config.phoneAsset === 'phone_1' ? require('../assets/phone_1.png') : require('../assets/phone_2.png')

  const isPhoneLeft = config.phonePosition === 'left'

  return (
    <View ref={ref} style={styles.container}>
      {/* Background banner image */}
      <Image source={{ uri: bannerUri }} style={styles.bannerImage} resizeMode="cover" />

      {/* Overlay gradient for better text visibility */}
      <View style={styles.overlay} />

      {/* Phone image */}
      <Image
        source={phoneAssetModule}
        style={[styles.phoneImage, isPhoneLeft ? styles.phoneLeft : styles.phoneRight]}
        resizeMode="contain"
      />

      {/* Text content */}
      <View style={[styles.textContainer, isPhoneLeft ? styles.textRight : styles.textLeft]}>
        <Text style={styles.mainText}>{config.mainText}</Text>
        <Text style={styles.footnoteText}>{config.footnoteText}</Text>
      </View>
    </View>
  )
})

BannerComposer.displayName = 'BannerComposer'

const styles = StyleSheet.create({
  container: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    position: 'relative',
    backgroundColor: '#000',
  },
  bannerImage: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  phoneImage: {
    position: 'absolute',
    width: BANNER_HEIGHT * 0.9,
    height: BANNER_HEIGHT * 0.95,
    top: BANNER_HEIGHT * 0.025,
  },
  phoneLeft: {
    left: 0,
  },
  phoneRight: {
    right: 0,
  },
  textContainer: {
    position: 'absolute',
    top: BANNER_HEIGHT * 0.25,
    maxWidth: BANNER_WIDTH * 0.45,
    paddingHorizontal: 40,
  },
  textLeft: {
    left: 0,
    alignItems: 'flex-start',
  },
  textRight: {
    right: 0,
    alignItems: 'flex-end',
  },
  mainText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#14F195',
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
    lineHeight: 56,
  },
  footnoteText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
    lineHeight: 26,
  },
})
