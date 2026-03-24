'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import {
  BookOpen,
  Brain,
  Sparkles,
  FileText,
  Check,
  RefreshCw,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ToolCallLogStatic, animateToolCallEntry } from './shared'

// ─── Data ────────────────────────────────────────────────────────────────────

const TOOL_CALLS = [
  { id: '1', message: 'Distilling task outcomes...', label: 'Learning', icon: Brain },
  { id: '2', message: 'Updated skill: deployment-sop', label: 'Skills', icon: RefreshCw },
  { id: '3', message: 'Created skill: api-docs-checklist', label: 'Skills', icon: Plus },
  { id: '4', message: 'Created skill: social-contacts', label: 'Skills', icon: Plus },
]

interface SkillDef {
  name: string
  status: 'default' | 'updated' | 'new'
  entries: number
}

const ALL_SKILLS: SkillDef[] = [
  { name: 'daily-logs', status: 'default', entries: 12 },
  { name: 'user-general-facts', status: 'default', entries: 8 },
  { name: 'deployment-sop', status: 'updated', entries: 6 },
  { name: 'api-docs-checklist', status: 'new', entries: 1 },
  { name: 'social-contacts', status: 'new', entries: 1 },
]

interface PreviewFile {
  path: string
  content: string
}

const PREVIEWS: PreviewFile[] = [
  {
    path: 'deployment-sop/SKILL.md',
    content: `---
name: deployment-sop
description: Standard operating procedure for deployments
---

# Deployment SOP

## Steps
1. Run pre-deploy checks
2. Deploy to staging first
3. Verify health endpoints
4. Deploy to production`,
  },
  {
    path: 'api-docs-checklist/SKILL.md',
    content: `---
name: api-docs-checklist
description: Checklist for API documentation updates
---

# API Docs Checklist

- [ ] Update endpoint descriptions
- [ ] Add request/response examples
- [ ] Update changelog
- [ ] Verify code samples compile`,
  },
  {
    path: 'social-contacts/alice-chen.md',
    content: `# Alice Chen

## Basics
- **Role:** Engineering Lead
- **Company:** Acme Corp
- **Relationship:** Primary stakeholder

## Notes
- Prefers async communication
- Timezone: PST`,
  },
]

// ─── Preview content line renderer ──────────────────────────────────────────

function PreviewLines({ preview, index }: { preview: PreviewFile; index: number }) {
  const lines = preview.content.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        let className = 'text-zinc-600 dark:text-zinc-400'
        if (line.startsWith('---')) className = 'text-zinc-400 dark:text-zinc-600'
        else if (line.startsWith('name:') || line.startsWith('description:'))
          className = 'text-cyan-600 dark:text-cyan-400'
        else if (line.startsWith('# ')) className = 'text-zinc-800 dark:text-zinc-200 font-semibold'
        else if (line.startsWith('## ')) className = 'text-zinc-700 dark:text-zinc-300 font-medium'
        else if (line.startsWith('- ')) className = 'text-zinc-600 dark:text-zinc-400'

        return (
          <span
            key={i}
            data-preview-line={`${index}-${i}`}
            style={{ opacity: 0 }}
            className={cn('block', className)}
          >
            {line || '\u00A0'}
          </span>
        )
      })}
    </>
  )
}

// ─── Main Observe Demo ──────────────────────────────────────────────────────

export function ObserveDemo() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    let spinnerTween: gsap.core.Tween | null = null

    const ctx = gsap.context(() => {
      const tl = gsap.timeline()

      // ── 0.5s: Learning space panel appears ──
      tl.set('[data-learning-space]', { display: '' }, 0.5)
      tl.to('[data-learning-space]', {
        opacity: 1, y: 0, duration: 0.5, ease: 'power3.out',
      }, 0.5)

      // ── 1.5s: Distilling indicator ──
      tl.to('[data-distilling]', { opacity: 1, duration: 0.3 }, 1.5)
      tl.call(() => {
        const spinner = containerRef.current?.querySelector('[data-distill-spinner]') as HTMLElement
        if (spinner) {
          spinnerTween = gsap.to(spinner, {
            rotation: 360, duration: 2, repeat: -1, ease: 'none',
          })
        }
      }, [], 1.5)

      // Tool call log: entry 0 at 1.5s
      animateToolCallEntry(tl, 0, 1.5)

      // ── 3.0s-5.5s: Skills appear one by one ──
      // Each skill: set display, then animate in
      tl.set('[data-skill-entry="0"]', { display: '' }, 3.0)
      tl.to('[data-skill-entry="0"]', { opacity: 1, x: 0, duration: 0.4, ease: 'power3.out' }, 3.0)

      tl.set('[data-skill-entry="1"]', { display: '' }, 4.0)
      tl.to('[data-skill-entry="1"]', { opacity: 1, x: 0, duration: 0.4, ease: 'power3.out' }, 4.0)

      // Skill 2 (updated): 5.5s
      tl.set('[data-skill-entry="2"]', { display: '' }, 5.5)
      tl.to('[data-skill-entry="2"]', { opacity: 1, x: 0, duration: 0.4, ease: 'power3.out' }, 5.5)
      tl.to('[data-skill-badge="2"]', { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.5)' }, 5.7)

      // Tool call log: entry 1 at 5.5s
      animateToolCallEntry(tl, 1, 5.5)

      // ── 7.0s: Preview 0 ──
      tl.set('[data-observe-preview="0"]', { display: '' }, 7.0)
      tl.to('[data-observe-preview="0"]', { opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }, 7.0)
      const p0Lines = PREVIEWS[0].content.split('\n').length
      for (let i = 0; i < p0Lines; i++) {
        tl.to(`[data-preview-line="0-${i}"]`, { opacity: 1, duration: 0.2 }, 7.2 + i * 0.04)
      }

      // ── 9.0s: Skill 3 (new) ──
      tl.set('[data-skill-entry="3"]', { display: '' }, 9.0)
      tl.to('[data-skill-entry="3"]', { opacity: 1, x: 0, duration: 0.4, ease: 'power3.out' }, 9.0)
      tl.to('[data-skill-badge="3"]', { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.5)' }, 9.2)
      animateToolCallEntry(tl, 2, 9.0)

      // ── 10.5s: Cross-fade to preview 1 ──
      tl.to('[data-observe-preview="0"]', { opacity: 0, y: -8, duration: 0.2, ease: 'power2.in' }, 10.5)
      tl.set('[data-observe-preview="0"]', { display: 'none' }, 10.7)
      tl.set('[data-observe-preview="1"]', { display: '' }, 10.7)
      tl.to('[data-observe-preview="1"]', { opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }, 10.7)
      const p1Lines = PREVIEWS[1].content.split('\n').length
      for (let i = 0; i < p1Lines; i++) {
        tl.to(`[data-preview-line="1-${i}"]`, { opacity: 1, duration: 0.2 }, 10.9 + i * 0.04)
      }

      // ── 12.5s: Skill 4 (new) ──
      tl.set('[data-skill-entry="4"]', { display: '' }, 12.5)
      tl.to('[data-skill-entry="4"]', { opacity: 1, x: 0, duration: 0.4, ease: 'power3.out' }, 12.5)
      tl.to('[data-skill-badge="4"]', { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.5)' }, 12.7)
      animateToolCallEntry(tl, 3, 12.5, false)

      // ── 14.0s: Cross-fade to preview 2 ──
      tl.to('[data-observe-preview="1"]', { opacity: 0, y: -8, duration: 0.2, ease: 'power2.in' }, 14.0)
      tl.set('[data-observe-preview="1"]', { display: 'none' }, 14.2)
      tl.set('[data-observe-preview="2"]', { display: '' }, 14.2)
      tl.to('[data-observe-preview="2"]', { opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }, 14.2)
      const p2Lines = PREVIEWS[2].content.split('\n').length
      for (let i = 0; i < p2Lines; i++) {
        tl.to(`[data-preview-line="2-${i}"]`, { opacity: 1, duration: 0.2 }, 14.4 + i * 0.04)
      }

      // ── 15.5s: Complete — hide distilling, show checkmark ──
      tl.to('[data-distilling]', { opacity: 0, duration: 0.2 }, 15.5)
      tl.call(() => {
        if (spinnerTween) {
          spinnerTween.kill()
          spinnerTween = null
        }
      }, [], 15.5)
      tl.to('[data-observe-complete]', {
        opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)',
      }, 15.5)
    }, containerRef)

    return () => {
      if (spinnerTween) spinnerTween.kill()
      ctx.revert()
    }
  }, [])

  return (
    <div ref={containerRef} className="h-full flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-4">
        {/* Left column: Learning Space + Skills list */}
        <div className="flex-1 min-w-0">
          <div
            data-learning-space
            style={{ display: 'none', opacity: 0, transform: 'translateY(16px)' }}
            className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl"
          >
            <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2">
              <BookOpen className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
              <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">Learning Space</span>

              {/* Distilling indicator */}
              <div
                data-distilling
                style={{ opacity: 0 }}
                className="ml-auto flex items-center gap-1"
              >
                <div data-distill-spinner>
                  <Brain className="w-3 h-3 text-violet-400 dark:text-violet-500" />
                </div>
                <span className="text-[10px] text-violet-400 dark:text-violet-500">Distilling...</span>
              </div>

              {/* Complete checkmark */}
              <div
                data-observe-complete
                style={{ opacity: 0, transform: 'scale(0)' }}
                className="ml-auto"
              >
                <Check className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
            <div className="p-3 sm:p-4 space-y-1.5 min-h-[200px] sm:min-h-[280px]">
              {ALL_SKILLS.map((skill, i) => (
                <div
                  key={skill.name}
                  data-skill-entry={i}
                  style={{ display: 'none', opacity: 0, transform: 'translateX(-8px)' }}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded border',
                    skill.status === 'updated'
                      ? 'border-violet-300/50 dark:border-violet-700/50 bg-violet-50/30 dark:bg-violet-950/20'
                      : skill.status === 'new'
                        ? 'border-emerald-300/50 dark:border-emerald-700/50 bg-emerald-50/30 dark:bg-emerald-950/20'
                        : 'border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/30',
                  )}
                >
                  <Sparkles
                    className={cn(
                      'w-3 h-3 shrink-0',
                      skill.status === 'updated'
                        ? 'text-violet-500'
                        : skill.status === 'new'
                          ? 'text-emerald-500'
                          : 'text-zinc-400 dark:text-zinc-500',
                    )}
                  />
                  <span className="text-xs text-zinc-600 dark:text-zinc-400 font-mono truncate flex-1">
                    {skill.name}
                  </span>
                  {skill.status === 'updated' && (
                    <span
                      data-skill-badge={i}
                      style={{ opacity: 0, transform: 'scale(0.8)' }}
                      className="text-[10px] text-violet-500 dark:text-violet-400 font-medium"
                    >
                      +1 entry
                    </span>
                  )}
                  {skill.status === 'new' && (
                    <span
                      data-skill-badge={i}
                      style={{ opacity: 0, transform: 'scale(0.8)' }}
                      className="text-[10px] text-emerald-500 dark:text-emerald-400 font-medium"
                    >
                      NEW
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
                    {skill.entries} {skill.entries === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Markdown preview + Tool call log */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Preview panels — all hidden, shown one at a time */}
          {PREVIEWS.map((preview, idx) => (
            <div
              key={preview.path}
              data-observe-preview={idx}
              style={{ display: 'none', opacity: 0, transform: 'translateY(12px)' }}
              className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl"
            >
              <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2">
                <FileText className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
                <span className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate">
                  {preview.path}
                </span>
              </div>
              <div className="p-3 sm:p-4 max-h-[200px] sm:max-h-[240px] overflow-y-auto">
                <pre className="text-[10px] sm:text-xs leading-relaxed font-mono whitespace-pre-wrap">
                  <PreviewLines preview={preview} index={idx} />
                </pre>
              </div>
            </div>
          ))}

          {/* Tool call log */}
          <div className="hidden sm:block">
            <ToolCallLogStatic calls={TOOL_CALLS} />
          </div>
        </div>
      </div>
    </div>
  )
}
