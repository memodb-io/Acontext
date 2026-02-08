'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Database,
  Eye,
  Sparkles,
  LayoutDashboard,
  Monitor,
  Check,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Icon wrapper for tool call log ─────────────────────────────────────────

export function LogIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon
  className?: string
}) {
  return <Icon className={cn('w-4 h-4 text-zinc-500 dark:text-zinc-400', className)} />
}

// ─── Tool call log entry ────────────────────────────────────────────────────

interface ToolCall {
  id: string
  message: string
  label: string
  icon: LucideIcon
  iconClassName?: string
}

function ToolCallEntry({
  call,
  isLast,
  size = 'sm',
}: {
  call: ToolCall
  isLast: boolean
  size?: 'sm' | 'lg'
}) {
  const isLg = size === 'lg'
  const Icon = call.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20, duration: 0.5 }}
      className={`flex items-stretch ${isLg ? 'gap-3' : 'gap-2'}`}
    >
      <div className="flex flex-col items-center self-stretch">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.15 }}
          className={cn(
            'bg-zinc-200 dark:bg-zinc-800 rounded-lg backdrop-blur flex items-center justify-center',
            isLg ? 'p-2.5 min-w-10 min-h-10' : 'p-1.5 min-w-8 min-h-8',
          )}
        >
          <Icon className={cn('w-4 h-4 text-zinc-500 dark:text-zinc-400', call.iconClassName)} />
        </motion.div>
        {!isLast && (
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className={cn(
              'w-px flex-1 bg-zinc-300 dark:bg-zinc-700 origin-top',
              isLg ? 'min-h-4' : 'min-h-3',
            )}
          />
        )}
      </div>
      <div className={cn('flex-1 min-w-0', isLg ? 'pb-2' : 'pb-1')}>
        <p
          className={cn(
            'text-zinc-600 dark:text-zinc-400 font-medium',
            isLg ? 'text-sm' : 'text-xs',
          )}
        >
          {call.message}
        </p>
        <p
          className={cn(
            'text-zinc-400 dark:text-zinc-500 capitalize',
            isLg ? 'text-xs' : 'text-[11px]',
          )}
        >
          {call.label}
        </p>
      </div>
    </motion.div>
  )
}

// ─── Tool call log list ─────────────────────────────────────────────────────

export function ToolCallLog({
  calls,
  size = 'sm',
}: {
  calls: ToolCall[]
  size?: 'sm' | 'lg'
}) {
  return (
    <div className="space-y-0">
      <AnimatePresence mode="popLayout">
        {calls.map((call, i) => (
          <ToolCallEntry
            key={call.id}
            call={call}
            isLast={i === calls.length - 1}
            size={size}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

// ─── Typing animation hook ──────────────────────────────────────────────────

export function useTypingAnimation(text: string, active: boolean, speed = 50) {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    if (!active) {
      setDisplayed('')
      return
    }

    let i = 0
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1))
        i++
      } else {
        clearInterval(interval)
      }
    }, speed)

    return () => clearInterval(interval)
  }, [text, active, speed])

  return displayed
}

// ─── Count-up animation ─────────────────────────────────────────────────────

export function CountUp({
  end,
  duration = 2000,
  prefix = '',
  suffix = '',
  decimals = 0,
  active = true,
}: {
  end: number
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
  active?: boolean
}) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!active) {
      setValue(0)
      return
    }

    const startTime = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(eased * end)

      if (progress < 1) {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
  }, [end, duration, active])

  const formatted = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString()

  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}

// ─── Acontext logo icon ─────────────────────────────────────────────────────

export function AcontextIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-4 h-4', className)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── Provider badges ────────────────────────────────────────────────────────

const providerStyles: Record<string, { bg: string; text: string; border: string }> = {
  openai: {
    bg: 'bg-emerald-100/50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-300/50 dark:border-emerald-500/30',
  },
  anthropic: {
    bg: 'bg-orange-100/50 dark:bg-orange-950/30',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-300/50 dark:border-orange-500/30',
  },
  gemini: {
    bg: 'bg-blue-100/50 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-300/50 dark:border-blue-500/30',
  },
}

export function ProviderBadge({ provider }: { provider: 'openai' | 'anthropic' | 'gemini' }) {
  const style = providerStyles[provider]
  const labels = { openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Gemini' }

  return (
    <span
      className={cn(
        'text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 border font-medium',
        style.bg,
        style.text,
        style.border,
      )}
    >
      {labels[provider]}
    </span>
  )
}

// ─── Status badge ───────────────────────────────────────────────────────────

const statusStyles: Record<string, { bg: string; text: string; border: string }> = {
  pending: {
    bg: 'bg-zinc-200 dark:bg-zinc-800',
    text: 'text-zinc-500 dark:text-zinc-400',
    border: 'border-zinc-300 dark:border-zinc-700',
  },
  running: {
    bg: 'bg-blue-100/50 dark:bg-blue-950/50',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-300 dark:border-blue-700',
  },
  done: {
    bg: 'bg-emerald-100/50 dark:bg-emerald-950/50',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-300 dark:border-emerald-700',
  },
}

export function StatusBadge({
  status,
}: {
  status: 'pending' | 'running' | 'done'
}) {
  const style = statusStyles[status]
  return (
    <motion.span
      key={status}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'text-[10px] sm:text-xs px-1.5 py-0.5 border font-mono uppercase',
        style.bg,
        style.text,
        style.border,
      )}
    >
      {status}
    </motion.span>
  )
}

// ─── Tab accent colors ──────────────────────────────────────────────────────

export type FeatureTabId = 'store' | 'observe' | 'skills' | 'dashboard'

export interface FeatureTab {
  id: FeatureTabId
  title: string
  subtitle: string
  description: string
  color: string
  icon: LucideIcon
  duration: number
  Demo: React.ComponentType
}

export const TAB_COLORS: Record<FeatureTabId, string> = {
  store: '#34d399',    // emerald-400
  observe: '#22d3ee',  // cyan-400
  skills: '#a78bfa',   // violet-400
  dashboard: '#fbbf24', // amber-400
}
