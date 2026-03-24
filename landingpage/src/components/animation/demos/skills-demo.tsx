'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import {
  Sparkles,
  Search,
  FileText,
  Check,
  Bot,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ToolCallLogStatic, animateToolCallEntry } from './shared'

// ─── Data ────────────────────────────────────────────────────────────────────

const TOOL_CALLS = [
  { id: '1', message: 'get_skill("deployment-sop")', label: 'Skill Tools', icon: Search },
  { id: '2', message: 'get_skill_file("SKILL.md")', label: 'Skill Tools', icon: FileText },
  { id: '3', message: 'get_skill_file("staging-steps.md")', label: 'Skill Tools', icon: FileText },
  { id: '4', message: 'Skill applied — task completed', label: 'Agent', icon: Check },
]

const SKILL_META = {
  name: 'deployment-sop',
  description: 'Standard operating procedure for deployments',
  files: ['SKILL.md', 'staging-steps.md', 'rollback.md'],
}

const FILE_CONTENTS: Record<string, string> = {
  'SKILL.md': `---
name: deployment-sop
description: Standard operating procedure
---

# Deployment SOP
1. Run pre-deploy checks
2. Deploy to staging first
3. Verify health endpoints`,
  'staging-steps.md': `# Staging Deployment

## Pre-checks
- All tests passing
- No pending migrations

## Steps
1. Tag release branch
2. Deploy via CI pipeline
3. Run smoke tests`,
}

const FILES = ['SKILL.md', 'staging-steps.md', 'rollback.md']

// ─── File content line renderer ─────────────────────────────────────────────

function FileContentLines({ file }: { file: string }) {
  const lines = FILE_CONTENTS[file]?.split('\n') ?? []
  return (
    <>
      {lines.map((line, i) => {
        let className = 'text-zinc-600 dark:text-zinc-400'
        if (line.startsWith('---')) className = 'text-zinc-400 dark:text-zinc-600'
        else if (line.startsWith('name:') || line.startsWith('description:'))
          className = 'text-cyan-600 dark:text-cyan-400'
        else if (line.startsWith('# ')) className = 'text-zinc-800 dark:text-zinc-200 font-semibold'
        else if (line.startsWith('## ')) className = 'text-zinc-700 dark:text-zinc-300 font-medium'

        return (
          <span
            key={i}
            data-file-line={`${file}-${i}`}
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

// ─── Main Skills Demo ────────────────────────────────────────────────────────

export function SkillsDemo() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline()

      // ── 0.5s: "Starting deployment task..." ──
      tl.set('[data-agent-start]', { display: '' }, 0.5)
      tl.to('[data-agent-start]', {
        opacity: 1, y: 0, duration: 0.4, ease: 'power3.out',
      }, 0.5)

      // ── 1.5s: get_skill code line ──
      tl.set('[data-skill-call]', { display: '' }, 1.5)
      tl.to('[data-skill-call]', {
        opacity: 1, y: 0, duration: 0.4, ease: 'power3.out',
      }, 1.5)

      // ── Tool call log: entry 0 at 1.5s ──
      animateToolCallEntry(tl, 0, 1.5)

      // ── 2.5s: Skill metadata panel ──
      tl.set('[data-skill-meta]', { display: '' }, 2.5)
      tl.to('[data-skill-meta]', {
        opacity: 1, y: 0, duration: 0.5, ease: 'power3.out',
      }, 2.5)

      // File list items stagger
      tl.to('[data-skill-file]', {
        opacity: 1, x: 0, duration: 0.4,
        stagger: 0.1, ease: 'power3.out',
      }, 2.7)

      // ── 4.0s: Highlight file 0, show file preview 0, tool call 1 ──
      tl.to('[data-file-highlight="0"]', {
        className: '+=bg-violet-100/30 dark:bg-violet-950/30',
      }, 4.0)
      tl.set('[data-file-highlight="0"]', {
        borderColor: 'rgba(196, 181, 253, 0.5)',
      }, 4.0)
      tl.to('[data-file-arrow="0"]', { opacity: 1, duration: 0.3 }, 4.0)

      // Show file preview 0 (in the absolute-positioned container)
      tl.set('[data-file-preview="SKILL.md"]', { display: '' }, 4.0)
      tl.to('[data-file-preview="SKILL.md"]', {
        opacity: 1, y: 0, duration: 0.3, ease: 'power3.out',
      }, 4.0)
      // Stagger file content lines
      const skillMdLines = FILE_CONTENTS['SKILL.md']?.split('\n').length ?? 0
      for (let i = 0; i < skillMdLines; i++) {
        tl.to(`[data-file-line="SKILL.md-${i}"]`, {
          opacity: 1, duration: 0.2,
        }, 4.2 + i * 0.03)
      }

      // Tool call log: entry 1 at 4.0s
      animateToolCallEntry(tl, 1, 4.0)

      // ── 6.5s: "Applying deployment SOP..." ──
      tl.set('[data-agent-applying]', { display: '' }, 6.5)
      tl.to('[data-agent-applying]', {
        opacity: 1, y: 0, duration: 0.4, ease: 'power3.out',
      }, 6.5)

      // ── 7.5s: Switch to file 1 — unhighlight 0, highlight 1, cross-fade preview ──
      tl.set('[data-file-highlight="0"]', {
        borderColor: 'transparent',
      }, 7.5)
      tl.to('[data-file-arrow="0"]', { opacity: 0, duration: 0.2 }, 7.5)

      tl.to('[data-file-highlight="1"]', {
        className: '+=bg-violet-100/30 dark:bg-violet-950/30',
      }, 7.5)
      tl.set('[data-file-highlight="1"]', {
        borderColor: 'rgba(196, 181, 253, 0.5)',
      }, 7.5)
      tl.to('[data-file-arrow="1"]', { opacity: 1, duration: 0.3 }, 7.5)

      // Cross-fade: hide first preview, show second
      tl.to('[data-file-preview="SKILL.md"]', {
        opacity: 0, y: -8, duration: 0.2, ease: 'power2.in',
      }, 7.5)
      tl.set('[data-file-preview="SKILL.md"]', { display: 'none' }, 7.7)

      tl.set('[data-file-preview="staging-steps.md"]', { display: '' }, 7.7)
      tl.to('[data-file-preview="staging-steps.md"]', {
        opacity: 1, y: 0, duration: 0.3, ease: 'power3.out',
      }, 7.7)
      const stagingLines = FILE_CONTENTS['staging-steps.md']?.split('\n').length ?? 0
      for (let i = 0; i < stagingLines; i++) {
        tl.to(`[data-file-line="staging-steps.md-${i}"]`, {
          opacity: 1, duration: 0.2,
        }, 7.9 + i * 0.03)
      }

      // Tool call log: entry 2 at 7.5s
      animateToolCallEntry(tl, 2, 7.5)

      // ── 10.0s: Done badge + done message + tool call 3 ──
      tl.set('[data-agent-done-msg]', { display: '' }, 10.0)
      tl.to('[data-agent-done-badge]', {
        opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)',
      }, 10.0)
      tl.to('[data-agent-done-msg]', {
        opacity: 1, y: 0, duration: 0.4, ease: 'power3.out',
      }, 10.0)

      animateToolCallEntry(tl, 3, 10.0, false)
    }, containerRef)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={containerRef} className="h-full flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-4">
        {/* Left: Agent panel */}
        <div className="flex-3 min-w-0 flex flex-col gap-3">
          {/* Agent status */}
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl">
            <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2">
              <Bot className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
              <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">Agent</span>
              <div
                data-agent-done-badge
                style={{ opacity: 0, transform: 'scale(0.8)' }}
                className="ml-auto flex items-center gap-1.5"
              >
                <Check className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400">Done</span>
              </div>
            </div>
            <div className="p-3 sm:p-4 space-y-2.5 min-h-[80px]">
              {/* Each message hidden until its stage */}
              <div
                data-agent-start
                style={{ display: 'none', opacity: 0, transform: 'translateY(8px)' }}
                className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300"
              >
                Starting deployment task...
              </div>
              <div
                data-skill-call
                style={{ display: 'none', opacity: 0, transform: 'translateY(8px)' }}
                className="flex items-center gap-2 px-2 py-1.5 bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800/60 rounded font-mono text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400"
              >
                <Search className="w-3 h-3 shrink-0" />
                <span>get_skill(&quot;deployment-sop&quot;)</span>
              </div>
              <div
                data-agent-applying
                style={{ display: 'none', opacity: 0, transform: 'translateY(8px)' }}
                className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300"
              >
                Applying deployment SOP...
              </div>
              <div
                data-agent-done-msg
                style={{ display: 'none', opacity: 0, transform: 'translateY(8px)' }}
                className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400"
              >
                Deployment completed following the SOP ✓
              </div>
            </div>
          </div>

          {/* Skill metadata result — hidden until 2.5s */}
          <div
            data-skill-meta
            style={{ display: 'none', opacity: 0, transform: 'translateY(12px)' }}
            className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl"
          >
            <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2">
              <Sparkles className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400 mr-2" />
              <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                {SKILL_META.name}
              </span>
            </div>
            <div className="p-3 sm:p-4 space-y-2">
              <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400">
                {SKILL_META.description}
              </p>
              <div className="space-y-1">
                {FILES.map((file, i) => (
                  <div
                    key={file}
                    data-skill-file
                    data-file-highlight={i}
                    style={{ opacity: 0, transform: 'translateX(-6px)' }}
                    className="flex items-center gap-2 px-2 py-1 rounded text-[10px] sm:text-xs border border-transparent"
                  >
                    <FileText className="w-3 h-3 text-zinc-400 dark:text-zinc-500 shrink-0" />
                    <span className="font-mono text-zinc-600 dark:text-zinc-400">{file}</span>
                    <div
                      data-file-arrow={i}
                      style={{ opacity: 0 }}
                      className="ml-auto"
                    >
                      <ArrowRight className="w-3 h-3 text-violet-500" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* File content previews — stacked with display:none, shown one at a time */}
          <div
            data-file-preview="SKILL.md"
            style={{ display: 'none', opacity: 0, transform: 'translateY(10px)' }}
            className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl"
          >
            <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2">
              <FileText className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
              <span className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-mono">SKILL.md</span>
            </div>
            <div className="p-3 sm:p-4 max-h-[160px] overflow-y-auto">
              <pre className="text-[10px] sm:text-xs leading-relaxed font-mono whitespace-pre-wrap">
                <FileContentLines file="SKILL.md" />
              </pre>
            </div>
          </div>

          <div
            data-file-preview="staging-steps.md"
            style={{ display: 'none', opacity: 0, transform: 'translateY(10px)' }}
            className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl"
          >
            <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2">
              <FileText className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
              <span className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-mono">staging-steps.md</span>
            </div>
            <div className="p-3 sm:p-4 max-h-[160px] overflow-y-auto">
              <pre className="text-[10px] sm:text-xs leading-relaxed font-mono whitespace-pre-wrap">
                <FileContentLines file="staging-steps.md" />
              </pre>
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
