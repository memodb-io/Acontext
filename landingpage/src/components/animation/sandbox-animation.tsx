'use client'

import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import { useTheme } from 'next-themes'
import gsap from 'gsap'
import {
  darkColors,
  lightColors,
  ColorsContext,
  useColors,
  Fn,
  Str,
  DESIGN_WIDTH,
  DESIGN_HEIGHT,
} from '@/components/animation/shared'

// Phase configuration - LLM-centric workflow
const PHASES = [
  { id: 1, title: 'Setup', desc: 'Create sandbox & mount skills' },
  { id: 2, title: 'Context', desc: 'Build LLM system prompt' },
  { id: 3, title: 'Agent Loop', desc: 'LLM → Tool → Result → Response' },
  { id: 4, title: 'Export', desc: 'Get shareable URL' },
] as const

// Phase durations in seconds (increased for agent loop animation)
const PHASE_DURATION = 5.5

export function SandboxAnimation() {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const masterTimelineRef = useRef<gsap.core.Timeline | null>(null)
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [scale, setScale] = useState(1)

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

  // Get theme for boxShadow
  const themeForShadow = mounted && resolvedTheme ? resolvedTheme : 'dark'

  // Get phase color
  const getPhaseColor = useCallback(
    (phase: number) => {
      const phaseColors = [colors.primary, colors.secondary, colors.accent, colors.primary]
      return phaseColors[(phase - 1) % phaseColors.length]
    },
    [colors]
  )

  const getPhaseColorRgb = useCallback(
    (phase: number) => {
      const phaseColorsRgb = [
        colors.primaryRgb,
        colors.secondaryRgb,
        colors.accentRgb,
        colors.primaryRgb,
      ]
      return phaseColorsRgb[(phase - 1) % phaseColorsRgb.length]
    },
    [colors]
  )

  // Handle phase click - play phase animation then pause at end
  const handlePhaseClick = useCallback(
    (phase: number) => {
      if (!masterTimelineRef.current || !containerRef.current) return

      const master = masterTimelineRef.current
      const phaseStartTime = (phase - 1) * PHASE_DURATION
      const phaseEndTime = phase * PHASE_DURATION - 0.4 // Pause before fade out

      // Stop the auto-loop
      master.repeat(0)

      // Reset all phase indicators to inactive state first
      PHASES.forEach((p) => {
        const indicator = containerRef.current?.querySelector(
          `[data-phase-indicator="${p.id}"]`
        ) as HTMLElement
        const number = indicator?.querySelector('[data-phase-number]') as HTMLElement
        const title = indicator?.querySelector('[data-phase-title]') as HTMLElement

        if (indicator) {
          indicator.style.backgroundColor = colors.terminal
          indicator.style.borderColor = colors.border
        }
        if (number) {
          number.style.backgroundColor = 'transparent'
          number.style.color = colors.textMuted
        }
        if (title) {
          title.style.color = colors.textMuted
        }
      })

      // Jump to phase start and play until phase end
      master.pause()
      master.seek(phaseStartTime)

      // Create a one-time callback to pause at the end of this phase
      const onUpdateHandler = () => {
        if (master.time() >= phaseEndTime) {
          master.pause()
          master.eventCallback('onUpdate', null) // Remove this callback
        }
      }

      master.eventCallback('onUpdate', onUpdateHandler)
      master.play()
    },
    [colors]
  )

  // Animation setup
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current

    const ctx = gsap.context(() => {
      const master = gsap.timeline({ repeat: -1, repeatDelay: 1 })
      masterTimelineRef.current = master

      // Helper to activate phase indicator
      const activatePhaseIndicator = (
        tl: gsap.core.Timeline,
        phase: number,
        color: string,
        colorRgb: string,
        position: number = 0
      ) => {
        tl.to(
          `[data-phase-indicator="${phase}"]`,
          {
            backgroundColor: `rgba(${colorRgb}, 0.15)`,
            borderColor: color,
            duration: 0.3,
          },
          position
        )
          .to(
            `[data-phase-indicator="${phase}"] [data-phase-number]`,
            {
              backgroundColor: color,
              color: colors.terminal,
              duration: 0.3,
            },
            position
          )
          .to(
            `[data-phase-indicator="${phase}"] [data-phase-title]`,
            {
              color: color,
              duration: 0.3,
            },
            position
          )
      }

      // Helper to deactivate phase indicator
      const deactivatePhaseIndicator = (
        tl: gsap.core.Timeline,
        phase: number,
        position: number = 0
      ) => {
        tl.to(
          `[data-phase-indicator="${phase}"]`,
          {
            backgroundColor: colors.terminal,
            borderColor: colors.border,
            duration: 0.3,
          },
          position
        )
          .to(
            `[data-phase-indicator="${phase}"] [data-phase-number]`,
            {
              backgroundColor: 'transparent',
              color: colors.textMuted,
              duration: 0.3,
            },
            position
          )
          .to(
            `[data-phase-indicator="${phase}"] [data-phase-title]`,
            {
              color: colors.textMuted,
              duration: 0.3,
            },
            position
          )
      }

      // PHASE 1: Setup - Create Sandbox, Disk, Upload Skill
      const phase1 = gsap.timeline()
      phase1
        .set('[data-phase="2"]', { opacity: 0 }, 0)
        .set('[data-phase="3"]', { opacity: 0 }, 0)
        .set('[data-phase="4"]', { opacity: 0 }, 0)
        .to('[data-phase="1"]', { opacity: 1, duration: 0.3 }, 0)
      activatePhaseIndicator(phase1, 1, getPhaseColor(1), getPhaseColorRgb(1), 0)
      phase1
        .to('[data-code="1"]', { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0.3)
        .to('[data-code-line="1-1"]', { opacity: 1, duration: 0.3 }, 0.5)
        .to('[data-code-line="1-2"]', { opacity: 1, duration: 0.3 }, 0.7)
        .to('[data-result="sandbox"]', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)' }, 1.0)
        .to('[data-code-line="1-3"]', { opacity: 1, duration: 0.3 }, 1.3)
        .to('[data-result="disk"]', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)' }, 1.6)
        .to('[data-code-line="1-4"]', { opacity: 1, duration: 0.3 }, 2.0)
        .to('[data-code-line="1-5"]', { opacity: 1, duration: 0.3 }, 2.3)
        .to('[data-result="skill"]', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)' }, 2.6)
        .to('[data-phase="1"]', { opacity: 0, duration: 0.3 }, PHASE_DURATION - 0.3)
      deactivatePhaseIndicator(phase1, 1, PHASE_DURATION - 0.3)

      // PHASE 2: Context - Build LLM system prompt with tools
      const phase2 = gsap.timeline()
      phase2
        .set('[data-phase="1"]', { opacity: 0 }, 0)
        .set('[data-phase="3"]', { opacity: 0 }, 0)
        .set('[data-phase="4"]', { opacity: 0 }, 0)
        .to('[data-phase="2"]', { opacity: 1, duration: 0.3 }, 0)
      activatePhaseIndicator(phase2, 2, getPhaseColor(2), getPhaseColorRgb(2), 0)
      phase2
        .to('[data-code="2"]', { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0.3)
        .to('[data-code-line="2-1"]', { opacity: 1, duration: 0.3 }, 0.5)
        .to('[data-code-line="2-2"]', { opacity: 1, duration: 0.3 }, 0.7)
        .to('[data-code-line="2-3"]', { opacity: 1, duration: 0.3 }, 0.9)
        .to('[data-code-line="2-4"]', { opacity: 1, duration: 0.3 }, 1.1)
        .to('[data-code-line="2-5"]', { opacity: 1, duration: 0.3 }, 1.3)
        .to('[data-context="prompt"]', { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out' }, 1.6)
        .to('[data-code-line="2-6"]', { opacity: 1, duration: 0.3 }, 2.0)
        .to('[data-code-line="2-7"]', { opacity: 1, duration: 0.3 }, 2.3)
        .to('[data-context="tools"]', { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out' }, 2.6)
        .to('[data-phase="2"]', { opacity: 0, duration: 0.3 }, PHASE_DURATION - 0.3)
      deactivatePhaseIndicator(phase2, 2, PHASE_DURATION - 0.3)

      // PHASE 3: Agent Loop - LLM decides, tools execute
      const phase3 = gsap.timeline()
      phase3
        .set('[data-phase="1"]', { opacity: 0 }, 0)
        .set('[data-phase="2"]', { opacity: 0 }, 0)
        .set('[data-phase="4"]', { opacity: 0 }, 0)
        .to('[data-phase="3"]', { opacity: 1, duration: 0.3 }, 0)
      activatePhaseIndicator(phase3, 3, getPhaseColor(3), getPhaseColorRgb(3), 0)
      // Agent loop animation: User → LLM → Tool → Result → Response
      phase3
        .to('[data-loop="user"]', { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 0.4)
        .to('[data-loop="arrow-1"]', { opacity: 1, scaleX: 1, duration: 0.3 }, 0.8)
        .to('[data-loop="llm"]', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)' }, 1.1)
        .to('[data-loop="arrow-2"]', { opacity: 1, scaleX: 1, duration: 0.3 }, 1.5)
        .to('[data-loop="tool"]', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)' }, 1.8)
        .to('[data-loop="arrow-3"]', { opacity: 1, scaleX: 1, duration: 0.3 }, 2.2)
        .to('[data-loop="sandbox"]', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)' }, 2.5)
        .to('[data-loop="arrow-4"]', { opacity: 1, scaleX: 1, duration: 0.3 }, 2.9)
        .to('[data-loop="result"]', { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 3.2)
        // Highlight the loop arrow back to LLM
        .to('[data-loop="arrow-back"]', { opacity: 1, duration: 0.4 }, 3.6)
        .to('[data-loop="llm"]', { boxShadow: `0 0 20px rgba(${colors.accentRgb}, 0.5)`, duration: 0.3 }, 4.0)
        .to('[data-phase="3"]', { opacity: 0, duration: 0.3 }, PHASE_DURATION - 0.3)
      deactivatePhaseIndicator(phase3, 3, PHASE_DURATION - 0.3)

      // PHASE 4: Export - Get Public URL
      const phase4 = gsap.timeline()
      phase4
        .set('[data-phase="1"]', { opacity: 0 }, 0)
        .set('[data-phase="2"]', { opacity: 0 }, 0)
        .set('[data-phase="3"]', { opacity: 0 }, 0)
        .to('[data-phase="4"]', { opacity: 1, duration: 0.3 }, 0)
      activatePhaseIndicator(phase4, 4, getPhaseColor(4), getPhaseColorRgb(4), 0)
      phase4
        .to('[data-code="4"]', { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0.3)
        .to('[data-code-line="4-1"]', { opacity: 1, duration: 0.3 }, 0.5)
        .to('[data-code-line="4-2"]', { opacity: 1, duration: 0.3 }, 0.8)
        .to('[data-code-line="4-3"]', { opacity: 1, duration: 0.3 }, 1.1)
        .to('[data-code-line="4-4"]', { opacity: 1, duration: 0.3 }, 1.4)
        .to('[data-code-line="4-5"]', { opacity: 1, duration: 0.3 }, 1.7)
        .to('[data-result-box="export"]', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)' }, 2.0)
        .to('[data-url-highlight]', { boxShadow: `0 0 20px rgba(${colors.primaryRgb}, 0.6)`, duration: 0.4, yoyo: true, repeat: 2 }, 2.5)
        .to('[data-result="final"]', { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 3.2)
        .to('[data-phase="4"]', { opacity: 0, duration: 0.3 }, PHASE_DURATION - 0.3)
      deactivatePhaseIndicator(phase4, 4, PHASE_DURATION - 0.3)

      // Chain all phases
      master
        .add(phase1, 0)
        .add(phase2, PHASE_DURATION)
        .add(phase3, PHASE_DURATION * 2)
        .add(phase4, PHASE_DURATION * 3)
    }, container)

    return () => ctx.revert()
  }, [colors, getPhaseColor, getPhaseColorRgb])

  return (
    <ColorsContext.Provider value={colors}>
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-[768px] lg:max-w-[1200px] mx-auto">
          {/* Section header */}
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold">How Sandbox Works with LLM</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Give your AI agent secure code execution capabilities through an agentic tool loop
            </p>
          </div>

          {/* Responsive wrapper */}
          <div ref={wrapperRef} className="w-full">
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

                {/* Vignette */}
                <div
                  className="absolute inset-0 pointer-events-none z-40"
                  suppressHydrationWarning
                  style={{
                    boxShadow:
                      themeForShadow === 'dark'
                        ? 'inset 0 0 100px rgba(0, 0, 0, 0.6)'
                        : 'inset 0 0 80px rgba(0, 0, 0, 0.08)',
                  }}
                />

                {/* Phase indicators - clickable */}
                <div className="absolute top-5 left-0 right-0 flex justify-center gap-3 z-10">
                  {PHASES.map((phase) => (
                    <PhaseIndicator
                      key={phase.id}
                      phase={phase.id}
                      title={phase.title}
                      desc={phase.desc}
                      onClick={() => handlePhaseClick(phase.id)}
                    />
                  ))}
                </div>

                {/* PHASE 1: Setup - Create sandbox, disk, mount skills */}
                <Phase phase="1">
                  <div className="grid grid-cols-2 gap-8 w-full max-w-5xl">
                    <TerminalWindow dataCode="1" title="setup.py">
                      <AnimatedCodeLine dataLine="1-1" comment>
                        Create isolated sandbox & persistent disk
                      </AnimatedCodeLine>
                      <AnimatedCodeLine dataLine="1-2">
                        sandbox = client.<Fn>sandboxes</Fn>.<Fn>create</Fn>()
                      </AnimatedCodeLine>
                      <AnimatedCodeLine dataLine="1-3">
                        disk = client.<Fn>disks</Fn>.<Fn>create</Fn>()
                      </AnimatedCodeLine>
                      <AnimatedCodeLine dataLine="1-4" comment style={{ marginTop: 12 }}>
                        Upload agent skill (pptx generator, etc.)
                      </AnimatedCodeLine>
                      <AnimatedCodeLine dataLine="1-5">
                        skill = client.<Fn>skills</Fn>.<Fn>create</Fn>(file=zip_file)
                      </AnimatedCodeLine>
                    </TerminalWindow>

                    <div className="flex flex-col gap-3 justify-center">
                      <ResourceCard
                        dataResult="sandbox"
                        icon="📦"
                        title="Sandbox Ready"
                        items={[
                          { label: 'sandbox_id', value: '"sbx_7k2m9x"' },
                          { label: 'env', value: 'Python 3, bash, ripgrep...' },
                        ]}
                        color={colors.primary}
                      />
                      <ResourceCard
                        dataResult="disk"
                        icon="💾"
                        title="Disk Created"
                        items={[
                          { label: 'disk_id', value: '"dsk_3f8n2p"' },
                          { label: 'storage', value: '"persistent"' },
                        ]}
                        color={colors.secondary}
                      />
                      <ResourceCard
                        dataResult="skill"
                        icon="🧩"
                        title="Skill Uploaded"
                        items={[
                          { label: 'skill_id', value: '"skl_pptx_v1"' },
                          { label: 'mount_path', value: '"/skills/pptx/"' },
                        ]}
                        color={colors.accent}
                      />
                    </div>
                  </div>
                </Phase>

                {/* PHASE 2: Context - Build LLM system prompt with tools */}
                <Phase phase="2">
                  <div className="grid grid-cols-2 gap-8 w-full max-w-5xl">
                    <TerminalWindow dataCode="2" title="context.py">
                      <AnimatedCodeLine dataLine="2-1" comment>
                        Build context with tools & mounted skills
                      </AnimatedCodeLine>
                      <AnimatedCodeLine dataLine="2-2">
                        ctx = <Fn>SANDBOX_TOOLS</Fn>.<Fn>format_context</Fn>(
                      </AnimatedCodeLine>
                      <AnimatedCodeLine dataLine="2-3" indent={1}>
                        client, sandbox_id, disk_id,
                      </AnimatedCodeLine>
                      <AnimatedCodeLine dataLine="2-4" indent={1}>
                        <Kw>mount_skills</Kw>=[skill.id]
                      </AnimatedCodeLine>
                      <AnimatedCodeLine dataLine="2-5">
                        )
                      </AnimatedCodeLine>
                      <AnimatedCodeLine dataLine="2-6" comment style={{ marginTop: 12 }}>
                        Get OpenAI-compatible tool schema
                      </AnimatedCodeLine>
                      <AnimatedCodeLine dataLine="2-7">
                        tools = <Fn>SANDBOX_TOOLS</Fn>.<Fn>to_openai_tool_schema</Fn>()
                      </AnimatedCodeLine>
                    </TerminalWindow>

                    <div className="flex flex-col gap-3 justify-center">
                      <ContextCard
                        dataContext="prompt"
                        title="System Prompt Includes"
                        items={[
                          { icon: '🔧', text: 'Available tools: bash, editor, export' },
                          { icon: '📁', text: 'Mounted skills at /skills/' },
                          { icon: '📋', text: 'Skill instructions & examples' },
                        ]}
                      />
                      <ToolSchemaCard
                        dataContext="tools"
                        title="Tools → LLM"
                        tools={[
                          { name: 'bash_execution_sandbox', desc: 'Run shell commands' },
                          { name: 'text_editor_sandbox', desc: 'View/create/edit files' },
                          { name: 'export_file_sandbox', desc: 'Export with public URL' },
                        ]}
                      />
                    </div>
                  </div>
                </Phase>

                {/* PHASE 3: Agent Loop - LLM decides, tools execute */}
                <Phase phase="3">
                  <div className="w-full max-w-5xl">
                    <AgentLoopDiagram />
                  </div>
                </Phase>

                {/* PHASE 4: Export */}
                <Phase phase="4">
                  <div className="grid grid-cols-2 gap-8 w-full max-w-5xl">
                    <TerminalWindow dataCode="4" title="export.py">
                      <AnimatedCodeLine dataLine="4-1" comment>
                        LLM calls export tool to share results
                      </AnimatedCodeLine>
                      <AnimatedCodeLine dataLine="4-2">
                        <Kw>if</Kw> tool_name == <Str>&quot;export_file_sandbox&quot;</Str>:
                      </AnimatedCodeLine>
                      <AnimatedCodeLine dataLine="4-3" indent={1}>
                        result = <Fn>SANDBOX_TOOLS</Fn>.<Fn>execute_tool</Fn>(
                      </AnimatedCodeLine>
                      <AnimatedCodeLine dataLine="4-4" indent={2}>
                        ctx, tool_name, {'{'}
                        <Str>&quot;sandbox_path&quot;</Str>: path{'}'}
                      </AnimatedCodeLine>
                      <AnimatedCodeLine dataLine="4-5" indent={1}>
                        )
                      </AnimatedCodeLine>
                    </TerminalWindow>

                    <div className="flex flex-col gap-4 justify-center">
                      <div data-url-highlight>
                        <ResultBox
                          dataResultBox="export"
                          title="Public URL Generated"
                          content={`{
  "public_url": "https://cdn.acontext.io/f/report.pptx",
  "expires_in": "24h",
  "file_size": "2.4 MB"
}`}
                          icon="🔗"
                          highlight
                        />
                      </div>
                      <ChatBubble
                        dataResult="final"
                        role="assistant"
                        content="Done! Here's your presentation: cdn.acontext.io/f/report.pptx"
                        icon="🤖"
                      />
                    </div>
                  </div>
                </Phase>
              </div>
            </div>
          </div>
        </div>
      </section>
    </ColorsContext.Provider>
  )
}

// Sub-components
function Phase({ phase, children }: { phase: string; children: React.ReactNode }) {
  return (
    <div
      data-phase={phase}
      className="absolute inset-0 flex items-center justify-center pt-12 pb-2 px-4"
      style={{ opacity: 0 }}
    >
      {children}
    </div>
  )
}

function PhaseIndicator({
  phase,
  title,
  desc,
  onClick,
}: {
  phase: number
  title: string
  desc: string
  onClick: () => void
}) {
  const colors = useColors()
  return (
    <button
      data-phase-indicator={phase}
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all cursor-pointer hover:scale-[1.02]"
      style={{
        backgroundColor: colors.terminal,
        border: `2px solid ${colors.border}`,
      }}
    >
      <div
        data-phase-number
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{
          backgroundColor: 'transparent',
          color: colors.textMuted,
          border: `2px solid ${colors.border}`,
        }}
      >
        {phase}
      </div>
      <div className="flex flex-col text-left">
        <span data-phase-title className="text-xs font-semibold" style={{ color: colors.textMuted }}>
          {title}
        </span>
        <span className="text-[10px]" style={{ color: colors.textDim }}>
          {desc}
        </span>
      </div>
    </button>
  )
}

function TerminalWindow({
  dataCode,
  title,
  children,
}: {
  dataCode: string
  title: string
  children: React.ReactNode
}) {
  const colors = useColors()
  return (
    <div
      data-code={dataCode}
      className="rounded-lg overflow-hidden"
      style={{
        border: `2px solid ${colors.border}`,
        backgroundColor: colors.terminal,
        boxShadow: `0 0 30px rgba(${colors.primaryRgb}, 0.15)`,
        opacity: 0,
      }}
    >
      <div
        className="px-4 py-2 flex items-center gap-3 text-sm"
        style={{
          backgroundColor: colors.elevated,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#ff5f57' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#febc2e' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#28c840' }} />
        </div>
        <span className="text-xs" style={{ color: colors.textMuted }}>
          {title}
        </span>
      </div>
      <div className="p-4 text-sm leading-relaxed">{children}</div>
    </div>
  )
}

function AnimatedCodeLine({
  children,
  dataLine,
  indent = 0,
  comment,
  style,
}: {
  children?: React.ReactNode
  dataLine: string
  indent?: number
  comment?: boolean
  style?: React.CSSProperties
}) {
  const colors = useColors()
  const padding = '\u00A0'.repeat(indent * 2)

  if (comment) {
    return (
      <div
        data-code-line={dataLine}
        className="my-0.5 text-xs"
        style={{ color: colors.textDim, opacity: 0, ...style }}
      >
        {padding}# {children}
      </div>
    )
  }

  return (
    <div
      data-code-line={dataLine}
      className="my-0.5 text-xs"
      style={{ color: colors.text, opacity: 0, ...style }}
    >
      {padding}
      {children}
    </div>
  )
}

// Kw is specific to this animation (keyword highlight)
function Kw({ children }: { children: React.ReactNode }) {
  const colors = useColors()
  return <span style={{ color: colors.accent }}>{children}</span>
}

function ResourceCard({
  dataResult,
  icon,
  title,
  items,
  color,
}: {
  dataResult: string
  icon: string
  title: string
  items: Array<{ label: string; value: string }>
  color: string
}) {
  const colors = useColors()
  return (
    <div
      data-result={dataResult}
      className="p-3 rounded-lg"
      style={{
        border: `2px solid ${color}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: 'scale(0.9)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs font-semibold" style={{ color }}>
          {title}
        </span>
      </div>
      <div className="space-y-1">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 text-[10px] font-mono">
            <span style={{ color: colors.textMuted }}>{item.label}:</span>
            <span style={{ color: colors.text }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Context card - shows what's included in system prompt
function ContextCard({
  dataContext,
  title,
  items,
}: {
  dataContext: string
  title: string
  items: Array<{ icon: string; text: string }>
}) {
  const colors = useColors()
  return (
    <div
      data-context={dataContext}
      className="p-3 rounded-lg"
      style={{
        border: `2px solid ${colors.secondary}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: 'translateX(20px)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">📄</span>
        <span className="text-xs font-semibold" style={{ color: colors.secondary }}>
          {title}
        </span>
      </div>
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 text-[10px]">
            <span>{item.icon}</span>
            <span style={{ color: colors.text }}>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Tool schema card - shows available tools
function ToolSchemaCard({
  dataContext,
  title,
  tools,
}: {
  dataContext: string
  title: string
  tools: Array<{ name: string; desc: string }>
}) {
  const colors = useColors()
  return (
    <div
      data-context={dataContext}
      className="p-3 rounded-lg"
      style={{
        border: `2px solid ${colors.accent}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: 'translateX(20px)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">🔧</span>
        <span className="text-xs font-semibold" style={{ color: colors.accent }}>
          {title}
        </span>
      </div>
      <div className="space-y-1.5">
        {tools.map((tool, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <div
              className="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0"
              style={{ backgroundColor: colors.elevated, color: colors.accent }}
            >
              {tool.name}
            </div>
            <span className="text-[10px]" style={{ color: colors.textMuted }}>
              {tool.desc}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Chat bubble for user/assistant messages
function ChatBubble({
  dataResult,
  role,
  content,
  icon,
}: {
  dataResult: string
  role: 'user' | 'assistant'
  content: string
  icon: string
}) {
  const colors = useColors()
  const isUser = role === 'user'
  return (
    <div
      data-result={dataResult}
      className="p-3 rounded-lg"
      style={{
        border: `2px solid ${isUser ? colors.primary : colors.secondary}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: 'translateY(10px)',
      }}
    >
      <div className="flex items-start gap-2">
        <span className="text-base">{icon}</span>
        <div className="flex-1">
          <div className="text-[10px] font-semibold mb-1" style={{ color: isUser ? colors.primary : colors.secondary }}>
            {isUser ? 'User' : 'Assistant'}
          </div>
          <div className="text-xs" style={{ color: colors.text }}>
            {content}
          </div>
        </div>
      </div>
    </div>
  )
}

// Agent Loop Diagram - the core visualization
function AgentLoopDiagram() {
  const colors = useColors()
  
  return (
    <div className="relative flex flex-col items-center gap-4">
      {/* Top row: User Request */}
      <div
        data-loop="user"
        className="px-4 py-3 rounded-lg"
        style={{
          border: `2px solid ${colors.primary}`,
          backgroundColor: colors.terminal,
          opacity: 0,
          transform: 'translateY(-10px)',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">👤</span>
          <div>
            <div className="text-xs font-semibold" style={{ color: colors.primary }}>User Request</div>
            <div className="text-[11px] font-mono" style={{ color: colors.text }}>&quot;Create a sales report presentation&quot;</div>
          </div>
        </div>
      </div>

      {/* Arrow down */}
      <div
        data-loop="arrow-1"
        className="w-0.5 h-6"
        style={{ backgroundColor: colors.border, opacity: 0 }}
      />

      {/* Middle row: LLM → Tool Call → Sandbox */}
      <div className="flex items-center gap-4">
        {/* LLM */}
        <div
          data-loop="llm"
          className="px-4 py-3 rounded-lg text-center relative"
          style={{
            border: `2px solid ${colors.accent}`,
            backgroundColor: colors.terminal,
            opacity: 0,
            transform: 'scale(0.9)',
            minWidth: 140,
          }}
        >
          <div className="text-2xl mb-1">🧠</div>
          <div className="text-xs font-semibold" style={{ color: colors.accent }}>LLM</div>
          <div className="text-[10px]" style={{ color: colors.textMuted }}>Decides tool call</div>
        </div>

        {/* Arrow right */}
        <div
          data-loop="arrow-2"
          className="h-0.5 w-8"
          style={{ backgroundColor: colors.border, opacity: 0, transformOrigin: 'left' }}
        />

        {/* Tool Call */}
        <div
          data-loop="tool"
          className="px-3 py-2 rounded-lg"
          style={{
            border: `2px solid ${colors.secondary}`,
            backgroundColor: colors.terminal,
            opacity: 0,
            transform: 'scale(0.9)',
          }}
        >
          <div className="text-xs font-semibold mb-1" style={{ color: colors.secondary }}>Tool Call</div>
          <div
            className="text-[9px] font-mono px-2 py-1 rounded"
            style={{ backgroundColor: colors.elevated, color: colors.accent }}
          >
            bash_execution_sandbox
          </div>
          <div className="text-[9px] font-mono mt-1" style={{ color: colors.textDim }}>
            {`{cmd: "python3 /skills/pptx/main.py"}`}
          </div>
        </div>

        {/* Arrow right */}
        <div
          data-loop="arrow-3"
          className="h-0.5 w-8"
          style={{ backgroundColor: colors.border, opacity: 0, transformOrigin: 'left' }}
        />

        {/* Sandbox Execution */}
        <div
          data-loop="sandbox"
          className="px-4 py-3 rounded-lg text-center"
          style={{
            border: `2px solid ${colors.primary}`,
            backgroundColor: colors.terminal,
            opacity: 0,
            transform: 'scale(0.9)',
            minWidth: 140,
          }}
        >
          <div className="text-2xl mb-1">📦</div>
          <div className="text-xs font-semibold" style={{ color: colors.primary }}>Sandbox</div>
          <div className="text-[10px]" style={{ color: colors.textMuted }}>Executes securely</div>
        </div>
      </div>

      {/* Arrow down from sandbox */}
      <div
        data-loop="arrow-4"
        className="w-0.5 h-6"
        style={{ backgroundColor: colors.border, opacity: 0, transformOrigin: 'top' }}
      />

      {/* Result box with loop back indicator */}
      <div className="flex items-center gap-6">
        {/* Result box */}
        <div
          data-loop="result"
          className="px-4 py-3 rounded-lg"
          style={{
            border: `2px solid ${colors.secondary}`,
            backgroundColor: colors.terminal,
            opacity: 0,
            transform: 'translateY(10px)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">✅</span>
            <div>
              <div className="text-xs font-semibold" style={{ color: colors.secondary }}>Tool Result</div>
              <div className="text-[10px] font-mono" style={{ color: colors.text }}>
                stdout: &quot;Presentation created at /output/report.pptx&quot;
              </div>
            </div>
          </div>
        </div>

        {/* Loop back indicator - horizontal pill badge */}
        <div
          data-loop="arrow-back"
          className="flex items-center gap-2 px-3 py-2 rounded-full"
          style={{
            backgroundColor: `rgba(${colors.accentRgb}, 0.15)`,
            border: `1px solid ${colors.accent}`,
            opacity: 0,
          }}
        >
          <span className="text-base" style={{ color: colors.accent }}>↻</span>
          <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: colors.accent }}>
            Loop until done
          </span>
        </div>
      </div>
    </div>
  )
}

function ResultBox({
  dataResultBox,
  title,
  content,
  icon,
  highlight,
}: {
  dataResultBox: string
  title: string
  content: string
  icon: string
  highlight?: boolean
}) {
  const colors = useColors()
  return (
    <div
      data-result-box={dataResultBox}
      className="p-3 rounded-lg"
      style={{
        border: `2px solid ${highlight ? colors.primary : colors.border}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: 'scale(0.9)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-semibold" style={{ color: colors.text }}>
          {title}
        </span>
      </div>
      <pre
        className="text-[10px] font-mono p-2 rounded overflow-x-auto whitespace-pre-wrap"
        style={{
          backgroundColor: colors.elevated,
          color: highlight ? colors.primary : colors.text,
          lineHeight: 1.4,
        }}
      >
        {content}
      </pre>
    </div>
  )
}
