import type { LucideIcon } from 'lucide-react'

// Color palette type for terminal themes
export type ColorPalette = {
  bg: string
  terminal: string
  elevated: string
  primary: string
  primaryRgb: string
  secondary: string
  secondaryRgb: string
  warning: string
  danger: string
  text: string
  textMuted: string
  textDim: string
  border: string
  accent: string
  accentRgb: string
}

// Tab identifier type
export type TabId = 'store' | 'observe' | 'skills' | 'dashboard'

// Tab definition interface
export interface Tab {
  id: TabId
  label: string
  description: string
  icon: LucideIcon
  color: string
  colorRgb: string
}

// Animation container dimensions
export const DESIGN_WIDTH = 1200
export const DESIGN_HEIGHT = 600
