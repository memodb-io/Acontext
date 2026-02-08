'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  TrendingUp,
  ListChecks,
  Coins,
  Users,
  Activity,
  Lightbulb,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CountUp } from './shared'

// ─── Timeline stages ────────────────────────────────────────────────────────

type Stage = 'init' | 'metrics' | 'chart' | 'activity' | 'insight' | 'settled'

const TIMELINE: Record<Stage, number> = {
  'init': 0,
  'metrics': 500,
  'chart': 3000,
  'activity': 5000,
  'insight': 7500,
  'settled': 9500,
}

const STAGES: Stage[] = Object.keys(TIMELINE) as Stage[]

// ─── Metric definitions ─────────────────────────────────────────────────────

const METRICS = [
  { label: 'Success Rate', value: 97.2, suffix: '%', decimals: 1, icon: TrendingUp, color: 'text-emerald-400' },
  { label: 'Total Tasks', value: 1247, suffix: '', decimals: 0, icon: ListChecks, color: 'text-cyan-400' },
  { label: 'Token Usage', value: 842, suffix: 'K', decimals: 0, icon: Coins, color: 'text-amber-400' },
  { label: 'Active Sessions', value: 23, suffix: '', decimals: 0, icon: Users, color: 'text-violet-400' },
]

// ─── Chart data ─────────────────────────────────────────────────────────────

const CHART_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const CHART_VALUES = [65, 82, 55, 90, 78, 45, 88] // percentages of max height

// ─── Activity feed ──────────────────────────────────────────────────────────

const ACTIVITY_ITEMS = [
  { text: 'Session #1247 completed', time: '2m ago', color: 'bg-emerald-500' },
  { text: 'Skill "api-deploy" executed', time: '5m ago', color: 'bg-violet-500' },
  { text: '3 tasks extracted from #1245', time: '8m ago', color: 'bg-cyan-500' },
  { text: 'New session by alice@acme.com', time: '12m ago', color: 'bg-blue-500' },
]

// ─── Main Dashboard Demo ────────────────────────────────────────────────────

export function DashboardDemo() {
  const [stage, setStage] = useState<Stage>('init')

  useEffect(() => {
    setStage('init')

    const timers: ReturnType<typeof setTimeout>[] = []
    for (const [s, delay] of Object.entries(TIMELINE)) {
      if (delay > 0) {
        timers.push(setTimeout(() => setStage(s as Stage), delay))
      }
    }
    return () => timers.forEach(clearTimeout)
  }, [])

  const si = STAGES.indexOf(stage)
  const showMetrics = si >= STAGES.indexOf('metrics')
  const showChart = si >= STAGES.indexOf('chart')
  const showActivity = si >= STAGES.indexOf('chart')
  const showInsight = si >= STAGES.indexOf('insight')

  return (
    <div className="h-full flex items-center justify-center p-3 sm:p-4 lg:p-6">
      <div className="w-full max-w-4xl space-y-3 sm:space-y-4">
        {/* Metrics row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {METRICS.map((metric, i) => {
            const Icon = metric.icon
            return (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 16 }}
                animate={showMetrics ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 300, damping: 25 }}
                className="border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50 p-2.5 sm:p-4 rounded-lg"
              >
                <div className="flex items-center gap-1.5 mb-1 sm:mb-2">
                  <Icon className={cn('w-3.5 h-3.5 sm:w-4 sm:h-4', metric.color)} />
                  <span className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500">{metric.label}</span>
                </div>
                <div className="text-lg sm:text-2xl font-bold text-zinc-800 dark:text-zinc-200 font-mono">
                  {showMetrics ? (
                    <CountUp
                      end={metric.value}
                      suffix={metric.suffix}
                      decimals={metric.decimals}
                      duration={2000}
                    />
                  ) : (
                    <span className="text-zinc-300 dark:text-zinc-700">--</span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Chart + Activity row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 sm:gap-3">
          {/* Bar chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={showChart ? { opacity: 1, y: 0 } : {}}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="lg:col-span-3 border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50 p-3 sm:p-4 rounded-lg flex flex-col"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 font-medium">Weekly Activity</span>
              <Activity className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
            </div>
            <div className="flex items-stretch gap-1.5 sm:gap-2 flex-1 min-h-[80px] sm:min-h-[120px]">
              {CHART_DAYS.map((day, i) => (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex-1 bg-zinc-200 dark:bg-zinc-800 rounded-sm overflow-hidden relative">
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 bg-emerald-500/80 dark:bg-emerald-500/60 rounded-sm"
                      initial={{ height: 0 }}
                      animate={showChart ? { height: `${CHART_VALUES[i]}%` } : { height: 0 }}
                      transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-[9px] sm:text-[10px] text-zinc-400 dark:text-zinc-600">{day}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Activity feed */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={showActivity ? { opacity: 1, y: 0 } : {}}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="lg:col-span-2 border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50 p-3 sm:p-4 rounded-lg"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 font-medium">Recent</span>
            </div>
            <div className="space-y-2">
              <AnimatePresence>
                {showActivity &&
                  ACTIVITY_ITEMS.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.2, type: 'spring', stiffness: 300, damping: 25 }}
                      className="flex items-start gap-2"
                    >
                      <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', item.color)} />
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs text-zinc-700 dark:text-zinc-300 truncate">{item.text}</p>
                        <p className="text-[9px] sm:text-[10px] text-zinc-400 dark:text-zinc-600">{item.time}</p>
                      </div>
                    </motion.div>
                  ))}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* Insight notification */}
        <AnimatePresence>
          {showInsight && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="border border-amber-300/50 dark:border-amber-700/50 bg-amber-100/30 dark:bg-amber-950/20 rounded-lg p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3"
            >
              <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 dark:text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 font-medium">
                  Task completion rate up 12% this week
                </p>
                <p className="text-[10px] sm:text-xs text-amber-600/70 dark:text-amber-500/70">
                  Driven by improved skill reuse across 8 agents
                </p>
              </div>
              <Check className="w-4 h-4 text-amber-500/50 dark:text-amber-500/50 shrink-0" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
