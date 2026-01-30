'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import gsap from 'gsap'
import { useColors } from './shared/terminal-components'

// Animated metric card
function MetricCard({
  label,
  value,
  change,
  color,
  icon,
}: {
  label: string
  value: string
  change?: string
  color: string
  icon: string
}) {
  const colors = useColors()
  const cardRef = useRef<HTMLDivElement>(null)
  const [displayValue, setDisplayValue] = useState('0')

  const handleClick = () => {
    if (!cardRef.current) return
    gsap.to(cardRef.current, {
      scale: 0.95,
      duration: 0.1,
      yoyo: true,
      repeat: 1,
      ease: 'power2.inOut',
    })
  }

  useEffect(() => {
    const numericValue = parseFloat(value.replace(/[^0-9.]/g, ''))
    const suffix = value.replace(/[0-9.,]/g, '')
    const start = 0
    const duration = 1000
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = start + (numericValue - start) * eased

      if (suffix === '%') {
        setDisplayValue(`${current.toFixed(1)}%`)
      } else if (suffix === 'M') {
        setDisplayValue(`${current.toFixed(1)}M`)
      } else if (suffix === 'K') {
        setDisplayValue(`${current.toFixed(0)}K`)
      } else {
        setDisplayValue(Math.round(current).toLocaleString())
      }

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    const timer = setTimeout(animate, 500)
    return () => clearTimeout(timer)
  }, [value])

  return (
    <div
      ref={cardRef}
      data-animate-metric
      onClick={handleClick}
      className="p-5 rounded-xl cursor-pointer transition-all hover:scale-[1.02]"
      style={{
        border: `2px solid ${colors.border}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: 'translateY(20px)',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {change && (
          <span
            className="text-xs px-2 py-1 rounded-full font-medium"
            style={{
              backgroundColor: change.startsWith('+') ? `${colors.primary}20` : `${colors.danger}20`,
              color: change.startsWith('+') ? colors.primary : colors.danger,
            }}
          >
            {change}
          </span>
        )}
      </div>
      <div className="text-3xl font-bold mb-1" style={{ color }}>
        {displayValue}
      </div>
      <div className="text-sm" style={{ color: colors.textMuted }}>
        {label}
      </div>
    </div>
  )
}

// Animated bar chart with fixed pixel heights
function BarChart() {
  const colors = useColors()
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)
  const maxBarHeight = 140 // Maximum bar height in pixels

  const data = [
    { day: 'Mon', value: 65, tasks: 234 },
    { day: 'Tue', value: 82, tasks: 289 },
    { day: 'Wed', value: 58, tasks: 256 },
    { day: 'Thu', value: 95, tasks: 312 },
    { day: 'Fri', value: 78, tasks: 298 },
    { day: 'Sat', value: 42, tasks: 156 },
    { day: 'Sun', value: 35, tasks: 124 },
  ]

  return (
    <div
      data-animate-chart
      className="p-5 rounded-xl h-full flex flex-col"
      style={{
        border: `2px solid ${colors.border}`,
        backgroundColor: colors.terminal,
        opacity: 0,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-base font-semibold" style={{ color: colors.text }}>
          Weekly Activity
        </span>
        <span className="text-sm" style={{ color: colors.textMuted }}>
          {hoveredBar !== null ? `${data[hoveredBar].tasks} tasks` : 'Hover for details'}
        </span>
      </div>
      <div className="flex items-end justify-between gap-3 flex-1 pb-2">
        {data.map((item, index) => {
          const barHeight = (item.value / 100) * maxBarHeight
          return (
            <div key={index} className="flex-1 flex flex-col items-center gap-2">
              <div
                className="relative w-full flex items-end justify-center"
                style={{ height: maxBarHeight }}
              >
                <div
                  data-animate-bar
                  className="w-full rounded-t-md cursor-pointer transition-colors"
                  style={{
                    backgroundColor: hoveredBar === index ? colors.secondary : colors.primary,
                    height: 0,
                    boxShadow: hoveredBar === index ? `0 0 15px ${colors.secondary}` : 'none',
                  }}
                  data-height={barHeight}
                  onMouseEnter={() => setHoveredBar(index)}
                  onMouseLeave={() => setHoveredBar(null)}
                />
              </div>
              <span className="text-xs font-medium" style={{ color: colors.textDim }}>
                {item.day}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Activity feed
function ActivityFeed() {
  const colors = useColors()
  const activities = [
    { icon: '✓', text: 'Task extracted: Deploy to prod', time: '2m', color: colors.primary },
    { icon: '↗', text: 'Skill uploaded: data-extraction', time: '5m', color: colors.accent },
    { icon: '●', text: 'Session created: alice@acme.com', time: '8m', color: colors.secondary },
    { icon: '⬆', text: 'Artifact uploaded to disk', time: '12m', color: colors.warning },
    { icon: '✓', text: 'Sandbox command executed', time: '15m', color: colors.primary },
  ]

  return (
    <div
      data-animate-feed
      className="p-5 rounded-xl h-full flex flex-col"
      style={{
        border: `2px solid ${colors.border}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: 'translateX(20px)',
      }}
    >
      <div className="text-base font-semibold mb-4" style={{ color: colors.text }}>
        Recent Activity
      </div>
      <div className="space-y-3 flex-1">
        {activities.map((activity, i) => (
          <div
            key={i}
            data-animate-activity
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            style={{ opacity: 0 }}
          >
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0"
              style={{ backgroundColor: `${activity.color}20`, color: activity.color }}
            >
              {activity.icon}
            </span>
            <span className="flex-1 text-sm truncate" style={{ color: colors.text }}>
              {activity.text}
            </span>
            <span className="text-xs shrink-0" style={{ color: colors.textDim }}>
              {activity.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardFeature() {
  const containerRef = useRef<HTMLDivElement>(null)
  const colors = useColors()

  const runAnimation = useCallback(() => {
    if (!containerRef.current) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline()

      tl.to(
        '[data-animate-metric]',
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          stagger: 0.1,
          ease: 'power2.out',
        },
        0.1,
      )
        .to('[data-animate-chart]', { opacity: 1, duration: 0.4 }, 0.3)
        .to(
          '[data-animate-bar]',
          {
            height: function (_, target) {
              const el = target as HTMLElement
              const height = el.getAttribute('data-height') || '0'
              return `${height}px`
            },
            duration: 0.8,
            stagger: 0.1,
            ease: 'power2.out',
          },
          0.5,
        )
        .to('[data-animate-feed]', { opacity: 1, x: 0, duration: 0.4 }, 0.4)
        .to(
          '[data-animate-activity]',
          {
            opacity: 1,
            duration: 0.3,
            stagger: 0.1,
          },
          0.6,
        )
    }, containerRef)

    return () => ctx.revert()
  }, [])

  useEffect(() => {
    const cleanup = runAnimation()
    return cleanup
  }, [runAnimation])

  return (
    <div ref={containerRef} className="flex flex-col w-full h-full px-10 py-6">
      <div className="grid grid-cols-4 gap-4 mb-4">
        <MetricCard
          label="Success Rate"
          value="94.2%"
          change="+2.3%"
          color={colors.primary}
          icon="✓"
        />
        <MetricCard
          label="Total Tasks"
          value="1234"
          change="+156"
          color={colors.secondary}
          icon="📋"
        />
        <MetricCard
          label="Token Usage"
          value="2.1M"
          change="-5%"
          color={colors.accent}
          icon="🪙"
        />
        <MetricCard
          label="Active Sessions"
          value="47"
          color={colors.warning}
          icon="👥"
        />
      </div>

      <div className="grid grid-cols-3 gap-4 flex-1">
        <div className="col-span-2">
          <BarChart />
        </div>
        <div className="col-span-1">
          <ActivityFeed />
        </div>
      </div>
    </div>
  )
}
