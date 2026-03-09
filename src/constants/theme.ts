/**
 * Theme Constants
 * Centralized color palette and styling values
 */

export const colors = {
  // Primary
  primary: '#0A0A18',
  background: '#F8D7BF',

  // Status colors
  success: '#74C69D',
  warning: '#FFAA00',
  error: '#FF5555',

  // Error backgrounds
  errorLight: '#FFE5E5',

  // Status variants
  gold: '#FFD700',
  diamondHands: '#74C69D',
  paperHands: '#F8D7BF',

  // Neutral
  white: '#FFFFFF',
  black: '#000000',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
} as const

export const borderWidth = {
  thin: 2,
  regular: 4,
  thick: 6,
} as const
