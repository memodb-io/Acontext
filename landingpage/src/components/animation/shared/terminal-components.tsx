'use client'

import { createContext, useContext } from 'react'
import type { ColorPalette } from './types'
import { darkColors } from './colors'

// Context for colors
export const ColorsContext = createContext<ColorPalette>(darkColors)
export const useColors = () => useContext(ColorsContext)

// Terminal window component
export function TerminalWindow({
  title,
  children,
  style,
  initialOpacity = 1,
}: {
  title: string
  children: React.ReactNode
  style?: React.CSSProperties
  initialOpacity?: number
}) {
  const colors = useColors()
  return (
    <div
      className="rounded-none"
      style={{
        border: `2px solid ${colors.primary}`,
        backgroundColor: colors.terminal,
        boxShadow: `0 0 20px rgba(${colors.primaryRgb}, 0.3)`,
        opacity: initialOpacity,
        ...style,
      }}
    >
      <div
        className="px-4 py-2 flex items-center justify-between text-sm"
        style={{
          backgroundColor: colors.elevated,
          borderBottom: `1px solid ${colors.border}`,
          color: colors.primary,
          textShadow: `0 0 5px rgba(${colors.primaryRgb}, 0.5)`,
        }}
      >
        <span>┌─[ACONTEXT]─────</span>
        <span>[{title}]</span>
      </div>
      <div className="p-6 text-sm">{children}</div>
    </div>
  )
}

// Code line component
export function CodeLine({
  children,
  indent = 0,
  comment,
  style,
}: {
  children?: React.ReactNode
  indent?: number
  comment?: boolean | string
  style?: React.CSSProperties
}) {
  const colors = useColors()
  const padding = '\u00A0'.repeat(indent * 2)

  if (comment) {
    return (
      <div className="my-1" style={{ color: colors.textDim, ...style }}>
        {padding}
        {typeof comment === 'string' ? comment : children}
      </div>
    )
  }

  return (
    <div className="my-1" style={{ color: colors.text, ...style }}>
      {padding}
      {children}
    </div>
  )
}

// Function name highlight
export function Fn({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return <span style={{ color: colors.secondary }}>{children}</span>
}

// String highlight
export function Str({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return <span style={{ color: colors.primary }}>{children}</span>
}

// Storage box component
export function StorageBox({
  title,
  description,
  icon,
  color,
}: {
  title: string
  description: string
  icon: string
  color: string
}) {
  const colors = useColors()
  return (
    <div
      data-animate-box
      className="flex-1 p-6 rounded-lg text-center"
      style={{
        border: `2px solid ${colors.border}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: 'translateX(40px)',
      }}
    >
      <div className="text-3xl mb-3">{icon}</div>
      <div className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
        {title}
      </div>
      <p className="text-sm" style={{ color: colors.textMuted }}>
        {description}
      </p>
    </div>
  )
}

// Task box component
export function TaskBox({
  title,
  status,
  progress,
}: {
  title: string
  status: 'success' | 'pending' | 'failed'
  progress: string
}) {
  const colors = useColors()
  const statusColor =
    status === 'success' ? colors.primary : status === 'pending' ? colors.warning : colors.danger

  return (
    <div
      data-animate-task
      className="p-4 rounded-lg"
      style={{
        border: `2px solid ${colors.border}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: 'translateX(20px)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="text-sm font-semibold mb-1" style={{ color: colors.text }}>
            {title}
          </div>
          <div className="text-xs" style={{ color: colors.textMuted }}>
            {progress}
          </div>
        </div>
        <div
          data-animate-status
          className="px-3 py-1 rounded text-xs font-semibold"
          style={{
            backgroundColor: `${statusColor}20`,
            color: statusColor,
            opacity: 0,
            transform: 'scale(0.8)',
          }}
        >
          {status.toUpperCase()}
        </div>
      </div>
    </div>
  )
}

// Skill step component
export function SkillStep({
  title,
  description,
  icon,
}: {
  title: string
  description: string
  icon: string
}) {
  const colors = useColors()
  return (
    <div
      data-animate-step
      className="flex flex-col items-center justify-center p-4 rounded-lg shrink-0"
      style={{
        border: `2px solid ${colors.border}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: 'scale(0.8)',
        width: '110px',
        minHeight: '100px',
      }}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-sm font-semibold mb-1" style={{ color: colors.text }}>
        {title}
      </div>
      <p className="text-xs" style={{ color: colors.textMuted }}>
        {description}
      </p>
    </div>
  )
}

// Skill arrow component
export function SkillArrow() {
  const colors = useColors()
  return (
    <div
      data-animate-step
      className="text-2xl"
      style={{ color: colors.accent, opacity: 0, transform: 'scale(0.8)' }}
    >
      →
    </div>
  )
}

// Sandbox box component
export function SandboxBox() {
  const colors = useColors()
  return (
    <div
      data-animate-sandbox
      className="p-5 rounded-lg text-center"
      style={{
        border: `2px solid ${colors.accent}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: 'translateY(20px)',
      }}
    >
      <div className="text-3xl mb-3">🔒</div>
      <div className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
        Secure Sandbox
      </div>
      <p className="text-sm" style={{ color: colors.textMuted }}>
        Execute code in isolated environments
      </p>
    </div>
  )
}

// Metric box component
export function MetricBox({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  const colors = useColors()
  return (
    <div
      data-animate-metric
      className="p-6 rounded-lg text-center"
      style={{
        border: `2px solid ${colors.border}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: 'scale(0.8)',
      }}
    >
      <div className="text-2xl font-bold mb-2" style={{ color }}>
        {value}
      </div>
      <div className="text-sm" style={{ color: colors.textMuted }}>
        {label}
      </div>
    </div>
  )
}

// Chart box component
export function ChartBox() {
  const colors = useColors()
  const heights = [60, 80, 75, 90, 85, 95, 88]
  return (
    <div
      className="p-6 rounded-lg"
      style={{
        border: `2px solid ${colors.border}`,
        backgroundColor: colors.terminal,
      }}
    >
      <div className="flex items-end gap-3 h-32">
        {heights.map((percent, index) => (
          <div
            key={index}
            data-animate-bar
            className="flex-1 rounded-t"
            style={{
              backgroundColor: colors.primary,
              height: '0%',
            }}
            data-height={percent}
          />
        ))}
      </div>
    </div>
  )
}

// Tagline component
export function Tagline({
  children,
  color,
  colorRgb,
}: {
  children: React.ReactNode
  color: string
  colorRgb: string
}) {
  return (
    <div
      data-animate-tagline
      className="text-center text-sm font-semibold mt-6"
      style={{
        color: color,
        textShadow: `0 0 5px rgba(${colorRgb}, 0.5)`,
        opacity: 0,
      }}
    >
      {children}
    </div>
  )
}

// Section title component
export function SectionTitle({
  children,
  color,
  colorRgb,
}: {
  children: React.ReactNode
  color: string
  colorRgb: string
}) {
  return (
    <div
      data-animate-title
      className="text-3xl font-bold mb-8 text-center"
      style={{
        color: color,
        textShadow: `0 0 20px rgba(${colorRgb}, 0.4)`,
        opacity: 0,
        transform: 'translateY(-20px)',
      }}
    >
      {children}
    </div>
  )
}

// Code container (animated)
export function CodeContainer({ children }: { children: React.ReactNode }) {
  return (
    <div data-animate-code style={{ opacity: 0 }}>
      {children}
    </div>
  )
}
