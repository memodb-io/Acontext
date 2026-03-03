'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  MessageSquare,
  ListChecks,
  CheckCircle2,
  Radio,
  Brain,
  Sparkles,
} from 'lucide-react'
import { ToolCallLog, StatusBadge, useTypingAnimation } from './shared'

type Stage =
  | 'init'
  | 'user-msg'
  | 'assistant-msg'
  | 'observer-active'
  | 'task-1'
  | 'task-2'
  | 'task-1-done'
  | 'task-2-running'
  | 'task-2-done'
  | 'attach'
  | 'learning-queued'
  | 'complete'

const TIMELINE: Record<Stage, number> = {
  'init': 0,
  'user-msg': 400,
  'assistant-msg': 1600,
  'observer-active': 3200,
  'task-1': 4500,
  'task-2': 5500,
  'task-1-done': 7000,
  'task-2-running': 8500,
  'task-2-done': 10000,
  'attach': 11000,
  'learning-queued': 12000,
  'complete': 13000,
}

const STAGES: Stage[] = Object.keys(TIMELINE) as Stage[]

const TOOL_CALLS = [
  { id: '1', message: 'Buffered 2 messages', label: 'Observer', icon: Radio },
  { id: '2', message: 'Extracted 2 tasks', label: 'Task Engine', icon: Brain },
  { id: '3', message: 'Attached to Learning Space', label: 'Learning', icon: Sparkles },
  { id: '4', message: 'Learning queued for session', label: 'Learning', icon: Sparkles },
]

const STAGE_TO_LOG: Record<Stage, number> = {
  'init': 0, 'user-msg': 0, 'assistant-msg': 0,
  'observer-active': 1, 'task-1': 2, 'task-2': 2,
  'task-1-done': 2, 'task-2-running': 2, 'task-2-done': 2,
  'attach': 3, 'learning-queued': 4, 'complete': 4,
}

interface TaskItem {
  id: string
  title: string
}

const TASKS: TaskItem[] = [
  { id: 't1', title: 'Deploy API to staging' },
  { id: 't2', title: 'Update API documentation' },
]

export function StoreDemo() {
  const [stage, setStage] = useState<Stage>('init')
  const [logCount, setLogCount] = useState(0)

  const assistantText = useTypingAnimation(
    "On it. I'll handle the deployment first, then update the docs.",
    STAGES.indexOf(stage) >= STAGES.indexOf('assistant-msg'),
    35,
  )

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

  const showUserMsg = si >= STAGES.indexOf('user-msg')
  const showAssistantMsg = si >= STAGES.indexOf('assistant-msg')
  const observerPulse = si >= STAGES.indexOf('observer-active')
  const showTask1 = si >= STAGES.indexOf('task-1')
  const showTask2 = si >= STAGES.indexOf('task-2')
  const task1Status: 'pending' | 'running' | 'done' =
    si >= STAGES.indexOf('task-1-done') ? 'done' : 'running'
  const task2Status: 'pending' | 'running' | 'done' =
    si >= STAGES.indexOf('task-2-done') ? 'done'
    : si >= STAGES.indexOf('task-2-running') ? 'running'
    : 'pending'
  const showAttach = si >= STAGES.indexOf('attach')
  const showLearningQueued = si >= STAGES.indexOf('learning-queued')

  return (
    <div className="h-full flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-4">
        <div className="flex-3 min-w-0 flex flex-col gap-3">
          {/* Conversation panel */}
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl">
            <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2">
              <MessageSquare className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
              <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">Session</span>
              {observerPulse && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="ml-auto flex items-center gap-1.5"
                >
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-1.5 h-1.5 rounded-full bg-cyan-500"
                  />
                  <span className="text-[10px] sm:text-xs text-cyan-600 dark:text-cyan-400">Observer active</span>
                </motion.div>
              )}
            </div>
            <div className="p-3 sm:p-4 space-y-3 min-h-[80px] sm:min-h-[100px]">
              <AnimatePresence>
                {showUserMsg && (
                  <motion.div
                    key="user"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
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
                  </motion.div>
                )}
                {showAssistantMsg && (
                  <motion.div
                    key="assistant"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="flex gap-2 sm:gap-3"
                  >
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] sm:text-xs font-bold bg-emerald-600 text-white">
                      A
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 mb-0.5">Agent</p>
                      <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        {assistantText}
                        {stage === 'assistant-msg' && (
                          <motion.span
                            animate={{ opacity: [1, 0] }}
                            transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                            className="text-emerald-500 ml-0.5"
                          >
                            |
                          </motion.span>
                        )}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Extracted tasks panel */}
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl">
            <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2">
              <ListChecks className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
              <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">Extracted Tasks</span>
              {si >= STAGES.indexOf('task-2-done') && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="ml-auto text-[10px] sm:text-xs bg-emerald-100/50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 border border-emerald-300/50 dark:border-emerald-500/30"
                >
                  2 done
                </motion.span>
              )}
            </div>
            <div className="p-3 sm:p-4 space-y-2 min-h-[80px] sm:min-h-[100px]">
              <AnimatePresence>
                {showTask1 && (
                  <motion.div
                    key="t1"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="flex items-center gap-2 p-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                    <span className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 flex-1 truncate">
                      {TASKS[0].title}
                    </span>
                    <StatusBadge status={task1Status} />
                  </motion.div>
                )}
                {showTask2 && (
                  <motion.div
                    key="t2"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="flex items-center gap-2 p-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                    <span className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 flex-1 truncate">
                      {TASKS[1].title}
                    </span>
                    <StatusBadge status={task2Status} />
                  </motion.div>
                )}
              </AnimatePresence>
              {!showTask1 && (
                <div className="flex items-center justify-center py-4 text-zinc-400 dark:text-zinc-600 text-xs sm:text-sm">
                  <Radio className="w-4 h-4 mr-2 opacity-50" />
                  Waiting for tasks...
                </div>
              )}

              {/* Attach to Learning Space */}
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
                  {showLearningQueued && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="ml-auto text-[10px] text-violet-400 dark:text-violet-500"
                    >
                      Learning queued
                    </motion.span>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Tool call log */}
        <div className="hidden sm:flex flex-2 min-w-0 flex-col justify-center">
          <ToolCallLog calls={TOOL_CALLS.slice(0, logCount)} />
        </div>
      </div>
    </div>
  )
}
