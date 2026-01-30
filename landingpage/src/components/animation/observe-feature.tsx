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

// Animated task item with click interaction
function TaskItem({
  title,
  status,
  progress,
  time,
}: {
  title: string
  status: 'success' | 'pending' | 'processing'
  progress: string
  time: string
}) {
  const colors = useColors()
  const itemRef = useRef<HTMLDivElement>(null)
  const [currentStatus, setCurrentStatus] = useState(status)

  const statusColors = {
    success: colors.primary,
    pending: colors.textMuted,
    processing: colors.warning,
  }

  const statusLabels = {
    success: 'DONE',
    pending: 'PENDING',
    processing: 'RUNNING',
  }

  const handleClick = () => {
    if (!itemRef.current) return

    gsap.to(itemRef.current, {
      scale: 0.98,
      duration: 0.1,
      yoyo: true,
      repeat: 1,
      ease: 'power2.inOut',
    })

    if (currentStatus === 'pending') {
      setCurrentStatus('processing')
    } else if (currentStatus === 'processing') {
      setCurrentStatus('success')
    }
  }

  return (
    <div
      ref={itemRef}
      data-animate-task
      onClick={handleClick}
      className="p-5 rounded-lg cursor-pointer transition-all hover:scale-[1.01]"
      style={{
        border: `2px solid ${colors.border}`,
        backgroundColor: colors.terminal,
        opacity: 0,
        transform: 'translateX(20px)',
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold truncate" style={{ color: colors.text }}>
            {title}
          </div>
          <div className="text-sm mt-1" style={{ color: colors.textMuted }}>
            {progress}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs" style={{ color: colors.textDim }}>
            {time}
          </span>
          <span
            data-status
            data-animate-status
            className="px-3 py-1.5 rounded text-xs font-bold"
            style={{
              backgroundColor: `${statusColors[currentStatus]}30`,
              color: statusColors[currentStatus],
              opacity: 0,
              transform: 'scale(0.8)',
            }}
          >
            {statusLabels[currentStatus]}
          </span>
        </div>
      </div>
    </div>
  )
}

// Progress indicator
function ProgressBar({
  observed,
  processing,
  pending,
}: {
  observed: number
  processing: number
  pending: number
}) {
  const colors = useColors()
  const total = observed + processing + pending

  return (
    <div
      data-animate-progress
      className="p-5 rounded-lg flex-1"
      style={{
        border: `2px solid ${colors.border}`,
        backgroundColor: colors.terminal,
        opacity: 0,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-base font-semibold" style={{ color: colors.text }}>
          Message Processing Status
        </span>
        <span className="text-sm" style={{ color: colors.textMuted }}>
          {observed}/{total} observed
        </span>
      </div>
      <div
        className="h-3 rounded-full overflow-hidden flex"
        style={{ backgroundColor: colors.border }}
      >
        <div
          className="h-full transition-all"
          style={{ width: `${(observed / total) * 100}%`, backgroundColor: colors.primary }}
        />
        <div
          className="h-full transition-all"
          style={{ width: `${(processing / total) * 100}%`, backgroundColor: colors.warning }}
        />
      </div>
      <div className="flex gap-6 mt-4">
        <span className="text-sm flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: colors.primary }}
          />
          <span style={{ color: colors.textMuted }}>Observed ({observed})</span>
        </span>
        <span className="text-sm flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: colors.warning }}
          />
          <span style={{ color: colors.textMuted }}>Processing ({processing})</span>
        </span>
        <span className="text-sm flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: colors.border }}
          />
          <span style={{ color: colors.textMuted }}>Pending ({pending})</span>
        </span>
      </div>
    </div>
  )
}

export function ObserveFeature() {
  const containerRef = useRef<HTMLDivElement>(null)
  const colors = useColors()

  const runAnimation = useCallback(() => {
    if (!containerRef.current) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline()

      tl.to('[data-animate-code]', { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0.1)
        .to(
          '[data-animate-task]',
          {
            opacity: 1,
            x: 0,
            duration: 0.4,
            stagger: 0.1,
            ease: 'power2.out',
          },
          0.2,
        )
        .to(
          '[data-animate-status]',
          {
            opacity: 1,
            scale: 1,
            duration: 0.3,
            stagger: 0.08,
            ease: 'back.out(1.5)',
          },
          0.5,
        )
        .to('[data-animate-progress]', { opacity: 1, duration: 0.4 }, 0.6)
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
        {/* Code section */}
        <div className="col-span-3 flex flex-col">
          <TerminalWindow title="Agent Observability API" style={{ flex: 1 }}>
            <CodeContainer>
              <CodeLine comment># Store agent response with task plan</CodeLine>
              <CodeLine>
                client.<Fn>sessions</Fn>.<Fn>store_message</Fn>(session.<Fn>id</Fn>,
              </CodeLine>
              <CodeLine indent={2}>
                <Str>blob</Str>={'{'}
                <Str>&quot;role&quot;</Str>: <Str>&quot;assistant&quot;</Str>,
              </CodeLine>
              <CodeLine indent={2}>
                {'        '}
                <Str>&quot;content&quot;</Str>: <Str>&quot;My plan: 1. Research...&quot;</Str>
                {'}'})
              </CodeLine>

              <CodeLine comment style={{ marginTop: 14 }}>
                # Flush buffer → extract tasks immediately
              </CodeLine>
              <CodeLine>
                client.<Fn>sessions</Fn>.<Fn>flush</Fn>(session.<Fn>id</Fn>)
              </CodeLine>

              <CodeLine comment style={{ marginTop: 14 }}>
                # Get auto-extracted tasks
              </CodeLine>
              <CodeLine>
                tasks = client.<Fn>sessions</Fn>.<Fn>get_tasks</Fn>(session.<Fn>id</Fn>)
              </CodeLine>
              <CodeLine>
                <span style={{ color: colors.secondary }}>for</span> task{' '}
                <span style={{ color: colors.secondary }}>in</span> tasks.<Fn>items</Fn>:
              </CodeLine>
              <CodeLine indent={2}>
                <span style={{ color: colors.secondary }}>print</span>(task.<Fn>data</Fn>
                .<Fn>task_description</Fn>)
              </CodeLine>

              <CodeLine comment style={{ marginTop: 14 }}>
                # Monitor processing: observed / in_process / pending
              </CodeLine>
              <CodeLine>
                client.<Fn>sessions</Fn>.<Fn>get_message_observing_status</Fn>(...)
              </CodeLine>
            </CodeContainer>
          </TerminalWindow>
        </div>

        {/* Tasks section */}
        <div className="col-span-2 flex flex-col gap-4">
          <TaskItem
            title="Research iPhone 15 features"
            status="success"
            progress="Extracted key specs"
            time="2m ago"
          />
          <TaskItem
            title="Create Next.js project"
            status="processing"
            progress="Setting up components..."
            time="1m ago"
          />
          <TaskItem
            title="Deploy to Cloudflare"
            status="pending"
            progress="Waiting for build"
            time="just now"
          />
          <ProgressBar observed={45} processing={3} pending={2} />
        </div>
      </div>
    </div>
  )
}
