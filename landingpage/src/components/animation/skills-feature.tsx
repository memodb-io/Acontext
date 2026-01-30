'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import gsap from 'gsap'
import {
  TerminalWindow,
  CodeLine,
  Fn,
  Str,
  CodeContainer,
  useColors,
} from './shared/terminal-components'

// Animated flow step - compact size
function FlowStep({
  icon,
  label,
  description,
  isActive,
  onClick,
}: {
  icon: string
  label: string
  description: string
  isActive?: boolean
  onClick?: () => void
}) {
  const colors = useColors()

  return (
    <div
      data-animate-step
      onClick={onClick}
      className="flex flex-col items-center p-3 rounded-lg cursor-pointer transition-all hover:scale-105"
      style={{
        border: `2px solid ${isActive ? colors.accent : colors.border}`,
        backgroundColor: isActive ? `rgba(${colors.accentRgb}, 0.1)` : colors.terminal,
        opacity: 0,
        transform: 'scale(0.8)',
        width: '90px',
      }}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div
        className="text-sm font-bold"
        style={{ color: isActive ? colors.accent : colors.text }}
      >
        {label}
      </div>
      <div className="text-[10px] mt-0.5" style={{ color: colors.textMuted }}>
        {description}
      </div>
    </div>
  )
}

// Animated arrow - smaller
function FlowArrow({ isActive }: { isActive?: boolean }) {
  const colors = useColors()
  return (
    <div
      data-animate-step
      className="flex items-center px-1"
      style={{ opacity: 0, transform: 'scale(0.8)' }}
    >
      <svg
        width="24"
        height="16"
        viewBox="0 0 24 16"
        style={{ color: isActive ? colors.accent : colors.textDim }}
      >
        <path
          d="M0 8 L18 8 M14 4 L18 8 L14 12"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

// Code section with highlight based on active step
function CodeSection({ activeStep }: { activeStep: number }) {
  const colors = useColors()

  const getHighlightStyle = (step: number) => ({
    backgroundColor: activeStep === step ? `rgba(${colors.accentRgb}, 0.15)` : 'transparent',
    borderLeft: activeStep === step ? `3px solid ${colors.accent}` : '3px solid transparent',
    paddingLeft: '8px',
    marginLeft: '-11px',
    transition: 'all 0.3s ease',
    borderRadius: '4px',
  })

  return (
    <TerminalWindow title="Agent Skills API" style={{ flex: 1 }}>
      <CodeContainer>
        {/* Step 0: Create */}
        <div style={getHighlightStyle(0)}>
          <CodeLine comment># 1. Upload skill from zip file</CodeLine>
          <CodeLine>
            skill = client.<Fn>skills</Fn>.<Fn>create</Fn>(
          </CodeLine>
          <CodeLine indent={2}>
            <Str>file</Str>=<Fn>FileUpload</Fn>(<Str>filename</Str>=<Str>&quot;skill.zip&quot;</Str>, ...),
          </CodeLine>
          <CodeLine indent={2}>
            <Str>meta</Str>={'{'}
            <Str>&quot;version&quot;</Str>: <Str>&quot;1.0&quot;</Str>
            {'}'}
          </CodeLine>
          <CodeLine>)</CodeLine>
        </div>

        {/* Step 1: Deploy to Sandbox */}
        <div style={{ ...getHighlightStyle(1), marginTop: 12 }}>
          <CodeLine comment># 2. Deploy skill to sandbox</CodeLine>
          <CodeLine>
            client.<Fn>skills</Fn>.<Fn>download_to_sandbox</Fn>(
          </CodeLine>
          <CodeLine indent={2}>
            <Str>skill_id</Str>=skill.<Fn>id</Fn>,
          </CodeLine>
          <CodeLine indent={2}>
            <Str>sandbox_id</Str>=sandbox.<Fn>sandbox_id</Fn>
          </CodeLine>
          <CodeLine>)</CodeLine>
        </div>

        {/* Step 2: Execute */}
        <div style={{ ...getHighlightStyle(2), marginTop: 12 }}>
          <CodeLine comment># 3. Execute in isolated sandbox</CodeLine>
          <CodeLine>
            result = client.<Fn>sandboxes</Fn>.<Fn>exec_command</Fn>(
          </CodeLine>
          <CodeLine indent={2}>
            <Str>sandbox_id</Str>=sandbox.<Fn>sandbox_id</Fn>,
          </CodeLine>
          <CodeLine indent={2}>
            <Str>command</Str>=<Str>&quot;python /skills/...&quot;</Str>
          </CodeLine>
          <CodeLine>)</CodeLine>
        </div>
      </CodeContainer>
    </TerminalWindow>
  )
}

// Sandbox terminal simulation with animated text
function SandboxTerminal({ activeStep }: { activeStep: number }) {
  const colors = useColors()
  const terminalRef = useRef<HTMLDivElement>(null)
  const prevStepRef = useRef(activeStep)

  const allOutputs = [
    { text: '$ uploading skill.zip...', color: colors.textMuted },
    { text: '✓ skill created: data-extraction', color: colors.primary },
    { text: '$ deploying to sandbox...', color: colors.textMuted },
    { text: '✓ mounted at /skills/data-extraction/', color: colors.primary },
    { text: '$ python /skills/data-extraction/main.py', color: colors.textMuted },
    { text: '>>> exit_code: 0, stdout: "Done"', color: colors.accent },
  ]

  const lineCount = Math.min(activeStep * 2 + 2, allOutputs.length)
  const visibleLines = allOutputs.slice(0, lineCount)

  // Animate new lines when activeStep increases
  useEffect(() => {
    if (!terminalRef.current) return

    const prevLineCount = Math.min(prevStepRef.current * 2 + 2, allOutputs.length)

    if (activeStep > prevStepRef.current && lineCount > prevLineCount) {
      // Animate only the new lines
      const newLines = terminalRef.current.querySelectorAll(
        `[data-line-index="${prevLineCount}"], [data-line-index="${prevLineCount + 1}"]`,
      )
      gsap.fromTo(
        newLines,
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, duration: 0.3, stagger: 0.15, ease: 'power2.out' },
      )
    } else if (activeStep < prevStepRef.current) {
      // Reset when cycling back
      const allLines = terminalRef.current.querySelectorAll('[data-line-index]')
      gsap.set(allLines, { opacity: 1, x: 0 })
    }

    prevStepRef.current = activeStep
  }, [activeStep, lineCount, allOutputs.length])

  return (
    <div
      data-animate-sandbox
      className="rounded-lg overflow-hidden flex-1 flex flex-col"
      style={{
        border: `2px solid ${colors.accent}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: 'translateY(20px)',
      }}
    >
      <div
        className="px-4 py-2 text-sm font-bold flex items-center gap-2 shrink-0"
        style={{ backgroundColor: colors.elevated, color: colors.accent }}
      >
        <span>🔒</span>
        <span>Sandbox Output</span>
      </div>
      <div ref={terminalRef} className="p-4 font-mono text-sm flex-1">
        {visibleLines.map((line, i) => (
          <div
            key={i}
            data-line-index={i}
            data-animate-output
            className="mb-1.5"
            style={{ color: line.color, opacity: i < 2 ? 0 : 1 }}
          >
            {line.text}
          </div>
        ))}
        <span
          className="inline-block w-2 h-4 animate-pulse"
          style={{ backgroundColor: colors.accent }}
        />
      </div>
    </div>
  )
}

export function SkillsFeature() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeStep, setActiveStep] = useState(0)

  const runAnimation = useCallback(() => {
    if (!containerRef.current) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline()

      tl.to('[data-animate-code]', { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0.1)
        .to(
          '[data-animate-step]',
          {
            opacity: 1,
            scale: 1,
            duration: 0.4,
            stagger: 0.12,
            ease: 'back.out(1.5)',
          },
          0.2,
        )
        .to('[data-animate-sandbox]', { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 0.6)
        .to(
          '[data-animate-output]',
          {
            opacity: 1,
            duration: 0.3,
            stagger: 0.15,
            ease: 'power2.out',
          },
          0.8,
        )
    }, containerRef)

    return () => ctx.revert()
  }, [])

  useEffect(() => {
    const cleanup = runAnimation()
    return cleanup
  }, [runAnimation])

  // Auto-cycle through steps
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 3)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  const handleStepClick = (step: number) => {
    setActiveStep(step)
    gsap.to(containerRef.current?.querySelectorAll('[data-animate-step]')[step * 2], {
      scale: 1.1,
      duration: 0.2,
      yoyo: true,
      repeat: 1,
    })
  }

  return (
    <div ref={containerRef} className="flex flex-col w-full h-full px-10 py-6">
      <div className="grid grid-cols-5 gap-6 h-full">
        {/* Code section */}
        <div className="col-span-3 flex flex-col">
          <CodeSection activeStep={activeStep} />
        </div>

        {/* Visual flow section */}
        <div className="col-span-2 flex flex-col gap-4">
          {/* Flow diagram - compact horizontal layout */}
          <div
            className="flex items-center justify-center gap-1 p-4 rounded-lg"
            style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
          >
            <FlowStep
              icon="📦"
              label="Create"
              description="skills.create"
              isActive={activeStep === 0}
              onClick={() => handleStepClick(0)}
            />
            <FlowArrow isActive={activeStep >= 1} />
            <FlowStep
              icon="📥"
              label="Deploy"
              description="to sandbox"
              isActive={activeStep === 1}
              onClick={() => handleStepClick(1)}
            />
            <FlowArrow isActive={activeStep >= 2} />
            <FlowStep
              icon="▶️"
              label="Execute"
              description="sandbox.run"
              isActive={activeStep === 2}
              onClick={() => handleStepClick(2)}
            />
          </div>

          {/* Sandbox terminal */}
          <SandboxTerminal activeStep={activeStep} />
        </div>
      </div>
    </div>
  )
}
