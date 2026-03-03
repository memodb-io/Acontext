'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Sparkles,
  Search,
  FileText,
  Check,
  Bot,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ToolCallLog } from './shared'

type Stage =
  | 'init'
  | 'agent-start'
  | 'call-get-skill'
  | 'skill-result'
  | 'call-get-file'
  | 'file-result'
  | 'agent-applying'
  | 'call-get-file-2'
  | 'file-result-2'
  | 'agent-done'

const TIMELINE: Record<Stage, number> = {
  'init': 0,
  'agent-start': 500,
  'call-get-skill': 1500,
  'skill-result': 2500,
  'call-get-file': 4000,
  'file-result': 5000,
  'agent-applying': 6500,
  'call-get-file-2': 7500,
  'file-result-2': 8500,
  'agent-done': 10000,
}

const STAGES: Stage[] = Object.keys(TIMELINE) as Stage[]

const TOOL_CALLS = [
  { id: '1', message: 'get_skill("deployment-sop")', label: 'Skill Tools', icon: Search },
  { id: '2', message: 'get_skill_file("SKILL.md")', label: 'Skill Tools', icon: FileText },
  { id: '3', message: 'get_skill_file("staging-steps.md")', label: 'Skill Tools', icon: FileText },
  { id: '4', message: 'Skill applied — task completed', label: 'Agent', icon: Check },
]

const STAGE_TO_LOG: Record<Stage, number> = {
  'init': 0, 'agent-start': 0,
  'call-get-skill': 1, 'skill-result': 1,
  'call-get-file': 2, 'file-result': 2,
  'agent-applying': 2,
  'call-get-file-2': 3, 'file-result-2': 3,
  'agent-done': 4,
}

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

export function SkillsDemo() {
  const [stage, setStage] = useState<Stage>('init')
  const [logCount, setLogCount] = useState(0)

  useEffect(() => {
    setStage('init')
    setLogCount(0)

    const timers: ReturnType<typeof setTimeout>[] = []
    for (const [s, delay] of Object.entries(TIMELINE)) {
      if (delay > 0) {
        timers.push(
          setTimeout(() => {
            const st = s as Stage
            setStage(st)
            setLogCount(STAGE_TO_LOG[st])
          }, delay),
        )
      }
    }
    return () => timers.forEach(clearTimeout)
  }, [])

  const si = STAGES.indexOf(stage)

  const showAgentStart = si >= STAGES.indexOf('agent-start')
  const showSkillCall = si >= STAGES.indexOf('call-get-skill')
  const showSkillResult = si >= STAGES.indexOf('skill-result')
  const showFileCall = si >= STAGES.indexOf('call-get-file')
  const showFileResult = si >= STAGES.indexOf('file-result')
  const showApplying = si >= STAGES.indexOf('agent-applying')
  const showFileCall2 = si >= STAGES.indexOf('call-get-file-2')
  const showFileResult2 = si >= STAGES.indexOf('file-result-2')
  const showDone = si >= STAGES.indexOf('agent-done')

  const currentFile =
    showFileResult2 ? 'staging-steps.md'
    : showFileResult ? 'SKILL.md'
    : null

  return (
    <div className="h-full flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-4">
        {/* Left: Agent panel */}
        <div className="flex-3 min-w-0 flex flex-col gap-3">
          {/* Agent status */}
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl">
            <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2">
              <Bot className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
              <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">Agent</span>
              {showDone && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="ml-auto flex items-center gap-1.5"
                >
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400">Done</span>
                </motion.div>
              )}
            </div>
            <div className="p-3 sm:p-4 space-y-2.5 min-h-[80px]">
              <AnimatePresence>
                {showAgentStart && (
                  <motion.div
                    key="start"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    Starting deployment task...
                  </motion.div>
                )}
                {showSkillCall && (
                  <motion.div
                    key="skill-call"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 px-2 py-1.5 bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800/60 rounded font-mono text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400"
                  >
                    <Search className="w-3 h-3 shrink-0" />
                    <span>get_skill(&quot;deployment-sop&quot;)</span>
                  </motion.div>
                )}
                {showApplying && (
                  <motion.div
                    key="applying"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    Applying deployment SOP...
                  </motion.div>
                )}
                {showDone && (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400"
                  >
                    Deployment completed following the SOP ✓
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Skill metadata result */}
          <AnimatePresence>
            {showSkillResult && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
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
                    {SKILL_META.files.map((file, i) => {
                      const isActive =
                        (showFileCall && !showFileCall2 && i === 0) ||
                        (showFileCall2 && i === 1)

                      return (
                        <motion.div
                          key={file}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className={cn(
                            'flex items-center gap-2 px-2 py-1 rounded text-[10px] sm:text-xs',
                            isActive
                              ? 'bg-violet-100/30 dark:bg-violet-950/30 border border-violet-300/50 dark:border-violet-700/50'
                              : 'border border-transparent',
                          )}
                        >
                          <FileText className="w-3 h-3 text-zinc-400 dark:text-zinc-500 shrink-0" />
                          <span className="font-mono text-zinc-600 dark:text-zinc-400">{file}</span>
                          {isActive && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="ml-auto"
                            >
                              <ArrowRight className="w-3 h-3 text-violet-500" />
                            </motion.div>
                          )}
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* File content preview */}
          <AnimatePresence mode="wait">
            {currentFile && (
              <motion.div
                key={currentFile}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl"
              >
                <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2">
                  <FileText className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
                  <span className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    {currentFile}
                  </span>
                </div>
                <div className="p-3 sm:p-4 max-h-[160px] overflow-y-auto">
                  <pre className="text-[10px] sm:text-xs leading-relaxed font-mono whitespace-pre-wrap">
                    {FILE_CONTENTS[currentFile]?.split('\n').map((line, i) => {
                      let className = 'text-zinc-600 dark:text-zinc-400'
                      if (line.startsWith('---')) className = 'text-zinc-400 dark:text-zinc-600'
                      else if (line.startsWith('name:') || line.startsWith('description:'))
                        className = 'text-cyan-600 dark:text-cyan-400'
                      else if (line.startsWith('# ')) className = 'text-zinc-800 dark:text-zinc-200 font-semibold'
                      else if (line.startsWith('## ')) className = 'text-zinc-700 dark:text-zinc-300 font-medium'

                      return (
                        <motion.span
                          key={`${currentFile}-${i}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.03 }}
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
        </div>

        {/* Right: Tool call log */}
        <div className="hidden sm:flex flex-2 min-w-0 flex-col justify-center">
          <ToolCallLog calls={TOOL_CALLS.slice(0, logCount)} />
        </div>
      </div>
    </div>
  )
}
