'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Sparkles,
  Check,
  BookOpen,
  Brain,
  CheckCircle2,
  RefreshCw,
  FileText,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ToolCallLog } from './shared'

// ─── Timeline stages ────────────────────────────────────────────────────────

type Stage =
  | 'init'
  | 'show-task'
  | 'task-done'
  | 'attach'
  | 'logged-attach'
  | 'distilling'
  | 'logged-distill'
  | 'skill-update'
  | 'logged-update'
  | 'skill-create'
  | 'logged-create'
  | 'complete'

const TIMELINE: Record<Stage, number> = {
  'init': 0,
  'show-task': 500,
  'task-done': 1500,
  'attach': 2500,
  'logged-attach': 3200,
  'distilling': 4000,
  'logged-distill': 5200,
  'skill-update': 6200,
  'logged-update': 7000,
  'skill-create': 8000,
  'logged-create': 8800,
  'complete': 10000,
}

const STAGES: Stage[] = Object.keys(TIMELINE) as Stage[]

// ─── Tool calls ─────────────────────────────────────────────────────────────

const TOOL_CALLS = [
  { id: '1', message: 'Session attached to Learning Space', label: 'Learning', icon: Sparkles },
  { id: '2', message: 'Distilling task outcomes...', label: 'Learning', icon: Brain },
  { id: '3', message: 'Updated skill: deployment-sop', label: 'Skills', icon: RefreshCw },
  { id: '4', message: 'Created skill: api-docs-checklist', label: 'Skills', icon: Plus },
]

const STAGE_TO_LOG: Record<Stage, number> = {
  'init': 0, 'show-task': 0, 'task-done': 0,
  'attach': 0, 'logged-attach': 1,
  'distilling': 1, 'logged-distill': 2,
  'skill-update': 2, 'logged-update': 3,
  'skill-create': 3, 'logged-create': 4,
  'complete': 4,
}

// ─── Skill entries ──────────────────────────────────────────────────────────

interface SkillEntry {
  name: string
  status: 'default' | 'updated' | 'new'
  entries: number
}

// ─── Main Skills Demo ───────────────────────────────────────────────────────

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
  const showTask = si >= STAGES.indexOf('show-task')
  const taskDone = si >= STAGES.indexOf('task-done')
  const showAttach = si >= STAGES.indexOf('attach')
  const isDistilling = si >= STAGES.indexOf('distilling')
  const showSkillUpdate = si >= STAGES.indexOf('skill-update')
  const showSkillCreate = si >= STAGES.indexOf('skill-create')
  const isComplete = si >= STAGES.indexOf('complete')

  const skills: SkillEntry[] = [
    { name: 'daily-logs', status: 'default', entries: 12 },
    { name: 'user-general-facts', status: 'default', entries: 8 },
    {
      name: 'deployment-sop',
      status: showSkillUpdate ? 'updated' : 'default',
      entries: showSkillUpdate ? 6 : 5,
    },
    ...(showSkillCreate
      ? [{ name: 'api-docs-checklist', status: 'new' as const, entries: 1 }]
      : []),
  ]

  return (
    <div className="h-full flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-4">
        {/* Left: Session + Learning Space */}
        <div className="flex-3 min-w-0 flex flex-col gap-3">
          {/* Completed Task */}
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl">
            <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
              <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                Session Task
              </span>
              {taskDone && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="ml-auto flex items-center gap-1.5"
                >
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400">
                    Success
                  </span>
                </motion.div>
              )}
            </div>
            <div className="p-3 sm:p-4">
              <AnimatePresence>
                {showTask && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center gap-2 p-2 border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/30 rounded">
                      <FileText className="w-3 h-3 text-zinc-400 dark:text-zinc-500 shrink-0" />
                      <span className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 flex-1">
                        Deploy API to staging
                      </span>
                      <motion.span
                        key={taskDone ? 'done' : 'running'}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={cn(
                          'text-[10px] sm:text-xs px-1.5 py-0.5 border font-mono uppercase',
                          taskDone
                            ? 'bg-emerald-100/50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700'
                            : 'bg-blue-100/50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700',
                        )}
                      >
                        {taskDone ? 'success' : 'running'}
                      </motion.span>
                    </div>
                    <div className="flex items-center gap-2 p-2 border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/30 rounded">
                      <FileText className="w-3 h-3 text-zinc-400 dark:text-zinc-500 shrink-0" />
                      <span className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 flex-1">
                        Update API documentation
                      </span>
                      <motion.span
                        key={taskDone ? 'done2' : 'pending'}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={cn(
                          'text-[10px] sm:text-xs px-1.5 py-0.5 border font-mono uppercase',
                          taskDone
                            ? 'bg-emerald-100/50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700',
                        )}
                      >
                        {taskDone ? 'success' : 'pending'}
                      </motion.span>
                    </div>

                    {/* Attach indicator */}
                    {showAttach && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="mt-2 flex items-center gap-2 px-2 py-1.5 border border-violet-300/50 dark:border-violet-700/50 bg-violet-100/20 dark:bg-violet-950/20 rounded"
                      >
                        <Sparkles className="w-3 h-3 text-violet-500 dark:text-violet-400" />
                        <span className="text-[10px] sm:text-xs text-violet-600 dark:text-violet-400">
                          Attached to Learning Space
                        </span>
                        {isDistilling && (
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
                            <span className="text-[10px] text-violet-400 dark:text-violet-500">
                              {isComplete ? 'Done' : 'Distilling...'}
                            </span>
                          </motion.div>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Learning Space */}
          <AnimatePresence>
            {showAttach && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl"
              >
                <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2">
                  <BookOpen className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
                  <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                    Learning Space
                  </span>
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
                <div className="p-3 sm:p-4 space-y-1.5">
                  {skills.map((skill, i) => (
                    <motion.div
                      key={skill.name}
                      initial={
                        skill.status === 'new' ? { opacity: 0, x: -8 } : { opacity: 1, x: 0 }
                      }
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
                        {skill.entries} entries
                      </span>
                    </motion.div>
                  ))}
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
