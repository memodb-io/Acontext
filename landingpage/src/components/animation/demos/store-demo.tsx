'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import {
  MessageSquare,
  ListChecks,
  CheckCircle2,
  Radio,
  Brain,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ToolCallLogStatic, animateToolCallEntry, typeTextToElement } from './shared'

// ─── Data ────────────────────────────────────────────────────────────────────

const TOOL_CALLS = [
  { id: '1', message: 'Buffered 2 messages', label: 'Observer', icon: Radio },
  { id: '2', message: 'Extracted 2 tasks', label: 'Task Engine', icon: Brain },
  { id: '3', message: 'Attached to Learning Space', label: 'Learning', icon: Sparkles },
  { id: '4', message: 'Learning queued for session', label: 'Learning', icon: Sparkles },
]

const TASKS = [
  { id: 't1', title: 'Deploy API to staging' },
  { id: 't2', title: 'Update API documentation' },
]

// Status badge styles (inline since we no longer use the motion-based StatusBadge)
const statusStyles: Record<string, { bg: string; text: string; border: string }> = {
  pending: {
    bg: 'bg-zinc-200 dark:bg-zinc-800',
    text: 'text-zinc-500 dark:text-zinc-400',
    border: 'border-zinc-300 dark:border-zinc-700',
  },
  running: {
    bg: 'bg-blue-100/50 dark:bg-blue-950/50',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-300 dark:border-blue-700',
  },
  done: {
    bg: 'bg-emerald-100/50 dark:bg-emerald-950/50',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-300 dark:border-emerald-700',
  },
}

// ─── Main Store Demo ────────────────────────────────────────────────────────

export function StoreDemo() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    let pulseTween: gsap.core.Tween | null = null
    let cursorTween: gsap.core.Tween | null = null
    let typingTween: gsap.core.Tween | null = null

    const ctx = gsap.context(() => {
      const tl = gsap.timeline()

      // ── 0.4s: User message ──
      tl.set('[data-store-user-msg]', { display: '' }, 0.4)
      tl.to('[data-store-user-msg]', {
        opacity: 1, y: 0, duration: 0.5, ease: 'power3.out',
      }, 0.4)

      // ── 1.6s: Assistant message container + typing animation ──
      tl.set('[data-store-assistant-msg]', { display: '' }, 1.6)
      tl.to('[data-store-assistant-msg]', {
        opacity: 1, y: 0, duration: 0.5, ease: 'power3.out',
      }, 1.6)

      // Start cursor blink
      tl.call(() => {
        const cursor = containerRef.current?.querySelector('[data-store-cursor]') as HTMLElement
        if (cursor) {
          cursor.style.opacity = '1'
          cursorTween = gsap.to(cursor, {
            opacity: 0, duration: 0.5, repeat: -1, yoyo: true,
          })
        }
      }, [], 1.6)

      // Typing animation
      tl.call(() => {
        const textEl = containerRef.current?.querySelector('[data-store-assistant-text]') as HTMLElement
        if (textEl) {
          typingTween = typeTextToElement(
            textEl,
            "On it. I'll handle the deployment first, then update the docs.",
            35,
          )
        }
      }, [], 1.8)

      // Stop cursor after typing completes (~2.1s of typing at 35ms/char for ~60 chars)
      tl.call(() => {
        if (cursorTween) { cursorTween.kill(); cursorTween = null }
        const cursor = containerRef.current?.querySelector('[data-store-cursor]') as HTMLElement
        if (cursor) cursor.style.opacity = '0'
      }, [], 4.2)

      // ── 3.2s: Observer active ──
      tl.to('[data-store-observer]', {
        opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)',
      }, 3.2)
      tl.call(() => {
        const dot = containerRef.current?.querySelector('[data-store-pulse-dot]') as HTMLElement
        if (dot) {
          pulseTween = gsap.to(dot, {
            scale: 1.3, duration: 0.75, repeat: -1, yoyo: true, ease: 'power1.inOut',
          })
        }
      }, [], 3.2)

      // Tool call log: entry 0 at 3.2s
      animateToolCallEntry(tl, 0, 3.2)

      // ── 4.5s: Task 1 appears (running) ──
      // Hide "Waiting for tasks..."
      tl.to('[data-store-waiting]', { opacity: 0, duration: 0.2 }, 4.3)
      tl.set('[data-store-waiting]', { display: 'none' }, 4.5)

      tl.set('[data-store-task="0"]', { display: '' }, 4.5)
      tl.to('[data-store-task="0"]', {
        opacity: 1, x: 0, duration: 0.5, ease: 'power3.out',
      }, 4.5)

      // Tool call log: entry 1 at 4.5s
      animateToolCallEntry(tl, 1, 4.5)

      // ── 5.5s: Task 2 appears (pending) ──
      tl.set('[data-store-task="1"]', { display: '' }, 5.5)
      tl.to('[data-store-task="1"]', {
        opacity: 1, x: 0, duration: 0.5, ease: 'power3.out',
      }, 5.5)

      // ── 7.0s: Task 1 → done ──
      tl.call(() => {
        updateStatusBadge(containerRef.current, 'data-task-badge="t1"', 'done')
      }, [], 7.0)

      // ── 8.5s: Task 2 → running ──
      tl.call(() => {
        updateStatusBadge(containerRef.current, 'data-task-badge="t2"', 'running')
      }, [], 8.5)

      // ── 10.0s: Task 2 → done ──
      tl.call(() => {
        updateStatusBadge(containerRef.current, 'data-task-badge="t2"', 'done')
      }, [], 10.0)

      // "2 done" badge
      tl.to('[data-store-done-count]', {
        opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)',
      }, 10.2)

      // ── 11.0s: Attach to learning space ──
      tl.set('[data-store-attach]', { display: '' }, 11.0)
      tl.to('[data-store-attach]', {
        opacity: 1, y: 0, duration: 0.5, ease: 'power3.out',
      }, 11.0)

      // Tool call log: entry 2 at 11.0s
      animateToolCallEntry(tl, 2, 11.0)

      // ── 12.0s: Learning queued ──
      tl.to('[data-store-learning-queued]', {
        opacity: 1, duration: 0.3,
      }, 12.0)

      // Tool call log: entry 3 at 12.0s
      animateToolCallEntry(tl, 3, 12.0, false)
    }, containerRef)

    return () => {
      if (pulseTween) pulseTween.kill()
      if (cursorTween) cursorTween.kill()
      if (typingTween) typingTween.kill()
      ctx.revert()
    }
  }, [])

  return (
    <div ref={containerRef} className="h-full flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-4">
        <div className="flex-3 min-w-0 flex flex-col gap-3">
          {/* Conversation panel */}
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl">
            <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2">
              <MessageSquare className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
              <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">Session</span>
              <div
                data-store-observer
                style={{ opacity: 0, transform: 'scale(0.8)' }}
                className="ml-auto flex items-center gap-1.5"
              >
                <div
                  data-store-pulse-dot
                  className="w-1.5 h-1.5 rounded-full bg-cyan-500"
                />
                <span className="text-[10px] sm:text-xs text-cyan-600 dark:text-cyan-400">Observer active</span>
              </div>
            </div>
            <div className="p-3 sm:p-4 space-y-3 min-h-[80px] sm:min-h-[100px]">
              {/* User message */}
              <div
                data-store-user-msg
                style={{ display: 'none', opacity: 0, transform: 'translateY(12px)' }}
                className="flex gap-2 sm:gap-3"
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] sm:text-xs font-bold bg-blue-600 text-white">
                  U
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 mb-0.5">User</p>
                  <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Deploy the API to staging and update the docs
                  </p>
                </div>
              </div>

              {/* Assistant message */}
              <div
                data-store-assistant-msg
                style={{ display: 'none', opacity: 0, transform: 'translateY(12px)' }}
                className="flex gap-2 sm:gap-3"
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] sm:text-xs font-bold bg-emerald-600 text-white">
                  A
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 mb-0.5">Agent</p>
                  <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    <span data-store-assistant-text></span>
                    <span data-store-cursor style={{ opacity: 0 }} className="text-emerald-500 ml-0.5">|</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Extracted tasks panel */}
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl">
            <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2">
              <ListChecks className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
              <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">Extracted Tasks</span>
              <span
                data-store-done-count
                style={{ opacity: 0, transform: 'scale(0.8)' }}
                className="ml-auto text-[10px] sm:text-xs bg-emerald-100/50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 border border-emerald-300/50 dark:border-emerald-500/30"
              >
                2 done
              </span>
            </div>
            <div className="p-3 sm:p-4 space-y-2 min-h-[80px] sm:min-h-[100px]">
              {/* Task 1 */}
              <div
                data-store-task="0"
                style={{ display: 'none', opacity: 0, transform: 'translateX(-12px)' }}
                className="flex items-center gap-2 p-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                <span className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 flex-1 truncate">
                  {TASKS[0].title}
                </span>
                <span
                  data-task-badge="t1"
                  data-task-status="running"
                  className={cn(
                    'text-[10px] sm:text-xs px-1.5 py-0.5 border font-mono uppercase',
                    statusStyles.running.bg,
                    statusStyles.running.text,
                    statusStyles.running.border,
                  )}
                >
                  running
                </span>
              </div>

              {/* Task 2 */}
              <div
                data-store-task="1"
                style={{ display: 'none', opacity: 0, transform: 'translateX(-12px)' }}
                className="flex items-center gap-2 p-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                <span className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 flex-1 truncate">
                  {TASKS[1].title}
                </span>
                <span
                  data-task-badge="t2"
                  data-task-status="pending"
                  className={cn(
                    'text-[10px] sm:text-xs px-1.5 py-0.5 border font-mono uppercase',
                    statusStyles.pending.bg,
                    statusStyles.pending.text,
                    statusStyles.pending.border,
                  )}
                >
                  pending
                </span>
              </div>

              {/* Waiting placeholder */}
              <div
                data-store-waiting
                className="flex items-center justify-center py-4 text-zinc-400 dark:text-zinc-600 text-xs sm:text-sm"
              >
                <Radio className="w-4 h-4 mr-2 opacity-50" />
                Waiting for tasks...
              </div>

              {/* Attach to Learning Space */}
              <div
                data-store-attach
                style={{ display: 'none', opacity: 0, transform: 'translateY(8px)' }}
                className="mt-2 flex items-center gap-2 px-2 py-1.5 border border-violet-300/50 dark:border-violet-700/50 bg-violet-100/20 dark:bg-violet-950/20 rounded"
              >
                <Sparkles className="w-3 h-3 text-violet-500 dark:text-violet-400" />
                <span className="text-[10px] sm:text-xs text-violet-600 dark:text-violet-400">
                  Attached to Learning Space
                </span>
                <span
                  data-store-learning-queued
                  style={{ opacity: 0 }}
                  className="ml-auto text-[10px] text-violet-400 dark:text-violet-500"
                >
                  Learning queued
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Tool call log */}
        <div className="hidden sm:flex flex-2 min-w-0 flex-col justify-center">
          <ToolCallLogStatic calls={TOOL_CALLS} />
        </div>
      </div>
    </div>
  )
}

// ─── Helper: update a status badge's text and styling ───────────────────────

function updateStatusBadge(
  container: HTMLElement | null,
  selector: string,
  status: 'pending' | 'running' | 'done',
) {
  const el = container?.querySelector(`[${selector}]`) as HTMLElement | null
  if (!el) return

  const style = statusStyles[status]
  el.textContent = status
  el.dataset.taskStatus = status

  // Remove old status classes and apply new ones
  el.className = cn(
    'text-[10px] sm:text-xs px-1.5 py-0.5 border font-mono uppercase',
    style.bg,
    style.text,
    style.border,
  )

  // Quick scale pop animation
  gsap.fromTo(el, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.5)' })
}
