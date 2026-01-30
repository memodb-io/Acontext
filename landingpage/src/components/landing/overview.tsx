'use client'

import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { Database, Eye, Sparkles, LayoutDashboard } from 'lucide-react'
import gsap from 'gsap'
import type { TabId, Tab } from '../animation/shared/types'
import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../animation/shared/types'
import { darkColors, lightColors } from '../animation/shared/colors'
import { ColorsContext } from '../animation/shared/terminal-components'
import { StoreFeature } from '../animation/store-feature'
import { ObserveFeature } from '../animation/observe-feature'
import { SkillsFeature } from '../animation/skills-feature'
import { DashboardFeature } from '../animation/dashboard-feature'

export function FeaturesOverview() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [scale, setScale] = useState(1)
  const [activeTab, setActiveTab] = useState<TabId>('store')
  const [isAnimating, setIsAnimating] = useState(false)
  const [hoveredTab, setHoveredTab] = useState<TabId | null>(null)

  // Handle hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle responsive scaling
  useEffect(() => {
    if (!wrapperRef.current) return

    const updateScale = () => {
      if (!wrapperRef.current) return
      const wrapperWidth = wrapperRef.current.offsetWidth
      const newScale = Math.min(wrapperWidth / DESIGN_WIDTH, 1)
      setScale(newScale)
    }

    updateScale()

    const resizeObserver = new ResizeObserver(updateScale)
    resizeObserver.observe(wrapperRef.current)

    return () => resizeObserver.disconnect()
  }, [mounted])

  // Select colors based on theme
  const colors = useMemo(() => {
    if (!mounted) return darkColors
    return resolvedTheme === 'dark' ? darkColors : lightColors
  }, [resolvedTheme, mounted])

  const themeForShadow = mounted && resolvedTheme ? resolvedTheme : 'dark'

  // Tab definitions
  const tabs: Tab[] = useMemo(
    () => [
      {
        id: 'store',
        label: 'Store',
        description: 'Sessions & Disk Storage',
        icon: Database,
        color: colors.primary,
        colorRgb: colors.primaryRgb,
      },
      {
        id: 'observe',
        label: 'Observe',
        description: 'Task Extraction & Traces',
        icon: Eye,
        color: colors.secondary,
        colorRgb: colors.secondaryRgb,
      },
      {
        id: 'skills',
        label: 'Agent Skills',
        description: 'Reusable Skills & Sandbox',
        icon: Sparkles,
        color: colors.accent,
        colorRgb: colors.accentRgb,
      },
      {
        id: 'dashboard',
        label: 'Dashboard',
        description: 'Analytics & Insights',
        icon: LayoutDashboard,
        color: colors.warning,
        colorRgb: '255, 184, 108',
      },
    ],
    [colors],
  )

  // Tab change with animation
  const handleTabClick = useCallback(
    (tabId: TabId) => {
      if (tabId === activeTab || isAnimating) return

      setIsAnimating(true)

      // Fade out current content
      if (contentRef.current) {
        gsap.to(contentRef.current, {
          opacity: 0,
          y: -10,
          duration: 0.2,
          ease: 'power2.in',
          onComplete: () => {
            setActiveTab(tabId)
            // Fade in new content
            gsap.fromTo(
              contentRef.current,
              { opacity: 0, y: 10 },
              {
                opacity: 1,
                y: 0,
                duration: 0.3,
                ease: 'power2.out',
                onComplete: () => setIsAnimating(false),
              },
            )
          },
        })
      } else {
        setActiveTab(tabId)
        setIsAnimating(false)
      }
    },
    [activeTab, isAnimating],
  )

  const activeTabData = tabs.find((t) => t.id === activeTab)

  return (
    <ColorsContext.Provider value={colors}>
      <section
        id="features-overview"
        className="sm:py-16 lg:py-24 sm:px-6 lg:px-8 relative overflow-hidden"
      >
        {/* Background decorations */}
        <div className="absolute inset-0 -z-10">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full blur-3xl transition-colors duration-500"
            style={{ backgroundColor: `rgba(${activeTabData?.colorRgb}, 0.05)` }}
          />
        </div>

        {/* Tab Navigation - Outside animation container */}
        <div className="w-full max-w-[1200px] mx-auto my-8 px-3 sm:px-0">
          <div className="flex flex-wrap items-center justify-center gap-1.5 min-[480px]:gap-2 sm:gap-3">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              const isHighlighted = isActive || hoveredTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  disabled={isAnimating}
                  onMouseEnter={() => setHoveredTab(tab.id)}
                  onMouseLeave={() => setHoveredTab(null)}
                  className="group p-2.5 min-[480px]:px-3 min-[480px]:py-2 sm:px-6 sm:py-4 rounded-lg sm:rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-3 border sm:border-2 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: isHighlighted
                      ? `rgba(${tab.colorRgb}, 0.15)`
                      : `rgba(${tab.colorRgb}, 0.05)`,
                    borderColor: isHighlighted ? tab.color : `rgba(${tab.colorRgb}, 0.25)`,
                    color: isHighlighted ? tab.color : `rgba(${tab.colorRgb}, 0.6)`,
                    boxShadow: isHighlighted ? `0 0 20px rgba(${tab.colorRgb}, 0.2)` : 'none',
                    transform: isHighlighted ? 'scale(1.02)' : 'scale(1)',
                  }}
                >
                  <Icon
                    className="w-5 h-5 sm:w-[22px] sm:h-[22px] transition-all duration-300 group-hover:scale-110 shrink-0"
                    style={{
                      color: isHighlighted ? tab.color : 'inherit',
                      filter: isHighlighted ? `drop-shadow(0 0 8px ${tab.color})` : 'none',
                    }}
                  />
                  {/* xs (480px+): short label, sm+: label + description */}
                  <span className="hidden min-[480px]:inline sm:hidden font-bold text-xs">{tab.label}</span>
                  <div className="text-left hidden sm:block">
                    <div className="font-bold text-base">{tab.label}</div>
                    <div className="text-xs opacity-70">{tab.description}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Responsive wrapper */}
        <div ref={wrapperRef} className="w-full max-w-[1200px] mx-auto">
          {/* Scaled container wrapper */}
          <div
            className="relative mx-auto"
            suppressHydrationWarning
            style={{
              width: DESIGN_WIDTH * scale,
              height: DESIGN_HEIGHT * scale,
            }}
          >
            {/* Animation container */}
            <div
              className="absolute top-0 left-0 rounded-2xl overflow-hidden origin-top-left"
              suppressHydrationWarning
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                backgroundColor: colors.bg,
                width: DESIGN_WIDTH,
                height: DESIGN_HEIGHT,
                transform: `scale(${scale})`,
                boxShadow:
                  themeForShadow === 'dark'
                    ? `0 4px 40px rgba(0, 0, 0, 0.4), 0 0 60px rgba(${activeTabData?.colorRgb}, 0.1)`
                    : '0 2px 20px rgba(0, 0, 0, 0.1)',
                border: `1px solid ${colors.border}`,
              }}
            >
              {/* Scanline overlay */}
              <div
                className="absolute inset-0 pointer-events-none z-50"
                style={{
                  background: `repeating-linear-gradient(
                    0deg,
                    rgba(255, 255, 255, 0.015) 0px,
                    rgba(255, 255, 255, 0.015) 1px,
                    transparent 1px,
                    transparent 2px
                  )`,
                }}
              />

              {/* Vignette */}
              <div
                className="absolute inset-0 pointer-events-none z-40"
                suppressHydrationWarning
                style={{
                  boxShadow:
                    themeForShadow === 'dark'
                      ? 'inset 0 0 120px rgba(0, 0, 0, 0.6)'
                      : 'inset 0 0 80px rgba(0, 0, 0, 0.05)',
                }}
              />

              {/* Active tab indicator bar with glow */}
              <div
                className="absolute top-0 left-0 right-0 h-1 z-30 transition-colors duration-300"
                style={{
                  backgroundColor: activeTabData?.color,
                  boxShadow: `0 0 30px ${activeTabData?.color}, 0 2px 10px ${activeTabData?.color}`,
                }}
              />

              {/* Tab content */}
              <div ref={contentRef} className="absolute inset-0 pt-1">
                {activeTab === 'store' && <StoreFeature key="store" />}
                {activeTab === 'observe' && <ObserveFeature key="observe" />}
                {activeTab === 'skills' && <SkillsFeature key="skills" />}
                {activeTab === 'dashboard' && <DashboardFeature key="dashboard" />}
              </div>
            </div>
          </div>
        </div>
      </section>
    </ColorsContext.Provider>
  )
}
