'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
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
import { ToolCallLog } from './shared'

type Stage =
  | 'init'
  | 'space-appear'
  | 'distilling'
  | 'skill-1'
  | 'skill-2'
  | 'skill-3-update'
  | 'preview-1'
  | 'skill-4-new'
  | 'preview-2'
  | 'skill-5-new'
  | 'preview-3'
  | 'complete'

const TIMELINE: Record<Stage, number> = {
  'init': 0,
  'space-appear': 500,
  'distilling': 1500,
  'skill-1': 3000,
  'skill-2': 4000,
  'skill-3-update': 5500,
  'preview-1': 7000,
  'skill-4-new': 9000,
  'preview-2': 10500,
  'skill-5-new': 12500,
  'preview-3': 14000,
  'complete': 15500,
}

const STAGES: Stage[] = Object.keys(TIMELINE) as Stage[]

const TOOL_CALLS = [
  { id: '1', message: 'Distilling task outcomes...', label: 'Learning', icon: Brain },
  { id: '2', message: 'Updated skill: deployment-sop', label: 'Skills', icon: RefreshCw },
  { id: '3', message: 'Created skill: api-docs-checklist', label: 'Skills', icon: Plus },
  { id: '4', message: 'Created skill: social-contacts', label: 'Skills', icon: Plus },
]

const STAGE_TO_LOG: Record<Stage, number> = {
  'init': 0, 'space-appear': 0,
  'distilling': 1, 'skill-1': 1, 'skill-2': 1,
  'skill-3-update': 2, 'preview-1': 2,
  'skill-4-new': 3, 'preview-2': 3,
  'skill-5-new': 4, 'preview-3': 4,
  'complete': 4,
}

interface SkillEntry {
  name: string
  status: 'default' | 'updated' | 'new'
  entries: number
}

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

export function ObserveDemo() {
  const [stage, setStage] = useState<Stage>('init')
  const [logCount, setLogCount] = useState(0)
  const [previewIdx, setPreviewIdx] = useState(0)

  useEffect(() => {
    setStage('init')
    setLogCount(0)
    setPreviewIdx(0)

    const timers: ReturnType<typeof setTimeout>[] = []
    for (const [s, delay] of Object.entries(TIMELINE)) {
      if (delay > 0) {
        timers.push(
          setTimeout(() => {
            const st = s as Stage
            setStage(st)
            setLogCount(STAGE_TO_LOG[st])
            if (st === 'preview-1') setPreviewIdx(0)
            if (st === 'preview-2') setPreviewIdx(1)
            if (st === 'preview-3') setPreviewIdx(2)
          }, delay),
        )
      }
    }
    return () => timers.forEach(clearTimeout)
  }, [])

  const si = STAGES.indexOf(stage)
  const showSpace = si >= STAGES.indexOf('space-appear')
  const isDistilling = si >= STAGES.indexOf('distilling')
  const isComplete = si >= STAGES.indexOf('complete')
  const showPreview = si >= STAGES.indexOf('preview-1')

  const skills: SkillEntry[] = [
    ...(si >= STAGES.indexOf('skill-1')
      ? [{ name: 'daily-logs', status: 'default' as const, entries: 12 }]
      : []),
    ...(si >= STAGES.indexOf('skill-2')
      ? [{ name: 'user-general-facts', status: 'default' as const, entries: 8 }]
      : []),
    ...(si >= STAGES.indexOf('skill-3-update')
      ? [{ name: 'deployment-sop', status: 'updated' as const, entries: 6 }]
      : []),
    ...(si >= STAGES.indexOf('skill-4-new')
      ? [{ name: 'api-docs-checklist', status: 'new' as const, entries: 1 }]
      : []),
    ...(si >= STAGES.indexOf('skill-5-new')
      ? [{ name: 'social-contacts', status: 'new' as const, entries: 1 }]
      : []),
  ]

  const currentPreview = PREVIEWS[previewIdx]

  return (
    <div className="h-full flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-4">
        {/* Left column: Learning Space + Skills list */}
        <div className="flex-1 min-w-0">
          <AnimatePresence>
            {showSpace && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl"
              >
                <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2">
                  <BookOpen className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
                  <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">Learning Space</span>
                  {isDistilling && !isComplete && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="ml-auto flex items-center gap-1"
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      >
                        <Brain className="w-3 h-3 text-violet-400 dark:text-violet-500" />
                      </motion.div>
                      <span className="text-[10px] text-violet-400 dark:text-violet-500">Distilling...</span>
                    </motion.div>
                  )}
                  {isComplete && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="ml-auto"
                    >
                      <Check className="w-4 h-4 text-emerald-500" />
                    </motion.div>
                  )}
                </div>
                <div className="p-3 sm:p-4 space-y-1.5 min-h-[200px] sm:min-h-[280px]">
                  <AnimatePresence>
                    {skills.map((skill) => (
                      <motion.div
                        key={skill.name}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
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
                          <motion.span
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-[10px] text-violet-500 dark:text-violet-400 font-medium"
                          >
                            +1 entry
                          </motion.span>
                        )}
                        {skill.status === 'new' && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-[10px] text-emerald-500 dark:text-emerald-400 font-medium"
                          >
                            NEW
                          </motion.span>
                        )}
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
                          {skill.entries} {skill.entries === 1 ? 'entry' : 'entries'}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right column: Markdown preview + Tool call log */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Markdown file preview */}
          <AnimatePresence mode="wait">
            {showPreview && currentPreview && (
              <motion.div
                key={currentPreview.path}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl"
              >
                <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2">
                  <FileText className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
                  <span className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate">
                    {currentPreview.path}
                  </span>
                </div>
                <div className="p-3 sm:p-4 max-h-[200px] sm:max-h-[240px] overflow-y-auto">
                  <pre className="text-[10px] sm:text-xs leading-relaxed font-mono whitespace-pre-wrap">
                    {currentPreview.content.split('\n').map((line, i) => {
                      let className = 'text-zinc-600 dark:text-zinc-400'
                      if (line.startsWith('---')) className = 'text-zinc-400 dark:text-zinc-600'
                      else if (line.startsWith('name:') || line.startsWith('description:'))
                        className = 'text-cyan-600 dark:text-cyan-400'
                      else if (line.startsWith('# ')) className = 'text-zinc-800 dark:text-zinc-200 font-semibold'
                      else if (line.startsWith('## ')) className = 'text-zinc-700 dark:text-zinc-300 font-medium'
                      else if (line.startsWith('- ')) className = 'text-zinc-600 dark:text-zinc-400'

                      return (
                        <motion.span
                          key={`${currentPreview.path}-${i}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.04 }}
                          className={cn('block', className)}
                        >
                          {line || '\u00A0'}
                        </motion.span>
                      )
                    })}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tool call log */}
          <div className="hidden sm:block">
            <ToolCallLog calls={TOOL_CALLS.slice(0, logCount)} />
          </div>
        </div>
      </div>
    </div>
  )
}
