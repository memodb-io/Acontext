'use client'

import { useEffect, useRef, useCallback } from 'react'
import gsap from 'gsap'
import {
  TerminalWindow,
  CodeLine,
  Fn,
  Str,
  CodeContainer,
  useColors,
} from './shared/terminal-components'

// Feature card component with hover animation
function FeatureCard({
  title,
  description,
  icon,
  features,
}: {
  title: string
  description: string
  icon: string
  features: string[]
}) {
  const colors = useColors()
  const cardRef = useRef<HTMLDivElement>(null)

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

  return (
    <div
      ref={cardRef}
      data-animate-card
      onClick={handleClick}
      className="p-6 rounded-lg cursor-pointer transition-all hover:scale-[1.02] flex-1"
      style={{
        border: `2px solid ${colors.border}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: 'translateY(20px)',
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="text-4xl p-4 rounded-lg shrink-0"
          style={{ backgroundColor: `rgba(${colors.primaryRgb}, 0.1)` }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-xl font-bold mb-2" style={{ color: colors.text }}>
            {title}
          </div>
          <p className="text-sm mb-4" style={{ color: colors.textMuted }}>
            {description}
          </p>
          <div className="flex flex-wrap gap-2">
            {features.map((feature, i) => (
              <span
                key={i}
                data-animate-tag
                className="px-3 py-1.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: `rgba(${colors.primaryRgb}, 0.15)`,
                  color: colors.primary,
                  opacity: 0,
                  transform: 'scale(0.8)',
                }}
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function StoreFeature() {
  const containerRef = useRef<HTMLDivElement>(null)
  const colors = useColors()

  const runAnimation = useCallback(() => {
    if (!containerRef.current) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline()

      tl.to('[data-animate-code]', { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0.1)
        .to(
          '[data-animate-card]',
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            stagger: 0.12,
            ease: 'power2.out',
          },
          0.2,
        )
        .to(
          '[data-animate-tag]',
          {
            opacity: 1,
            scale: 1,
            duration: 0.3,
            stagger: 0.05,
            ease: 'back.out(1.5)',
          },
          0.5,
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
      <div className="grid grid-cols-5 gap-8 h-full">
        {/* Code section - 3 columns */}
        <div className="col-span-3 flex flex-col">
          <TerminalWindow title="Context Storage API" style={{ flex: 1 }}>
            <CodeContainer>
              <CodeLine comment># Create session with user association</CodeLine>
              <CodeLine>
                session = client.<Fn>sessions</Fn>.<Fn>create</Fn>(
                <Str>user</Str>=<Str>&quot;alice@acme.com&quot;</Str>)
              </CodeLine>

              <CodeLine comment style={{ marginTop: 14 }}>
                # Store messages - auto-converts between providers
              </CodeLine>
              <CodeLine>
                client.<Fn>sessions</Fn>.<Fn>store_message</Fn>(
              </CodeLine>
              <CodeLine indent={2}>
                <Str>session_id</Str>=session.<Fn>id</Fn>,
              </CodeLine>
              <CodeLine indent={2}>
                <Str>blob</Str>={'{'}
                <Str>&quot;role&quot;</Str>: <Str>&quot;assistant&quot;</Str>,{' '}
                <Str>&quot;content&quot;</Str>: <Str>&quot;...&quot;</Str>
                {'}'},
              </CodeLine>
              <CodeLine indent={2}>
                <Str>format</Str>=<Str>&quot;openai&quot;</Str>
                <span style={{ color: colors.textDim }}> # openai | anthropic | gemini</span>
              </CodeLine>
              <CodeLine>)</CodeLine>

              <CodeLine comment style={{ marginTop: 14 }}>
                # Upload files to S3-backed disk
              </CodeLine>
              <CodeLine>
                client.<Fn>disks</Fn>.<Fn>artifacts</Fn>.<Fn>upsert</Fn>(
              </CodeLine>
              <CodeLine indent={2}>
                disk.<Fn>id</Fn>, <Str>file</Str>=<Fn>FileUpload</Fn>(...),
              </CodeLine>
              <CodeLine indent={2}>
                <Str>file_path</Str>=<Str>&quot;/docs/&quot;</Str>
              </CodeLine>
              <CodeLine>)</CodeLine>

              <CodeLine comment style={{ marginTop: 14 }}>
                # Search with glob & regex patterns
              </CodeLine>
              <CodeLine>
                client.<Fn>disks</Fn>.<Fn>artifacts</Fn>.<Fn>glob_artifacts</Fn>(
              </CodeLine>
              <CodeLine indent={2}>
                disk.<Fn>id</Fn>, <Str>query</Str>=<Str>&quot;**/*.md&quot;</Str>)
              </CodeLine>
            </CodeContainer>
          </TerminalWindow>
        </div>

        {/* Features section - 2 columns */}
        <div className="col-span-2 flex flex-col gap-6">
          <FeatureCard
            title="Sessions"
            description="Store and retrieve messages across OpenAI, Anthropic, and Gemini formats with automatic conversion."
            icon="💬"
            features={['OpenAI', 'Anthropic', 'Gemini', 'Multi-modal']}
          />
          <FeatureCard
            title="Disk & Artifacts"
            description="S3-backed file storage with glob and regex search. Upload, download, and manage agent artifacts."
            icon="📦"
            features={['Glob search', 'Regex grep', 'Metadata']}
          />
        </div>
      </div>
    </div>
  )
}
