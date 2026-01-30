'use client'

import { useRef, useEffect, useMemo, createContext, useContext, useState } from 'react'
import { useTheme } from 'next-themes'
import gsap from 'gsap'

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
}

// Context for colors
const ColorsContext = createContext<ColorPalette>(darkColors)
const useColors = () => useContext(ColorsContext)

// Design dimensions - the animation is designed for this size
const DESIGN_WIDTH = 1200
const DESIGN_HEIGHT = 675 // 16:9 aspect ratio

export function TutorialVideo() {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [scale, setScale] = useState(1)

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

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current

    // Create GSAP context scoped to the container
    const ctx = gsap.context(() => {
      const master = gsap.timeline({ repeat: -1, repeatDelay: 2 })

      // SCENE 1: Store API (0-6s)
      const scene1 = gsap.timeline()
      scene1
        .to('[data-scene="1"]', { opacity: 1, duration: 0.2 }, 0)
        .to(
          '[data-msg="store"]',
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: 'back.out(1.7)',
          },
          1,
        )
        .to(
          '[data-msg="store"]',
          {
            borderColor: colors.primary,
            boxShadow: `0 0 30px rgba(${colors.primaryRgb}, 0.4)`,
            duration: 0.2,
          },
          1.5,
        )
        .to('[data-counter="store"]', { opacity: 1, duration: 0.2 }, 2)
        .to('[data-scene="1"]', { opacity: 0, duration: 0.3 }, 5.7)

      // SCENE 2: Get Messages (6-12s)
      const scene2 = gsap.timeline()
      scene2
        .to('[data-scene="2"]', { opacity: 1, duration: 0.2 }, 0)
        .to(
          '[data-msg="retrieve"]',
          {
            opacity: 1,
            x: 0,
            duration: 0.4,
            stagger: 0.15,
            ease: 'power2.out',
          },
          0.8,
        )
        .to(
          '[data-msg="retrieve"]',
          {
            borderColor: colors.primary,
            duration: 0.15,
            stagger: 0.08,
          },
          1.8,
        )
        .to('[data-counter="retrieve"]', { opacity: 1, duration: 0.2 }, 2.5)
        .to('[data-scene="2"]', { opacity: 0, duration: 0.3 }, 5.7)

      // SCENE 3: Context Editing (12-20s) - HERO SCENE
      const scene3 = gsap.timeline()
      scene3
        .to('[data-scene="3"]', { opacity: 1, duration: 0.2 }, 0)
        .to(
          '[data-token="fill"]',
          {
            width: '75%',
            duration: 0.8,
            ease: 'power1.out',
          },
          0.3,
        )
        .set('[data-token="value"]', { textContent: '150K' }, 0.3)
        .set(
          '[data-token="label"]',
          {
            textContent: 'WARNING: HIGH USAGE',
            color: colors.danger,
          },
          1.1,
        )
        .to(
          '[data-code="scene3"]',
          {
            opacity: 1,
            duration: 0.3,
            ease: 'power2.out',
          },
          1.5,
        )
        .to(
          '[data-token="fill"]',
          {
            width: '25%',
            background: colors.primary,
            boxShadow: `0 0 10px rgba(${colors.primaryRgb}, 0.5)`,
            duration: 1,
            ease: 'power2.out',
          },
          2.2,
        )
        .set(
          '[data-token="value"]',
          {
            textContent: '50K',
            color: colors.primary,
          },
          2.2,
        )
        .set(
          '[data-token="label"]',
          {
            textContent: 'OPTIMIZED ✓',
            color: colors.primary,
          },
          2.2,
        )
        .to('[data-counter="scene3"]', { opacity: 1, duration: 0.2 }, 3.5)
        .to('[data-scene="3"]', { opacity: 0, duration: 0.3 }, 7.7)

      // SCENE 4: Artifacts (20-28s)
      const scene4 = gsap.timeline()
      scene4
        .to('[data-scene="4"]', { opacity: 1, duration: 0.2 }, 0)
        .to(
          '[data-tree="line"]',
          {
            opacity: 1,
            duration: 0.3,
            stagger: 0.2,
            ease: 'power1.out',
          },
          0.8,
        )
        .to('[data-counter="scene4"]', { opacity: 1, duration: 0.2 }, 2.5)
        .to('[data-scene="4"]', { opacity: 0, duration: 0.3 }, 7.7)

      // SCENE 5: CTA (28-32s)
      const scene5 = gsap.timeline()
      scene5
        .to('[data-scene="5"]', { opacity: 1, duration: 0.2 }, 0)
        .to(
          '[data-cta="logo"]',
          {
            opacity: 1,
            scale: 1,
            duration: 0.4,
            ease: 'elastic.out(1, 0.5)',
          },
          0.2,
        )
        .to('[data-cta="subtitle"]', { opacity: 1, duration: 0.3 }, 0.5)
        .to(
          '[data-cta="feature"]',
          {
            opacity: 1,
            y: 0,
            duration: 0.3,
            stagger: 0.1,
            ease: 'back.out(1.4)',
          },
          0.8,
        )
        .to(
          '[data-cta="command"]',
          {
            opacity: 1,
            scale: 1,
            duration: 0.4,
            ease: 'back.out(1.3)',
          },
          1.5,
        )

      // Chain all scenes - Total 32 seconds
      master.add(scene1, 0).add(scene2, 6).add(scene3, 12).add(scene4, 20).add(scene5, 28)
    }, container)

    return () => ctx.revert()
  }, [colors])

  return (
    <ColorsContext.Provider value={colors}>
      <section className="py-8 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
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

              {/* SCENE 1: Store API */}
              <Scene scene="1">
                <div className="grid grid-cols-2 gap-8 w-full max-w-5xl px-12">
                  <TerminalWindow title="Store API">
                    <CodeLine comment># Store messages from any provider</CodeLine>
                    <CodeLine>
                      client.<Fn>sessions</Fn>.<Fn>store_message</Fn>(
                    </CodeLine>
                    <CodeLine indent={2}>
                      <Str>session_id</Str>=<Str>&quot;abc-123&quot;</Str>,
                    </CodeLine>
                    <CodeLine indent={2}>
                      <Str>blob</Str>={'{'}
                    </CodeLine>
                    <CodeLine indent={4}>
                      <Str>&quot;role&quot;</Str>: <Str>&quot;user&quot;</Str>,
                    </CodeLine>
                    <CodeLine indent={4}>
                      <Str>&quot;content&quot;</Str>: <Str>&quot;Hello, Acontext!&quot;</Str>
                    </CodeLine>
                    <CodeLine indent={2}>{'}'},</CodeLine>
                    <CodeLine indent={2}>
                      <Str>format</Str>=<Str>&quot;openai&quot;</Str>
                    </CodeLine>
                    <CodeLine>)</CodeLine>
                  </TerminalWindow>

                  <div className="flex flex-col justify-center">
                    <MessageCard dataMsg="store" role="USER" initialY={20}>
                      &quot;Hello, Acontext!&quot;
                      <div className="text-xs mt-2" style={{ color: colors.textDim }}>
                        [openai] ▸ stored
                      </div>
                    </MessageCard>
                    <Counter dataCounter="store">✓ Message stored</Counter>
                  </div>
                </div>
              </Scene>

              {/* SCENE 2: Get Messages API */}
              <Scene scene="2">
                <div className="grid grid-cols-2 gap-8 w-full max-w-5xl px-12">
                  <TerminalWindow title="Get Messages API">
                    <CodeLine comment># Retrieve in any format - auto-converted</CodeLine>
                    <CodeLine>
                      messages = client.<Fn>sessions</Fn>.<Fn>get_messages</Fn>(
                    </CodeLine>
                    <CodeLine indent={2}>
                      <Str>session_id</Str>=<Str>&quot;abc-123&quot;</Str>,
                    </CodeLine>
                    <CodeLine indent={2}>
                      <Str>format</Str>=<Str>&quot;anthropic&quot;</Str>{' '}
                      <span style={{ color: colors.textDim }}># Auto-convert!</span>
                    </CodeLine>
                    <CodeLine>)</CodeLine>
                  </TerminalWindow>

                  <div className="flex flex-col gap-3">
                    <MessageCard dataMsg="retrieve" role="USER" initialX={-20}>
                      &quot;Hello, Acontext!&quot;
                      <div className="text-xs mt-1" style={{ color: colors.textDim }}>
                        [openai] → [anthropic]
                      </div>
                    </MessageCard>
                    <MessageCard dataMsg="retrieve" role="ASSISTANT" initialX={-20}>
                      &quot;Hi there! How can I help?&quot;
                      <div className="text-xs mt-1" style={{ color: colors.textDim }}>
                        [anthropic]
                      </div>
                    </MessageCard>
                    <MessageCard dataMsg="retrieve" role="USER" initialX={-20}>
                      [IMAGE]
                      <div className="text-xs mt-1" style={{ color: colors.textDim }}>
                        [anthropic]
                      </div>
                    </MessageCard>
                    <Counter dataCounter="retrieve">[3 messages retrieved]</Counter>
                  </div>
                </div>
              </Scene>

              {/* SCENE 3: Context Editing */}
              <Scene scene="3">
                <div className="grid grid-cols-2 gap-8 w-full max-w-5xl px-12">
                  <TerminalWindow dataCode="scene3" title="Context Editing" initialOpacity={0}>
                    <CodeLine comment># Apply optimization strategy</CodeLine>
                    <CodeLine>
                      messages = client.<Fn>sessions</Fn>.<Fn>get_messages</Fn>(
                    </CodeLine>
                    <CodeLine indent={2}>
                      <Str>session_id</Str>=<Str>&quot;abc-123&quot;</Str>,
                    </CodeLine>
                    <CodeLine indent={2}>
                      <Str>edit_strategies</Str>=[
                    </CodeLine>
                    <CodeLine indent={4}>
                      {'{'}
                      <Str>&quot;type&quot;</Str>: <Str>&quot;token_limit&quot;</Str>,{' '}
                      <Str>&quot;params&quot;</Str>: {'{'}
                      <Str>&quot;limit_tokens&quot;</Str>: <Op>50000</Op>
                      {'}'}
                      {'}'}
                    </CodeLine>
                    <CodeLine indent={2}>]</CodeLine>
                    <CodeLine>)</CodeLine>
                    <CodeLine comment style={{ marginTop: 12 }}>
                      # ✓ Optimized: 150K → 50K
                    </CodeLine>
                  </TerminalWindow>

                  <div className="flex flex-col justify-center">
                    <TokenMeter />
                    <Counter dataCounter="scene3">Edit context on-the-fly</Counter>
                  </div>
                </div>
              </Scene>

              {/* SCENE 4: Artifacts API */}
              <Scene scene="4">
                <div className="grid grid-cols-2 gap-8 w-full max-w-5xl px-12">
                  <TerminalWindow title="Artifacts API">
                    <CodeLine comment># S3-backed file storage with metadata</CodeLine>
                    <CodeLine>
                      disk = client.<Fn>disks</Fn>.<Fn>create</Fn>()
                    </CodeLine>
                    <CodeLine>
                      client.<Fn>disks</Fn>.<Fn>artifacts</Fn>.<Fn>upsert</Fn>(
                    </CodeLine>
                    <CodeLine indent={2}>
                      disk.<Str>id</Str>, <Str>file</Str>=<Fn>FileUpload</Fn>(
                      <Str>&quot;report.pdf&quot;</Str>),
                    </CodeLine>
                    <CodeLine indent={2}>
                      <Str>file_path</Str>=<Str>&quot;/documents/&quot;</Str>,
                    </CodeLine>
                    <CodeLine indent={2}>
                      <Str>meta</Str>={'{'}
                      <Str>&quot;author&quot;</Str>: <Str>&quot;alice&quot;</Str>,{' '}
                      <Str>&quot;version&quot;</Str>: <Str>&quot;1.0&quot;</Str>
                      {'}'}
                    </CodeLine>
                    <CodeLine>)</CodeLine>
                  </TerminalWindow>

                  <div className="flex flex-col justify-center">
                    <TerminalWindow title="OUTPUT" style={{ maxWidth: '100%' }}>
                      <div className="text-sm leading-relaxed">
                        <TreeLine>
                          <span style={{ color: colors.secondary }}>disk-xyz/</span>
                        </TreeLine>
                        <TreeLine>
                          ├── <span style={{ color: colors.secondary }}>documents/</span>
                        </TreeLine>
                        <TreeLine>
                          │ └── report.pdf{' '}
                          <span style={{ color: colors.textDim }}>◀ alice v1.0</span>
                        </TreeLine>
                        <TreeLine>
                          └── <span style={{ color: colors.secondary }}>images/</span>
                        </TreeLine>
                      </div>
                    </TerminalWindow>
                    <Counter dataCounter="scene4">Filesystem for agent artifacts</Counter>
                  </div>
                </div>
              </Scene>

              {/* SCENE 5: CTA */}
              <Scene scene="5">
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
                    data-cta="subtitle"
                    className="text-lg mb-10"
                    style={{ color: colors.textMuted, opacity: 0 }}
                  >
                    data platform for context engineering
                  </div>

                  <div className="flex justify-center gap-12 mb-12">
                    <FeatureIcon symbol="💬" label="Multi-provider" />
                    <FeatureIcon symbol="🖼️" label="Multi-modal" />
                    <FeatureIcon symbol="⚡" label="Context editing" />
                    <FeatureIcon symbol="📦" label="Artifacts" />
                  </div>

                  <div
                    data-cta="command"
                    className="p-6 mb-6"
                    style={{
                      backgroundColor: colors.terminal,
                      border: `2px solid ${colors.primary}`,
                      boxShadow: `0 0 30px rgba(${colors.primaryRgb}, 0.3)`,
                      opacity: 0,
                      transform: 'scale(0.9)',
                    }}
                  >
                    <div
                      className="text-xl mb-4"
                      style={{
                        color: colors.primary,
                        textShadow: `0 0 5px rgba(${colors.primaryRgb}, 0.5)`,
                      }}
                    >
                      git clone github.com/memodb-io/Acontext
                      <span
                        className="inline-block w-2.5 h-5 ml-1 align-middle animate-pulse"
                        style={{ backgroundColor: colors.primary }}
                      />
                    </div>
                    <div className="flex flex-col gap-2 mt-4">
                      <CTALink>⭐ Star on GitHub</CTALink>
                      <CTALink>📚 docs.acontext.io</CTALink>
                      <CTALink>💬 discord.acontext.io</CTALink>
                    </div>
                  </div>

                  <div className="text-sm" style={{ color: colors.textDim }}>
                    Built for AI agents, by developers
                  </div>
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
  const padding = '\u00A0'.repeat(indent)

  if (comment) {
    return (
      <div className="my-2" style={{ color: colors.textDim, ...style }}>
        {padding}
        {typeof comment === 'string' ? comment : children}
      </div>
    )
  }

  return (
    <div className="my-2" style={{ color: colors.text, ...style }}>
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

function Op({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return <span style={{ color: colors.warning }}>{children}</span>
}

function MessageCard({
  dataMsg,
  role,
  children,
  initialY = 0,
  initialX = 0,
}: {
  dataMsg: string
  role: string
  children: React.ReactNode
  initialY?: number
  initialX?: number
}) {
  const colors = useColors()
  return (
    <div
      data-msg={dataMsg}
      style={{
        border: `2px solid ${colors.border}`,
        backgroundColor: colors.terminal,
        padding: '12px 16px',
        boxShadow: `0 0 20px rgba(${colors.primaryRgb}, 0.2)`,
        opacity: 0,
        transform: `translate(${initialX}px, ${initialY}px)`,
      }}
    >
      <div
        className="text-xs mb-1"
        style={{
          color: colors.primary,
          textShadow: `0 0 5px rgba(${colors.primaryRgb}, 0.5)`,
        }}
      >
        &gt; {role}
      </div>
      <div className="text-sm" style={{ color: colors.text }}>
        {children}
      </div>
    </div>
  )
}

function Counter({ dataCounter, children }: { dataCounter: string; children: React.ReactNode }) {
  const colors = useColors()
  return (
    <div
      data-counter={dataCounter}
      className="text-center mt-4 text-sm"
      style={{
        color: colors.primary,
        textShadow: `0 0 5px rgba(${colors.primaryRgb}, 0.5)`,
        opacity: 0,
      }}
    >
      {children}
    </div>
  )
}

function TokenMeter() {
  const colors = useColors()
  return (
    <div
      className="p-4"
      style={{
        backgroundColor: colors.terminal,
        border: `2px solid ${colors.border}`,
      }}
    >
      <div
        className="text-sm mb-3"
        style={{
          color: colors.secondary,
          textShadow: `0 0 5px rgba(${colors.secondaryRgb}, 0.5)`,
        }}
      >
        ┌─[ TOKEN USAGE ]──────────────────────
      </div>
      <div
        className="w-full h-6 relative overflow-hidden"
        style={{
          backgroundColor: colors.elevated,
          border: `1px solid ${colors.border}`,
        }}
      >
        <div
          data-token="fill"
          className="h-full"
          style={{
            width: '0%',
            backgroundColor: colors.danger,
            boxShadow: `0 0 10px rgba(255, 85, 85, 0.5)`,
            transition: 'width 0.8s ease-out, background 0.3s',
          }}
        />
      </div>
      <div className="text-sm mt-2" style={{ color: colors.text }}>
        <span style={{ color: colors.primary }}>&gt;&gt;&gt;</span>{' '}
        <span data-token="label">LIMIT: 200K</span> │{' '}
        <span
          data-token="value"
          style={{
            color: colors.primary,
            textShadow: `0 0 5px rgba(${colors.primaryRgb}, 0.5)`,
          }}
        >
          0K
        </span>
      </div>
    </div>
  )
}

function TreeLine({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return (
    <div data-tree="line" style={{ color: colors.text, opacity: 0 }}>
      {children}
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

function CTALink({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return (
    <div
      className="text-base"
      style={{
        color: colors.secondary,
        textShadow: `0 0 5px rgba(${colors.secondaryRgb}, 0.5)`,
      }}
    >
      &gt; {children}
    </div>
  )
}
