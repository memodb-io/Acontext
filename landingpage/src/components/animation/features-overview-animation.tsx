'use client'

import { useRef, useEffect, useMemo, createContext, useContext, useState } from 'react'
import { useTheme } from 'next-themes'
import gsap from 'gsap'
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'

// Color palette type
type ColorPalette = {
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

// Dark theme - Terminal/Matrix style
const darkColors: ColorPalette = {
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
const lightColors: ColorPalette = {
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

// Context for colors
const ColorsContext = createContext<ColorPalette>(darkColors)
const useColors = () => useContext(ColorsContext)

// Design dimensions - the animation is designed for this size
const DESIGN_WIDTH = 1200
const DESIGN_HEIGHT = 800 // Increased height for better layout

export function FeaturesOverviewAnimation() {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const masterTimelineRef = useRef<gsap.core.Timeline | null>(null)
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [scale, setScale] = useState(1)
  const [isPlaying, setIsPlaying] = useState(true)
  const [currentScene, setCurrentScene] = useState(0)

  // Scene time points (in seconds)
  const sceneTimes = [0, 8, 20, 28, 36, 44]
  const totalScenes = sceneTimes.length

  // Handle hydration - wait until client-side to get actual theme
  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle responsive scaling
  useEffect(() => {
    if (!wrapperRef.current) return

    const updateScale = () => {
      if (!wrapperRef.current) return
      const wrapperWidth = wrapperRef.current.offsetWidth
      // Calculate scale based on wrapper width vs design width
      const newScale = Math.min(wrapperWidth / DESIGN_WIDTH, 1)
      setScale(newScale)
    }

    // Initial calculation
    updateScale()

    // Listen for resize
    const resizeObserver = new ResizeObserver(updateScale)
    resizeObserver.observe(wrapperRef.current)

    return () => resizeObserver.disconnect()
  }, [mounted])

  // Select colors based on theme
  // Use consistent default during SSR to avoid hydration mismatch
  const colors = useMemo(() => {
    // During SSR, always use darkColors to match server render
    // After hydration, use the actual theme
    if (!mounted) return darkColors
    return resolvedTheme === 'dark' ? darkColors : lightColors
  }, [resolvedTheme, mounted])

  // Get theme for boxShadow - use consistent default during SSR
  const themeForShadow = mounted && resolvedTheme ? resolvedTheme : 'dark'

  // Control functions
  const togglePlayPause = () => {
    if (!masterTimelineRef.current) return
    if (isPlaying) {
      masterTimelineRef.current.pause()
      setIsPlaying(false)
    } else {
      masterTimelineRef.current.play()
      setIsPlaying(true)
    }
  }

  const restart = () => {
    if (!masterTimelineRef.current) return
    masterTimelineRef.current.restart()
    setIsPlaying(true)
    setCurrentScene(0)
  }

  const goToScene = (sceneIndex: number) => {
    if (!masterTimelineRef.current) return
    if (sceneIndex < 0 || sceneIndex >= totalScenes) return

    const targetTime = sceneTimes[sceneIndex]
    masterTimelineRef.current.seek(targetTime)
    setCurrentScene(sceneIndex)
    setIsPlaying(true)
    masterTimelineRef.current.play()
  }

  const goToPreviousScene = () => {
    if (currentScene > 0) {
      goToScene(currentScene - 1)
    }
  }

  const goToNextScene = () => {
    if (currentScene < totalScenes - 1) {
      goToScene(currentScene + 1)
    }
  }

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current

    // Create GSAP context scoped to the container
    const ctx = gsap.context(() => {
      const master = gsap.timeline({ repeat: -1, repeatDelay: 2 })
      masterTimelineRef.current = master

      // SCENE 1: Platform Overview (0-8s)
      const scene1 = gsap.timeline()
      scene1
        // Hide Scene 6 at the start to ensure clean transition when looping
        .set('[data-scene="6"]', { opacity: 0 }, 0)
        .set('[data-cta="button"]', { opacity: 0 }, 0)
        .to('[data-scene="1"]', { opacity: 1, duration: 0.3 }, 0)
        .to('[data-title="main"]', { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 0.3)
        .to('[data-subtitle="main"]', { opacity: 1, y: 0, duration: 0.5 }, 0.8)
        .to(
          '[data-pillar]',
          {
            opacity: 1,
            scale: 1,
            duration: 0.5,
            stagger: 0.15,
            ease: 'back.out(1.4)',
          },
          1.2,
        )
        .to(
          '[data-pillar="store"]',
          {
            borderColor: colors.primary,
            boxShadow: `0 0 20px rgba(${colors.primaryRgb}, 0.4)`,
            duration: 0.3,
          },
          2.5,
        )
        .to(
          '[data-pillar="store"] [data-icon]',
          {
            scale: 1.2,
            duration: 0.3,
          },
          2.5,
        )
        .to(
          '[data-pillar="observe"]',
          {
            borderColor: colors.secondary,
            boxShadow: `0 0 20px rgba(${colors.secondaryRgb}, 0.4)`,
            duration: 0.3,
          },
          4,
        )
        .to(
          '[data-pillar="observe"] [data-icon]',
          {
            scale: 1.2,
            duration: 0.3,
          },
          4,
        )
        .to(
          '[data-pillar="learn"]',
          {
            borderColor: colors.accent,
            boxShadow: `0 0 20px rgba(${colors.accentRgb}, 0.4)`,
            duration: 0.3,
          },
          5.5,
        )
        .to(
          '[data-pillar="learn"] [data-icon]',
          {
            scale: 1.2,
            duration: 0.3,
          },
          5.5,
        )
        .to('[data-scene="1"]', { opacity: 0, duration: 0.3 }, 7.7)

      // SCENE 2: Short-term Memory (8-20s) - Extended duration
      const scene2 = gsap.timeline()
      scene2
        .to('[data-scene="2"]', { opacity: 1, duration: 0.3 }, 0)
        .to('[data-section="storage"]', { opacity: 1, y: 0, duration: 0.5 }, 0.3)
        .to(
          '[data-code="store"]',
          {
            opacity: 1,
            duration: 0.4,
            ease: 'power2.out',
          },
          0.8,
        )
        // Highlight artifact code block first (1.5s)
        .to(
          '[data-code-block="artifact"]',
          {
            backgroundColor: `rgba(${colors.accentRgb}, 0.15)`,
            opacity: 1,
            duration: 0.3,
          },
          1.5,
        )
        // Dim other code blocks when artifact is highlighted
        .to(
          '[data-code-block="space"]',
          {
            opacity: 0.3,
            duration: 0.3,
          },
          1.5,
        )
        .to(
          '[data-code-block="session"]',
          {
            opacity: 0.3,
            duration: 0.3,
          },
          1.5,
        )
        .to(
          '[data-storage="artifact"]',
          {
            opacity: 1,
            x: 0,
            borderColor: colors.accent,
            duration: 0.4,
            ease: 'power2.out',
          },
          1.5,
        )
        // Remove artifact highlight, highlight space code block (4.5s)
        .to(
          '[data-code-block="artifact"]',
          {
            backgroundColor: 'transparent',
            opacity: 0.3,
            duration: 0.3,
          },
          4.5,
        )
        .to(
          '[data-code-block="space"]',
          {
            backgroundColor: `rgba(${colors.secondaryRgb}, 0.15)`,
            opacity: 1,
            duration: 0.3,
          },
          4.5,
        )
        // Dim other code blocks when space is highlighted
        .to(
          '[data-code-block="session"]',
          {
            opacity: 0.3,
            duration: 0.3,
          },
          4.5,
        )
        .to(
          '[data-storage="space"]',
          {
            opacity: 1,
            x: 0,
            borderColor: colors.secondary,
            duration: 0.4,
            ease: 'power2.out',
          },
          4.5,
        )
        // Remove space highlight, highlight session code block (7.5s)
        .to(
          '[data-code-block="space"]',
          {
            backgroundColor: 'transparent',
            opacity: 0.3,
            duration: 0.3,
          },
          7.5,
        )
        .to(
          '[data-code-block="session"]',
          {
            backgroundColor: `rgba(${colors.primaryRgb}, 0.15)`,
            opacity: 1,
            duration: 0.3,
          },
          7.5,
        )
        // Dim other code blocks when session is highlighted
        .to(
          '[data-code-block="artifact"]',
          {
            opacity: 0.3,
            duration: 0.3,
          },
          7.5,
        )
        .to(
          '[data-storage="session"]',
          {
            opacity: 1,
            x: 0,
            borderColor: colors.primary,
            duration: 0.4,
            ease: 'power2.out',
          },
          7.5,
        )
        // Remove session highlight, restore all opacity (10.5s)
        .to(
          '[data-code-block="session"]',
          {
            backgroundColor: 'transparent',
            opacity: 1,
            duration: 0.3,
          },
          10.5,
        )
        .to(
          '[data-code-block="artifact"]',
          {
            opacity: 1,
            duration: 0.3,
          },
          10.5,
        )
        .to(
          '[data-code-block="space"]',
          {
            opacity: 1,
            duration: 0.3,
          },
          10.5,
        )
        .to('[data-counter="storage"]', { opacity: 1, duration: 0.3 }, 10.5)
        .to('[data-scene="2"]', { opacity: 0, duration: 0.3 }, 11.7)

      // SCENE 3: Observe - Task Monitoring (16-24s)
      const scene3 = gsap.timeline()
      scene3
        .to('[data-scene="3"]', { opacity: 1, duration: 0.3 }, 0)
        .to('[data-section="observe"]', { opacity: 1, y: 0, duration: 0.5 }, 0.3)
        .to(
          '[data-code="observe"]',
          {
            opacity: 1,
            duration: 0.4,
            ease: 'power2.out',
          },
          0.8,
        )
        .to(
          '[data-task]',
          {
            opacity: 1,
            x: 0,
            duration: 0.4,
            stagger: 0.15,
            ease: 'power2.out',
          },
          1.5,
        )
        .to(
          '[data-task]',
          {
            borderColor: colors.secondary,
            duration: 0.2,
            stagger: 0.1,
          },
          2.5,
        )
        .to(
          '[data-task-status]',
          {
            opacity: 1,
            scale: 1,
            duration: 0.3,
            stagger: 0.15,
          },
          3,
        )
        .to('[data-counter="observe"]', { opacity: 1, duration: 0.3 }, 3.5)
        .to('[data-scene="3"]', { opacity: 0, duration: 0.3 }, 7.7)

      // SCENE 4: Learn - Experience & Skills (24-32s)
      const scene4 = gsap.timeline()
      scene4
        .to('[data-scene="4"]', { opacity: 1, duration: 0.3 }, 0)
        .to('[data-section="learn"]', { opacity: 1, y: 0, duration: 0.5 }, 0.3)
        .to(
          '[data-code="learn"]',
          {
            opacity: 1,
            duration: 0.4,
            ease: 'power2.out',
          },
          0.8,
        )
        .to(
          '[data-code="learn"]',
          {
            opacity: 1,
            duration: 0.4,
            ease: 'power2.out',
          },
          0.8,
        )
        .to(
          '[data-skill="extract"]',
          {
            opacity: 1,
            x: 0,
            scale: 1,
            duration: 0.5,
            ease: 'back.out(1.2)',
          },
          1.2,
        )
        .call(() => {
          const arrows = document.querySelectorAll(
            '[data-skill="arrow"]',
          ) as NodeListOf<SVGPathElement>
          arrows.forEach((arrow) => {
            if (arrow instanceof SVGPathElement) {
              const length = arrow.getTotalLength()
              gsap.set(arrow, {
                strokeDasharray: length,
                strokeDashoffset: length,
              })
            }
          })
        })
        .to(
          '[data-skill="arrow"]',
          {
            opacity: 1,
            strokeDashoffset: 0,
            duration: 0.6,
            ease: 'power1.inOut',
          },
          1.4,
        )
        .to(
          '[data-skill="store"]',
          {
            opacity: 1,
            x: 0,
            scale: 1,
            duration: 0.5,
            ease: 'back.out(1.2)',
          },
          1.8,
        )
        .to(
          '[data-skill="arrow"]',
          {
            opacity: 1,
            strokeDashoffset: 0,
            duration: 0.6,
            ease: 'power1.inOut',
          },
          2,
        )
        .to(
          '[data-skill="search"]',
          {
            opacity: 1,
            x: 0,
            scale: 1,
            duration: 0.5,
            ease: 'back.out(1.2)',
          },
          2.4,
        )
        .to(
          '[data-experience]',
          {
            opacity: 1,
            scale: 1,
            duration: 0.4,
            ease: 'power2.out',
          },
          3,
        )
        .to('[data-counter="learn"]', { opacity: 1, duration: 0.3 }, 3.5)
        .to('[data-scene="4"]', { opacity: 0, duration: 0.3 }, 7.7)

      // SCENE 5: Dashboard Metrics (32-40s)
      const scene5 = gsap.timeline()
      scene5
        .to('[data-scene="5"]', { opacity: 1, duration: 0.3 }, 0)
        .to('[data-section="dashboard"]', { opacity: 1, y: 0, duration: 0.5 }, 0.3)
        .to(
          '[data-metric]',
          {
            opacity: 1,
            scale: 1,
            duration: 0.4,
            stagger: 0.1,
            ease: 'back.out(1.2)',
          },
          0.8,
        )
        .to(
          '[data-metric-type="success"]',
          {
            borderColor: colors.primary,
            boxShadow: `0 0 15px rgba(${colors.primaryRgb}, 0.3)`,
            duration: 0.3,
          },
          2,
        )
        .to(
          '[data-chart="bar"]',
          {
            height: function (index, target) {
              const el = target as HTMLElement
              const height = el.getAttribute('data-height') || '0'
              return `${height}%`
            },
            duration: 0.6,
            stagger: 0.1,
            ease: 'power2.out',
          },
          2.3,
        )
        .to('[data-counter="dashboard"]', { opacity: 1, duration: 0.3 }, 3.2)
        .to('[data-scene="5"]', { opacity: 0, duration: 0.3 }, 7.7)

      // SCENE 6: CTA (40-52s)
      const scene6 = gsap.timeline()
      scene6
        .to('[data-scene="6"]', { opacity: 1, duration: 0.3 }, 0)
        // Reset button state at start to ensure it's visible when scene restarts
        .set('[data-cta="button"]', { opacity: 0, scale: 0.9 }, 0)
        .to(
          '[data-cta="logo"]',
          {
            opacity: 1,
            scale: 1,
            duration: 0.5,
            ease: 'elastic.out(1, 0.5)',
          },
          0.3,
        )
        .to('[data-cta="tagline"]', { opacity: 1, y: 0, duration: 0.4 }, 0.6)
        .to(
          '[data-cta="feature"]',
          {
            opacity: 1,
            y: 0,
            duration: 0.3,
            stagger: 0.08,
            ease: 'power2.out',
          },
          0.9,
        )
        .to(
          '[data-cta="button"]',
          {
            opacity: 1,
            scale: 1,
            duration: 0.4,
            ease: 'back.out(1.3)',
          },
          1.3,
        )
        // Keep button visible for the entire scene duration
        .to('[data-cta="button"]', { opacity: 1, scale: 1, duration: 0 }, 1.7)
        .to('[data-cta="button"]', { opacity: 1, scale: 1, duration: 0 }, 5)
        .to('[data-cta="button"]', { opacity: 1, scale: 1, duration: 0 }, 11.7)
        // Keep scene visible until the end
        .to('[data-scene="6"]', { opacity: 1, duration: 0 }, 11.7)

      // Chain all scenes - Total 60 seconds (extended for scene 2)
      master
        .add(scene1, 0)
        .add(scene2, 8)
        .add(scene3, 20) // Adjusted for extended scene 2
        .add(scene4, 28) // Adjusted
        .add(scene5, 36) // Adjusted
        .add(scene6, 44) // Adjusted

      // Update current scene based on timeline progress
      master.eventCallback('onUpdate', () => {
        const currentTime = master.time()
        // Find which scene we're currently in
        for (let i = sceneTimes.length - 1; i >= 0; i--) {
          if (currentTime >= sceneTimes[i]) {
            setCurrentScene(i)
            break
          }
        }
      })
    }, container)

    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors])

  return (
    <ColorsContext.Provider value={colors}>
      <section
        id="features-overview"
        className="sm:py-16 lg:py-24 sm:px-6 lg:px-8 relative overflow-hidden"
      >
        {/* Background decorations */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        </div>

        {/* Responsive wrapper - measures available width */}
        <div ref={wrapperRef} className="w-full max-w-[1200px] mx-auto">
          {/* Scaled container wrapper - maintains aspect ratio */}
          <div
            className="relative mx-auto"
            suppressHydrationWarning
            style={{
              width: DESIGN_WIDTH * scale,
              height: DESIGN_HEIGHT * scale,
            }}
          >
            {/* Animation container - fixed design size, scaled down */}
            <div
              ref={containerRef}
              className="absolute top-0 left-0 rounded-xl overflow-hidden origin-top-left"
              suppressHydrationWarning
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                backgroundColor: colors.bg,
                width: DESIGN_WIDTH,
                height: DESIGN_HEIGHT,
                transform: `scale(${scale})`,
                boxShadow:
                  themeForShadow === 'dark'
                    ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                    : '0 2px 12px rgba(0, 0, 0, 0.08)',
              }}
            >
              {/* Control buttons - positioned in bottom right */}
              <div
                className="absolute bottom-4 right-4 z-50 hidden md:flex gap-2"
                style={{
                  transform: `scale(${1 / scale})`,
                  transformOrigin: 'bottom right',
                }}
              >
                <button
                  onClick={togglePlayPause}
                  className="px-2 py-1.5 rounded font-semibold transition-all hover:scale-105 active:scale-95 select-none flex items-center justify-center"
                  style={{
                    backgroundColor: colors.elevated,
                    border: `2px solid ${colors.primary}`,
                    color: colors.primary,
                    boxShadow: `0 0 10px rgba(${colors.primaryRgb}, 0.3)`,
                    textShadow: `0 0 5px rgba(${colors.primaryRgb}, 0.5)`,
                    userSelect: 'none',
                    cursor: 'none',
                  }}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button
                  onClick={restart}
                  className="px-2 py-1.5 rounded font-semibold transition-all hover:scale-105 active:scale-95 select-none flex items-center justify-center"
                  style={{
                    backgroundColor: colors.elevated,
                    border: `2px solid ${colors.secondary}`,
                    color: colors.secondary,
                    boxShadow: `0 0 10px rgba(${colors.secondaryRgb}, 0.3)`,
                    textShadow: `0 0 5px rgba(${colors.secondaryRgb}, 0.5)`,
                    userSelect: 'none',
                    cursor: 'none',
                  }}
                  aria-label="Restart"
                >
                  <RotateCcw size={18} />
                </button>
                <button
                  onClick={goToPreviousScene}
                  disabled={currentScene === 0}
                  className="px-2 py-1.5 rounded font-semibold transition-all hover:scale-105 active:scale-95 select-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  style={{
                    backgroundColor: colors.elevated,
                    border: `2px solid ${colors.accent}`,
                    color: colors.accent,
                    boxShadow: `0 0 10px rgba(${colors.accentRgb}, 0.3)`,
                    textShadow: `0 0 5px rgba(${colors.accentRgb}, 0.5)`,
                    userSelect: 'none',
                    cursor: currentScene === 0 ? 'not-allowed' : 'none',
                    opacity: currentScene === 0 ? 0.5 : 1,
                  }}
                  aria-label="Previous Scene"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={goToNextScene}
                  disabled={currentScene === totalScenes - 1}
                  className="px-2 py-1.5 rounded font-semibold transition-all hover:scale-105 active:scale-95 select-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  style={{
                    backgroundColor: colors.elevated,
                    border: `2px solid ${colors.accent}`,
                    color: colors.accent,
                    boxShadow: `0 0 10px rgba(${colors.accentRgb}, 0.3)`,
                    textShadow: `0 0 5px rgba(${colors.accentRgb}, 0.5)`,
                    userSelect: 'none',
                    cursor: currentScene === totalScenes - 1 ? 'not-allowed' : 'none',
                    opacity: currentScene === totalScenes - 1 ? 0.5 : 1,
                  }}
                  aria-label="Next Scene"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              {/* Scanline overlay */}
              <div
                className="absolute inset-0 pointer-events-none z-50"
                style={{
                  background: `repeating-linear-gradient(
                    0deg,
                    rgba(255, 255, 255, 0.02) 0px,
                    rgba(255, 255, 255, 0.02) 1px,
                    transparent 1px,
                    transparent 2px
                  )`,
                }}
              />

              {/* Vignette - only in dark mode */}
              <div
                className="absolute inset-0 pointer-events-none z-40"
                suppressHydrationWarning
                style={{
                  boxShadow:
                    themeForShadow === 'dark'
                      ? 'inset 0 0 150px rgba(0, 0, 0, 0.8)'
                      : 'inset 0 0 100px rgba(0, 0, 0, 0.1)',
                }}
              />

              {/* SCENE 1: Platform Overview */}
              <Scene scene="1">
                <div className="flex flex-col items-center justify-center w-full px-12">
                  <h2
                    data-title="main"
                    className="text-4xl font-bold mb-4"
                    style={{
                      color: colors.primary,
                      textShadow: `0 0 20px rgba(${colors.primaryRgb}, 0.6)`,
                      opacity: 0,
                      transform: 'translateY(-20px)',
                    }}
                  >
                    Acontext Platform
                  </h2>
                  <p
                    data-subtitle="main"
                    className="text-lg mb-12"
                    style={{
                      color: colors.textMuted,
                      opacity: 0,
                      transform: 'translateY(-10px)',
                    }}
                  >
                    The Agent Memory Stack
                  </p>

                  <div className="flex gap-8 justify-center items-center">
                    <Pillar
                      dataPillar="store"
                      icon="💾"
                      title="Store"
                      description="Short-term memory & editing"
                      color={colors.primary}
                    />
                    <Pillar
                      dataPillar="observe"
                      icon="📊"
                      title="Observe"
                      description="Task monitoring & metrics"
                      color={colors.secondary}
                    />
                    <Pillar
                      dataPillar="learn"
                      icon="🧠"
                      title="Learn"
                      description="Long-term skill"
                      color={colors.accent}
                    />
                  </div>
                </div>
              </Scene>

              {/* SCENE 2: Short-term Memory */}
              <Scene scene="2">
                <div className="flex flex-col items-center justify-start w-full px-12 pt-8">
                  <h3
                    data-section="storage"
                    className="text-3xl font-bold mb-8"
                    style={{
                      color: colors.primary,
                      opacity: 0,
                      transform: 'translateY(-20px)',
                    }}
                  >
                    Short-term Memory Architecture
                  </h3>

                  <div className="grid grid-cols-2 gap-6 w-full max-w-5xl mb-6">
                    <TerminalWindow dataCode="store" title="Store Context" initialOpacity={0}>
                      {/* Artifact code block - first */}
                      <div
                        data-code-block="artifact"
                        style={{
                          padding: '4px 8px',
                          margin: '0 -8px',
                          borderRadius: '4px',
                          backgroundColor: 'transparent',
                          opacity: 1,
                          transition: 'background-color 0.3s',
                        }}
                      >
                        <CodeLine comment># Upload and store artifacts</CodeLine>
                        <CodeLine>
                          artifact = client.<Fn>disks</Fn>.<Fn>artifacts</Fn>.<Fn>upsert</Fn>(
                        </CodeLine>
                        <CodeLine indent={2}>
                          disk.<Fn>id</Fn>,
                        </CodeLine>
                        <CodeLine indent={2}>
                          <Str>file</Str>=file,
                        </CodeLine>
                        <CodeLine indent={2}>
                          <Str>file_path</Str>=<Str>&quot;/documents/2024/&quot;</Str>
                        </CodeLine>
                        <CodeLine>)</CodeLine>
                      </div>

                      {/* Space code block - second */}
                      <div
                        data-code-block="space"
                        style={{
                          padding: '4px 8px',
                          margin: '8px -8px 0',
                          borderRadius: '4px',
                          backgroundColor: 'transparent',
                          opacity: 1,
                          transition: 'background-color 0.3s',
                        }}
                      >
                        <CodeLine comment># Step 1: Create a Space for skill learning</CodeLine>
                        <CodeLine>
                          space = client.<Fn>spaces</Fn>.<Fn>create</Fn>()
                        </CodeLine>
                        <CodeLine>
                          print(<Str>f&quot;Created Space: {'{'}</Str>space.<Fn>id</Fn>
                          <Str>{'}'}&quot;</Str>)
                        </CodeLine>
                        <CodeLine comment style={{ marginTop: 8 }}>
                          # Step 2: Create a session attached to the space
                        </CodeLine>
                        <CodeLine>
                          session = client.<Fn>sessions</Fn>.<Fn>create</Fn>(
                        </CodeLine>
                        <CodeLine indent={2}>
                          <Str>space_id</Str>=space.<Fn>id</Fn>
                        </CodeLine>
                        <CodeLine>)</CodeLine>
                      </div>

                      {/* Session code block - third */}
                      <div
                        data-code-block="session"
                        style={{
                          padding: '4px 8px',
                          margin: '8px -8px 0',
                          borderRadius: '4px',
                          backgroundColor: 'transparent',
                          opacity: 1,
                          transition: 'background-color 0.3s',
                        }}
                      >
                        <CodeLine comment># Store messages from any provider</CodeLine>
                        <CodeLine>
                          client.<Fn>sessions</Fn>.<Fn>store_message</Fn>(
                        </CodeLine>
                        <CodeLine indent={2}>
                          <Str>session_id</Str>=<Str>&quot;abc-123&quot;</Str>,
                        </CodeLine>
                        <CodeLine indent={2}>
                          <Str>blob</Str>={'{'}
                          <Str>&quot;role&quot;</Str>: <Str>&quot;user&quot;</Str>,{' '}
                          <Str>&quot;content&quot;</Str>: <Str>&quot;Hello&quot;</Str>
                          {'}'},
                        </CodeLine>
                        <CodeLine indent={2}>
                          <Str>format</Str>=<Str>&quot;openai&quot;</Str>
                        </CodeLine>
                        <CodeLine>)</CodeLine>
                      </div>
                    </TerminalWindow>

                    <div className="flex flex-col gap-3">
                      <StorageBox
                        dataStorage="artifact"
                        title="Artifacts"
                        description="Files & outputs"
                        icon="📦"
                        initialX={-40}
                        color={colors.accent}
                      />
                      <StorageBox
                        dataStorage="space"
                        title="Spaces"
                        description="Knowledge bases"
                        icon="🗂️"
                        initialX={-40}
                        color={colors.secondary}
                      />
                      <StorageBox
                        dataStorage="session"
                        title="Sessions"
                        description="Conversation threads"
                        icon="💬"
                        initialX={-40}
                        color={colors.primary}
                      />
                    </div>
                  </div>

                  <Counter dataCounter="storage" style={{ marginTop: 12 }}>
                    Unified storage for all agent context
                  </Counter>
                </div>
              </Scene>

              {/* SCENE 3: Observe - Task Monitoring */}
              <Scene scene="3">
                <div className="flex flex-col items-center justify-center w-full px-12">
                  <h3
                    data-section="observe"
                    className="text-3xl font-bold mb-6"
                    style={{
                      color: colors.secondary,
                      opacity: 0,
                      transform: 'translateY(-20px)',
                    }}
                  >
                    Task Monitoring & Mid-term State
                  </h3>

                  <div className="grid grid-cols-2 gap-6 w-full max-w-5xl mb-6">
                    <TerminalWindow dataCode="observe" title="Get Tasks" initialOpacity={0}>
                      <CodeLine comment># Get extracted tasks from session</CodeLine>
                      <CodeLine>
                        tasks = client.<Fn>sessions</Fn>.<Fn>get_tasks</Fn>(
                      </CodeLine>
                      <CodeLine indent={2}>
                        <Str>session_id</Str>=<Str>&quot;abc-123&quot;</Str>
                      </CodeLine>
                      <CodeLine>)</CodeLine>
                      <CodeLine comment style={{ marginTop: 8 }}>
                        # Returns: Task list with status, progress
                      </CodeLine>
                    </TerminalWindow>

                    <div className="w-full space-y-3">
                      <TaskBox
                        dataTask
                        title="Task #1: Search iPhone news"
                        status="success"
                        progress="Completed and reported"
                        color={colors.primary}
                      />
                      <TaskBox
                        dataTask
                        title="Task #2: Initialize project"
                        status="pending"
                        progress="Waiting for approval"
                        color={colors.warning}
                      />
                      <TaskBox
                        dataTask
                        title="Task #3: Deploy landing page"
                        status="pending"
                        progress="Not started"
                        color={colors.textDim}
                      />
                    </div>
                  </div>

                  <Counter dataCounter="observe" style={{ marginTop: 12 }}>
                    Track agent tasks in real-time
                  </Counter>
                </div>
              </Scene>

              {/* SCENE 4: Learn - Experience & Skills */}
              <Scene scene="4">
                <div className="flex flex-col items-center justify-center w-full px-12">
                  <h3
                    data-section="learn"
                    className="text-3xl font-bold mb-6"
                    style={{
                      color: colors.accent,
                      opacity: 0,
                      transform: 'translateY(-20px)',
                    }}
                  >
                    Long-term Skill
                  </h3>

                  <div className="grid grid-cols-2 gap-6 w-full max-w-5xl mb-6">
                    <TerminalWindow dataCode="learn" title="Search Skills" initialOpacity={0}>
                      <CodeLine comment># Search skills from Space</CodeLine>
                      <CodeLine>
                        result = client.<Fn>spaces</Fn>.<Fn>experience_search</Fn>(
                      </CodeLine>
                      <CodeLine indent={2}>
                        <Str>space_id</Str>=<Str>&quot;space-123&quot;</Str>,
                      </CodeLine>
                      <CodeLine indent={2}>
                        <Str>query</Str>=<Str>&quot;authentication&quot;</Str>,
                      </CodeLine>
                      <CodeLine indent={2}>
                        <Str>mode</Str>=<Str>&quot;agentic&quot;</Str>
                      </CodeLine>
                      <CodeLine>)</CodeLine>
                      <CodeLine comment style={{ marginTop: 8 }}>
                        # Returns: Relevant SOPs and skills
                      </CodeLine>
                    </TerminalWindow>

                    <div className="w-full space-y-4">
                      <div className="flex items-center gap-3 justify-center">
                        <SkillBox
                          dataSkill="extract"
                          title="Extract"
                          description="SOP"
                          icon="🔍"
                          color={colors.accent}
                        />
                        <SkillArrow dataSkill="arrow" color={colors.accent} />
                        <SkillBox
                          dataSkill="store"
                          title="Store"
                          description="Skills"
                          icon="💾"
                          color={colors.accent}
                        />
                        <SkillArrow dataSkill="arrow" color={colors.accent} />
                        <SkillBox
                          dataSkill="search"
                          title="Search"
                          description="Reuse"
                          icon="📖"
                          color={colors.accent}
                        />
                      </div>

                      <ExperienceBox
                        dataExperience
                        title="Successful Session"
                        description="Task completed with user approval"
                      />
                    </div>
                  </div>

                  <Counter dataCounter="learn" style={{ marginTop: 12 }}>
                    Learn from successful experiences
                  </Counter>
                </div>
              </Scene>

              {/* SCENE 5: Dashboard Metrics */}
              <Scene scene="5">
                <div className="flex flex-col items-center justify-center w-full px-12">
                  <h3
                    data-section="dashboard"
                    className="text-3xl font-bold mb-6"
                    style={{
                      color: colors.primary,
                      opacity: 0,
                      transform: 'translateY(-20px)',
                    }}
                  >
                    Dashboard & Analytics
                  </h3>

                  <div className="w-full max-w-4xl">
                    <div className="grid grid-cols-3 gap-6 mb-8">
                      <MetricBox
                        dataMetric
                        dataMetricType="success"
                        label="Success Rate"
                        value="94.2%"
                        color={colors.primary}
                      />
                      <MetricBox
                        dataMetric
                        label="Total Tasks"
                        value="1,234"
                        color={colors.secondary}
                      />
                      <MetricBox
                        dataMetric
                        label="Avg Latency"
                        value="1.2s"
                        color={colors.accent}
                      />
                    </div>

                    <ChartBox colors={colors} />
                  </div>

                  <Counter dataCounter="dashboard" style={{ marginTop: 24 }}>
                    Monitor agent performance in real-time
                  </Counter>
                </div>
              </Scene>

              {/* SCENE 6: CTA */}
              <Scene scene="6">
                <div className="text-center max-w-2xl mx-auto px-8">
                  <div
                    data-cta="logo"
                    className="text-5xl font-semibold mb-4"
                    style={{
                      color: colors.primary,
                      textShadow: `0 0 20px rgba(${colors.primaryRgb}, 0.6)`,
                      opacity: 0,
                      transform: 'scale(0.5)',
                    }}
                  >
                    [ ACONTEXT ]
                  </div>
                  <div
                    data-cta="tagline"
                    className="text-lg mb-10"
                    style={{
                      color: colors.textMuted,
                      opacity: 0,
                      transform: 'translateY(10px)',
                    }}
                  >
                    Build AI agents that learn and improve
                  </div>

                  <div className="flex justify-center gap-12 mb-12">
                    <FeatureIcon symbol="💾" label="Store" />
                    <FeatureIcon symbol="📊" label="Observe" />
                    <FeatureIcon symbol="🧠" label="Learn" />
                    <FeatureIcon symbol="📈" label="Dashboard" />
                  </div>

                  <CTAButton href="https://dash.acontext.io/" colors={colors} dataCta="button" />
                </div>
              </Scene>
            </div>
          </div>
        </div>
      </section>
    </ColorsContext.Provider>
  )
}

// Sub-components
function Scene({ scene, children }: { scene: string; children: React.ReactNode }) {
  return (
    <div
      data-scene={scene}
      className="absolute inset-0 flex items-center justify-center"
      style={{ opacity: 0 }}
    >
      {children}
    </div>
  )
}

function Pillar({
  dataPillar,
  icon,
  title,
  description,
  color: _color,
}: {
  dataPillar: string
  icon: string
  title: string
  description: string
  color: string
}) {
  const colors = useColors()
  return (
    <div
      data-pillar={dataPillar}
      className="flex flex-col items-center justify-between p-6 rounded-lg"
      style={{
        border: `2px solid ${colors.border}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: 'scale(0.8)',
        width: '300px',
        maxWidth: '300px',
        minHeight: '200px',
        height: '200px',
        boxSizing: 'border-box',
      }}
    >
      <div className="flex flex-col items-center flex-1 justify-center">
        <div
          data-icon
          className="text-4xl mb-4"
          style={{
            transform: 'scale(1)',
            lineHeight: '1',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </div>
        <h3
          className="text-xl font-semibold mb-3 text-center"
          style={{
            color: colors.text,
            lineHeight: '1.2',
            minHeight: '28px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {title}
        </h3>
      </div>
      <p
        className="text-sm text-center"
        style={{
          color: colors.textMuted,
          lineHeight: '1.4',
          minHeight: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {description}
      </p>
    </div>
  )
}

function StorageBox({
  dataStorage,
  title,
  description,
  icon,
  initialX,
  color: _color,
}: {
  dataStorage: string
  title: string
  description: string
  icon: string
  initialX: number
  color: string
}) {
  const colors = useColors()
  return (
    <div
      data-storage={dataStorage}
      className="flex-1 p-6 rounded-lg text-center"
      style={{
        border: `2px solid ${colors.border}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: `translateX(${initialX}px)`,
      }}
    >
      <div className="text-3xl mb-3">{icon}</div>
      <h4 className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
        {title}
      </h4>
      <p className="text-sm" style={{ color: colors.textMuted }}>
        {description}
      </p>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Arrow({ dataFlow }: { dataFlow: string }) {
  const colors = useColors()
  return (
    <div
      data-flow={dataFlow}
      className="text-2xl"
      style={{
        color: colors.primary,
        opacity: 0,
        transform: 'scaleX(0)',
      }}
    >
      →
    </div>
  )
}

function Counter({
  dataCounter,
  children,
  style,
}: {
  dataCounter: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const colors = useColors()
  return (
    <div
      data-counter={dataCounter}
      className="text-center text-sm font-semibold"
      style={{
        color: colors.primary,
        textShadow: `0 0 5px rgba(${colors.primaryRgb}, 0.5)`,
        opacity: 0,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function TaskBox({
  dataTask,
  title,
  status,
  progress,
  color: _color,
}: {
  dataTask?: boolean
  title: string
  status: string
  progress: string
  color: string
}) {
  const colors = useColors()
  const statusColor =
    status === 'success' ? colors.primary : status === 'pending' ? colors.warning : colors.textDim

  return (
    <div
      data-task={dataTask}
      className="p-4 rounded-lg"
      style={{
        border: `2px solid ${colors.border}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: 'translateX(-20px)',
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
          data-task-status
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

function ExperienceBox({
  dataExperience,
  title,
  description,
}: {
  dataExperience?: boolean
  title?: string
  description?: string
}) {
  const colors = useColors()
  return (
    <div
      data-experience={dataExperience}
      className="p-6 rounded-lg text-center"
      style={{
        border: `2px solid ${colors.accent}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: 'scale(0.9)',
      }}
    >
      <div className="text-3xl mb-3">✅</div>
      <h4 className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
        {title || 'Successful Session'}
      </h4>
      <p className="text-sm" style={{ color: colors.textMuted }}>
        {description || 'Task completed with user approval'}
      </p>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SearchButton({ dataQuery, color: _color }: { dataQuery: string; color: string }) {
  const colors = useColors()
  return (
    <button
      data-query={dataQuery}
      className="px-6 py-3 text-sm font-semibold"
      style={{
        backgroundColor: colors.border,
        color: colors.text,
        opacity: 0,
        transform: 'scale(0.9)',
      }}
    >
      Search
    </button>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SearchResult({
  dataResult,
  title,
  score,
}: {
  dataResult?: boolean
  title: string
  score: string
}) {
  const colors = useColors()
  return (
    <div
      data-result={dataResult}
      className="p-4 rounded-lg"
      style={{
        border: `2px solid ${colors.border}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: 'translateY(10px)',
      }}
    >
      <div className="flex justify-between items-center">
        <span style={{ color: colors.text }}>{title}</span>
        <span style={{ color: colors.primary }}>{score}</span>
      </div>
    </div>
  )
}

function SkillBox({
  dataSkill,
  title,
  description,
  icon,
  color: _color,
}: {
  dataSkill: string
  title: string
  description: string
  icon: string
  color: string
}) {
  const colors = useColors()
  return (
    <div
      data-skill={dataSkill}
      className="flex flex-col items-center justify-center p-3 rounded-lg shrink-0"
      style={{
        border: `2px solid ${colors.border}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: 'scale(0.8)',
        width: '120px',
        minWidth: '120px',
        maxWidth: '120px',
        minHeight: '100px',
      }}
    >
      <div className="text-2xl mb-2" style={{ lineHeight: '1' }}>
        {icon}
      </div>
      <h4
        className="text-sm font-semibold mb-1 text-center"
        style={{
          color: colors.text,
          lineHeight: '1.2',
        }}
      >
        {title}
      </h4>
      <p
        className="text-xs text-center"
        style={{
          color: colors.textMuted,
          lineHeight: '1.3',
        }}
      >
        {description}
      </p>
    </div>
  )
}

function SkillArrow({ dataSkill, color: _color }: { dataSkill: string; color: string }) {
  const colors = useColors()
  return (
    <svg
      data-skill={dataSkill}
      width="40"
      height="20"
      className="shrink-0"
      style={{
        opacity: 0,
        flexShrink: 0,
      }}
      viewBox="0 0 40 20"
    >
      <defs>
        <marker
          id="arrowhead-skill"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" style={{ fill: colors.accent }} />
        </marker>
      </defs>
      <path
        d="M 0 10 L 30 10"
        stroke={colors.accent}
        strokeWidth="2"
        fill="none"
        markerEnd="url(#arrowhead-skill)"
        style={{
          strokeDasharray: 30,
          strokeDashoffset: 30,
        }}
      />
    </svg>
  )
}

function MetricBox({
  dataMetric,
  dataMetricType,
  label,
  value,
  color,
}: {
  dataMetric?: boolean
  dataMetricType?: string
  label: string
  value: string
  color: string
}) {
  const colors = useColors()
  return (
    <div
      data-metric={dataMetric}
      data-metric-type={dataMetricType}
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

function ChartBox({ colors }: { colors: ColorPalette }) {
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
            data-chart="bar"
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

function FeatureIcon({ symbol, label }: { symbol: string; label: string }) {
  const colors = useColors()
  return (
    <div
      data-cta="feature"
      className="text-center"
      style={{ opacity: 0, transform: 'translateY(20px)' }}
    >
      <div
        className="text-3xl mb-2"
        style={{
          color: colors.primary,
          textShadow: `0 0 10px rgba(${colors.primaryRgb}, 0.5)`,
        }}
      >
        {symbol}
      </div>
      <div className="text-xs" style={{ color: colors.textMuted }}>
        {label}
      </div>
    </div>
  )
}

function TerminalWindow({
  dataCode,
  title,
  children,
  style,
  initialOpacity = 1,
}: {
  dataCode?: string
  title: string
  children: React.ReactNode
  style?: React.CSSProperties
  initialOpacity?: number
}) {
  const colors = useColors()
  return (
    <div
      data-code={dataCode}
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

function CodeLine({
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

function Fn({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return <span style={{ color: colors.secondary }}>{children}</span>
}

function Str({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return <span style={{ color: colors.primary }}>{children}</span>
}

function CTAButton({
  href,
  colors,
  dataCta,
}: {
  href: string
  colors: ColorPalette
  dataCta: string
}) {
  const buttonRef = useRef<HTMLAnchorElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    if (!buttonRef.current) return

    const button = buttonRef.current
    const glow = glowRef.current

    const handleMouseEnter = () => {
      setIsHovered(true)
      // Button scale and glow animation
      gsap.to(button, {
        scale: 1.08,
        boxShadow: `0 0 60px rgba(${colors.primaryRgb}, 0.9), 0 0 120px rgba(${colors.primaryRgb}, 0.5)`,
        duration: 0.4,
        ease: 'power2.out',
      })
      // Glow effect animation
      if (glow) {
        gsap.to(glow, {
          opacity: 1,
          scale: 1.2,
          duration: 0.4,
          ease: 'power2.out',
        })
      }
      // Pulsing effect
      gsap.to(button, {
        boxShadow: `0 0 60px rgba(${colors.primaryRgb}, 0.9), 0 0 120px rgba(${colors.primaryRgb}, 0.5), 0 0 180px rgba(${colors.primaryRgb}, 0.3)`,
        duration: 1,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
      })
    }

    const handleMouseLeave = () => {
      setIsHovered(false)
      // Reset animations
      gsap.killTweensOf(button)
      gsap.to(button, {
        scale: 1,
        boxShadow: `0 0 30px rgba(${colors.primaryRgb}, 0.4)`,
        duration: 0.4,
        ease: 'power2.out',
      })
      if (glow) {
        gsap.to(glow, {
          opacity: 0,
          scale: 1,
          duration: 0.4,
          ease: 'power2.out',
        })
      }
    }

    button.addEventListener('mouseenter', handleMouseEnter)
    button.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      button.removeEventListener('mouseenter', handleMouseEnter)
      button.removeEventListener('mouseleave', handleMouseLeave)
      gsap.killTweensOf(button)
      if (glow) {
        gsap.killTweensOf(glow)
      }
    }
  }, [colors])

  return (
    <a
      ref={buttonRef}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-cta={dataCta}
      className="inline-block px-8 py-4 text-lg font-semibold rounded relative overflow-hidden"
      style={{
        backgroundColor: `rgba(${colors.primaryRgb}, 0.6)`,
        color: colors.bg,
        opacity: 0,
        transform: 'scale(0.9)',
        boxShadow: `0 0 30px rgba(${colors.primaryRgb}, 0.4)`,
        cursor: 'none',
        textDecoration: 'none',
        userSelect: 'none',
      }}
    >
      {/* Animated glow effect on hover */}
      <div
        ref={glowRef}
        className="absolute inset-0 rounded"
        style={{
          background: `radial-gradient(circle, rgba(${colors.primaryRgb}, 0.4) 0%, transparent 70%)`,
          opacity: 0,
          transform: 'scale(1)',
          pointerEvents: 'none',
        }}
      />
      {/* Button text with animated arrow */}
      <span className="relative z-10">
        Get Started{' '}
        <span
          className="inline-block"
          style={{
            transform: isHovered ? 'translateX(6px)' : 'translateX(0)',
            transition: 'transform 0.3s ease-out',
          }}
        >
          →
        </span>
      </span>
    </a>
  )
}