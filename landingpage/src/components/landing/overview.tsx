'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Database, Eye, Sparkles, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

import { StoreDemo } from '../animation/demos/store-demo'
import { ObserveDemo } from '../animation/demos/observe-demo'
import { SkillsDemo } from '../animation/demos/skills-demo'
import { DashboardDemo } from '../animation/demos/dashboard-demo'
import type { FeatureTab, FeatureTabId } from '../animation/demos/shared'
import { TAB_COLORS } from '../animation/demos/shared'

// ─── Tab definitions ────────────────────────────────────────────────────────

const TABS: FeatureTab[] = [
  {
    id: 'store',
    title: 'Store',
    subtitle: 'Sessions & Disk',
    description: 'Store and retrieve messages across OpenAI, Anthropic, and Gemini with automatic format conversion.',
    color: TAB_COLORS.store,
    icon: Database,
    duration: 14_000,
    Demo: StoreDemo,
  },
  {
    id: 'observe',
    title: 'Observe',
    subtitle: 'Task Extraction',
    description: 'Auto-extract tasks from agent conversations with real-time observation and tracking.',
    color: TAB_COLORS.observe,
    icon: Eye,
    duration: 16_000,
    Demo: ObserveDemo,
  },
  {
    id: 'skills',
    title: 'Learn',
    subtitle: 'Skill Learning',
    description: 'Attach a session to a Learning Space and Acontext automatically distills successful task outcomes into reusable skills — your agents improve with every run.',
    color: TAB_COLORS.skills,
    icon: Sparkles,
    duration: 11_000,
    Demo: SkillsDemo,
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    subtitle: 'Analytics',
    description: 'Real-time analytics, task tracking, and actionable insights across all your agents.',
    color: TAB_COLORS.dashboard,
    icon: LayoutDashboard,
    duration: 10_000,
    Demo: DashboardDemo,
  },
]

// ─── Main component ─────────────────────────────────────────────────────────

export function FeaturesOverview() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [cycleKey, setCycleKey] = useState(0)

  const pausedRef = useRef(false)
  const startTimeRef = useRef(Date.now())
  const rafRef = useRef<number | null>(null)
  const activeIndexRef = useRef(activeIndex)

  // Keep ref in sync
  useEffect(() => {
    activeIndexRef.current = activeIndex
  }, [activeIndex])

  // Switch to a specific tab (manual click)
  const switchTab = useCallback((index: number) => {
    if (index === activeIndexRef.current) return
    setActiveIndex(index)
    setCycleKey((k) => k + 1)
    startTimeRef.current = Date.now()
    setProgress(0)
  }, [])

  // Auto-rotation via requestAnimationFrame
  useEffect(() => {
    let alive = true

    const tick = () => {
      if (!alive) return

      if (!pausedRef.current) {
        const tab = TABS[activeIndexRef.current]
        const duration = tab?.duration ?? 10_000
        const elapsed = Date.now() - startTimeRef.current
        const p = Math.min(elapsed / duration, 1)
        setProgress(p)

        if (p >= 1) {
          // Advance to next tab
          const next = (activeIndexRef.current + 1) % TABS.length
          setActiveIndex(next)
          setCycleKey((k) => k + 1)
          activeIndexRef.current = next
          startTimeRef.current = Date.now()
          setProgress(0)
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      alive = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const activeTab = TABS[activeIndex]
  const ActiveDemo = activeTab?.Demo

  return (
    <section
      id="features-overview"
      className="py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
    >
      {/* Section header */}
      <div className="w-full max-w-[768px] lg:max-w-[1200px] mx-auto mb-8 sm:mb-12">
        <div className="flex flex-col items-center gap-2 lg:gap-3">
          <h2 className="max-w-xl text-3xl sm:text-4xl lg:text-5xl leading-[1.1] text-center font-semibold text-foreground">
            How It Works
          </h2>
          <p className="max-w-xl text-sm sm:text-base lg:text-lg text-center text-muted-foreground">
            The capabilities that power production AI agents — store context, observe behavior, learn from experience, and monitor everything.
          </p>
        </div>
      </div>

      {/* Main container */}
      <div className="w-full max-w-[768px] lg:max-w-[1200px] mx-auto">
        <div
          className="border border-border dark:border-neutral-800 rounded-lg overflow-hidden bg-card dark:bg-neutral-950/50 flex flex-col lg:flex-row min-h-96 sm:min-h-112 lg:h-160"
          onMouseEnter={() => { pausedRef.current = true }}
          onMouseLeave={() => { pausedRef.current = false }}
        >
          {/* Tab sidebar */}
          <div className="lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-border dark:border-neutral-800 lg:h-full">
            <div className="flex lg:flex-col overflow-x-auto lg:overflow-visible lg:h-full">
              {TABS.map((tab, i) => {
                const isActive = i === activeIndex
                const Icon = tab.icon

                return (
                  <button
                    key={tab.id}
                    onClick={() => switchTab(i)}
                    className={cn(
                      'relative px-4 sm:px-5 py-3 sm:py-4 text-left transition-colors flex-1',
                      tab.id === 'dashboard' && 'opacity-70',
                      isActive
                        ? 'bg-muted dark:bg-neutral-900 opacity-100'
                        : 'hover:bg-muted/50 dark:hover:bg-neutral-900/50 hover:opacity-100',
                      i > 0 && 'border-l lg:border-l-0 lg:border-t border-border dark:border-neutral-800',
                    )}
                  >
                    <div className="flex flex-col gap-0.5 sm:gap-1">
                      <div className="flex items-center gap-2">
                        <Icon
                          className="w-4 h-4 shrink-0 transition-colors"
                          style={{ color: isActive ? tab.color : `${tab.color}99` }}
                        />
                        <span
                          className="text-sm font-medium transition-colors whitespace-nowrap"
                          style={{ color: isActive ? tab.color : `${tab.color}99` }}
                        >
                          {tab.title}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground hidden lg:block">
                        {tab.subtitle}
                      </span>
                      <p className="text-xs text-muted-foreground/60 hidden lg:block mt-1 line-clamp-2">
                        {tab.description}
                      </p>
                    </div>

                    {/* Progress bar */}
                    {isActive && (
                      <>
                        {/* Horizontal progress (mobile) */}
                        <div
                          className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden lg:hidden"
                          style={{ backgroundColor: `${tab.color}30` }}
                        >
                          <div
                            className="h-full origin-left"
                            style={{
                              backgroundColor: tab.color,
                              transform: `scaleX(${progress})`,
                            }}
                          />
                        </div>
                        {/* Vertical progress (desktop) */}
                        <div
                          className="absolute top-0 bottom-0 left-0 w-0.5 overflow-hidden hidden lg:block"
                          style={{ backgroundColor: `${tab.color}30` }}
                        >
                          <div
                            className="w-full h-full origin-top"
                            style={{
                              backgroundColor: tab.color,
                              transform: `scaleY(${progress})`,
                            }}
                          />
                        </div>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Demo area */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={`${activeTab?.id}-${cycleKey}`}
                className="h-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {ActiveDemo && <ActiveDemo />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
