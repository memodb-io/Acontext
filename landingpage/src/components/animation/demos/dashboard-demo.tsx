'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
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

// ─── Metric definitions ─────────────────────────────────────────────────────

const METRICS = [
  { label: 'Success Rate', value: 97.2, suffix: '%', decimals: 1, icon: TrendingUp, color: 'text-emerald-400' },
  { label: 'Total Tasks', value: 1247, suffix: '', decimals: 0, icon: ListChecks, color: 'text-cyan-400' },
  { label: 'Token Usage', value: 842, suffix: 'K', decimals: 0, icon: Coins, color: 'text-amber-400' },
  { label: 'Active Sessions', value: 23, suffix: '', decimals: 0, icon: Users, color: 'text-violet-400' },
]

// ─── Chart data ─────────────────────────────────────────────────────────────

const CHART_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const CHART_VALUES = [65, 82, 55, 90, 78, 45, 88]

// ─── Activity feed ──────────────────────────────────────────────────────────

const ACTIVITY_ITEMS = [
  { text: 'Session #1247 completed', time: '2m ago', color: 'bg-emerald-500' },
  { text: 'Skill "api-deploy" executed', time: '5m ago', color: 'bg-violet-500' },
  { text: '3 tasks extracted from #1245', time: '8m ago', color: 'bg-cyan-500' },
  { text: 'New session by alice@acme.com', time: '12m ago', color: 'bg-blue-500' },
]

// ─── Main Dashboard Demo ────────────────────────────────────────────────────

export function DashboardDemo() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline()

      // ── 0.5s: Metric cards appear with stagger ──
      tl.to('[data-metric-card]', {
        opacity: 1, y: 0, duration: 0.5,
        stagger: 0.1, ease: 'power3.out',
      }, 0.5)

      // ── 0.5s: Count-up tweens for each metric value ──
      METRICS.forEach((m, i) => {
        const proxy = { val: 0 }
        tl.to(proxy, {
          val: m.value,
          duration: 2,
          ease: 'power3.out',
          onUpdate() {
            const el = containerRef.current?.querySelector(`[data-metric-value="${i}"]`) as HTMLElement | null
            if (!el) return
            const formatted = m.decimals > 0 ? proxy.val.toFixed(m.decimals) : Math.round(proxy.val).toLocaleString()
            el.textContent = `${formatted}${m.suffix}`
          },
        }, 0.7 + i * 0.1)
      })

      // ── 3.0s: Chart container + bars ──
      tl.set('[data-chart-container]', { display: '' }, 3.0)
      tl.to('[data-chart-container]', {
        opacity: 1, y: 0, duration: 0.5, ease: 'power3.out',
      }, 3.0)

      CHART_VALUES.forEach((v, i) => {
        tl.to(`[data-chart-bar="${i}"]`, {
          height: `${v}%`, duration: 0.8, ease: 'power2.out',
        }, 3.0 + i * 0.1)
      })

      // ── 3.0s: Activity container + items ──
      tl.set('[data-activity-container]', { display: '' }, 3.0)
      tl.to('[data-activity-container]', {
        opacity: 1, y: 0, duration: 0.5, ease: 'power3.out',
      }, 3.0)

      tl.to('[data-activity-item]', {
        opacity: 1, x: 0, duration: 0.5,
        stagger: 0.2, ease: 'power3.out',
      }, 3.2)

      // ── 7.5s: Insight notification ──
      tl.set('[data-insight]', { display: '' }, 7.5)
      tl.to('[data-insight]', {
        opacity: 1, y: 0, duration: 0.5, ease: 'power3.out',
      }, 7.5)
    }, containerRef)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={containerRef} className="h-full flex items-center justify-center p-3 sm:p-4 lg:p-6">
      <div className="w-full max-w-4xl space-y-3 sm:space-y-4">
        {/* Metrics row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {METRICS.map((metric, i) => {
            const Icon = metric.icon
            return (
              <div
                key={metric.label}
                data-metric-card
                style={{ opacity: 0, transform: 'translateY(16px)' }}
                className="border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50 p-2.5 sm:p-4 rounded-lg"
              >
                <div className="flex items-center gap-1.5 mb-1 sm:mb-2">
                  <Icon className={cn('w-3.5 h-3.5 sm:w-4 sm:h-4', metric.color)} />
                  <span className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500">{metric.label}</span>
                </div>
                <div className="text-lg sm:text-2xl font-bold text-zinc-800 dark:text-zinc-200 font-mono">
                  <span data-metric-value={i} className="text-zinc-300 dark:text-zinc-700">--</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Chart + Activity row — hidden until 3.0s */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 sm:gap-3">
          {/* Bar chart */}
          <div
            data-chart-container
            style={{ display: 'none', opacity: 0, transform: 'translateY(16px)' }}
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
                    <div
                      data-chart-bar={i}
                      className="absolute bottom-0 left-0 right-0 bg-emerald-500/80 dark:bg-emerald-500/60 rounded-sm"
                      style={{ height: 0 }}
                    />
                  </div>
                  <span className="text-[9px] sm:text-[10px] text-zinc-400 dark:text-zinc-600">{day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity feed */}
          <div
            data-activity-container
            style={{ display: 'none', opacity: 0, transform: 'translateY(16px)' }}
            className="lg:col-span-2 border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50 p-3 sm:p-4 rounded-lg"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 font-medium">Recent</span>
            </div>
            <div className="space-y-2">
              {ACTIVITY_ITEMS.map((item, i) => (
                <div
                  key={i}
                  data-activity-item
                  style={{ opacity: 0, transform: 'translateX(12px)' }}
                  className="flex items-start gap-2"
                >
                  <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', item.color)} />
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-zinc-700 dark:text-zinc-300 truncate">{item.text}</p>
                    <p className="text-[9px] sm:text-[10px] text-zinc-400 dark:text-zinc-600">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Insight notification — hidden until 7.5s */}
        <div
          data-insight
          style={{ display: 'none', opacity: 0, transform: 'translateY(12px)' }}
          className="border border-amber-300/50 dark:border-amber-700/50 bg-amber-100/30 dark:bg-amber-950/20 rounded-lg p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3"
        >
          <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 dark:text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 font-medium">
              Skill reuse rate up 18% this week
            </p>
            <p className="text-[10px] sm:text-xs text-amber-600/70 dark:text-amber-500/70">
              Agents completing tasks 2x faster with learned skills
            </p>
          </div>
          <Check className="w-4 h-4 text-amber-500/50 dark:text-amber-500/50 shrink-0" />
        </div>
      </div>
    </div>
  )
}
