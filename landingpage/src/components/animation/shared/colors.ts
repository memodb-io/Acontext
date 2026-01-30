import type { ColorPalette } from './types'

// Dark theme - Terminal/Matrix style
export const darkColors: ColorPalette = {
  bg: '#000000',
  terminal: '#0A0E14',
  elevated: '#111418',
  primary: '#00FF41', // Matrix green
  primaryRgb: '0, 255, 65',
  secondary: '#00F5FF', // Cyan
  secondaryRgb: '0, 245, 255',
  warning: '#FFB86C',
  danger: '#FF5555',
  text: '#E6EDF3',
  textMuted: '#8B949E',
  textDim: '#6E7681',
  border: '#30363D',
  accent: '#9D4EDD', // Purple
  accentRgb: '157, 78, 221',
}

// Light theme - Clean and modern
export const lightColors: ColorPalette = {
  bg: '#FAFBFC',
  terminal: '#FFFFFF',
  elevated: '#F6F8FA',
  primary: '#059669', // Emerald green
  primaryRgb: '5, 150, 105',
  secondary: '#0891B2', // Cyan
  secondaryRgb: '8, 145, 178',
  warning: '#D97706',
  danger: '#DC2626',
  text: '#1F2937',
  textMuted: '#6B7280',
  textDim: '#9CA3AF',
  border: '#E5E7EB',
  accent: '#7C3AED', // Purple
  accentRgb: '124, 58, 237',
}
