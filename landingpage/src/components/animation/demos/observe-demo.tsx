'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Eye,
  Radio,
  Brain,
  ListChecks,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ToolCallLog, StatusBadge } from './shared'

// ─── Timeline stages ────────────────────────────────────────────────────────

type Stage =
  | 'init'
  | 'msg-1'
  | 'msg-2'
  | 'msg-3'
  | 'observer-active'
  | 'buffered'
  | 'analyzing'
  | 'task-1'
  | 'task-2'
  | 'extracted'
  | 'task-1-running'
  | 'task-1-done'
  | 'task-2-running'
  | 'task-2-done'
  | 'summary'

const TIMELINE: Record<Stage, number> = {
  'init': 0,
  'msg-1': 400,
  'msg-2': 1000,
  'msg-3': 1600,
  'observer-active': 2200,
  'buffered': 3500,
  'analyzing': 5000,
  'task-1': 6500,
  'task-2': 8000,
  'extracted': 9500,
  'task-1-running': 10500,
  'task-1-done': 12000,
  'task-2-running': 13000,
  'task-2-done': 14500,
  'summary': 15500,
}

const STAGES: Stage[] = Object.keys(TIMELINE) as Stage[]

// ─── Tool call definitions ──────────────────────────────────────────────────

const TOOL_CALLS = [
  { id: '1', message: 'Buffered 3 messages', label: 'Observer', icon: Radio },
  { id: '2', message: 'Analyzing conversation...', label: 'Observer', icon: Brain },
  { id: '3', message: 'Extracted 2 tasks', label: 'Task Engine', icon: ListChecks },
]

const STAGE_TO_LOG: Record<Stage, number> = {
  'init': 0, 'msg-1': 0, 'msg-2': 0, 'msg-3': 0,
  'observer-active': 0, 'buffered': 1, 'analyzing': 2,
  'task-1': 2, 'task-2': 2, 'extracted': 3,
  'task-1-running': 3, 'task-1-done': 3,
  'task-2-running': 3, 'task-2-done': 3, 'summary': 3,
}

// ─── Conversation messages ──────────────────────────────────────────────────

const MESSAGES = [
  { from: 'User', text: 'Can you deploy the API to staging?' },
  { from: 'Agent', text: "I'll handle the deployment. Also updating the docs." },
  { from: 'User', text: 'Great, make sure the API docs are current.' },
]

// ─── Task definitions ───────────────────────────────────────────────────────

interface TaskItem {
  id: string
  title: string
  assignee: string
}

const TASKS: TaskItem[] = [
  { id: 't1', title: 'Deploy API to staging', assignee: 'agent-1' },
  { id: 't2', title: 'Update API documentation', assignee: 'agent-1' },
]

// ─── Main Observe Demo ──────────────────────────────────────────────────────

export function ObserveDemo() {
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
  const showMsg = (n: number) => si >= STAGES.indexOf(`msg-${n}` as Stage)
  const observerPulse = si >= STAGES.indexOf('observer-active')
  const showTask1 = si >= STAGES.indexOf('task-1')
  const showTask2 = si >= STAGES.indexOf('task-2')
  const task1Status: 'pending' | 'running' | 'done' =
    si >= STAGES.indexOf('task-1-done') ? 'done'
    : si >= STAGES.indexOf('task-1-running') ? 'running'
    : 'pending'
  const task2Status: 'pending' | 'running' | 'done' =
    si >= STAGES.indexOf('task-2-done') ? 'done'
    : si >= STAGES.indexOf('task-2-running') ? 'running'
    : 'pending'
  const showSummary = si >= STAGES.indexOf('summary')

  return (
    <div className="h-full flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-4">
        {/* Left: Conversation + Tasks */}
        <div className="flex-3 min-w-0 flex flex-col gap-3">
          {/* Conversation panel */}
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl">
            <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2">
              <MessageSquare className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
              <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">Conversation</span>
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
            <div className="p-3 sm:p-4 space-y-2.5 min-h-[100px] sm:min-h-[120px]">
              <AnimatePresence>
                {MESSAGES.map((msg, i) =>
                  showMsg(i + 1) ? (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      className="flex gap-2 sm:gap-3"
                    >
                      <div
                        className={cn(
                          'w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold shrink-0',
                          msg.from === 'User' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white',
                        )}
                      >
                        {msg.from[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 mb-0.5">{msg.from}</p>
                        <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{msg.text}</p>
                      </div>
                    </motion.div>
                  ) : null,
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Extracted tasks */}
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl">
            <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2">
              <ListChecks className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
              <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">Extracted Tasks</span>
              {showSummary && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="ml-auto text-[10px] sm:text-xs bg-cyan-100/50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 px-1.5 py-0.5 border border-cyan-300/50 dark:border-cyan-500/30"
                >
                  2 done
                </motion.span>
              )}
            </div>
            <div className="p-3 sm:p-4 space-y-2 min-h-[80px] sm:min-h-[120px]">
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
                  <Eye className="w-4 h-4 mr-2 opacity-50" />
                  Waiting for tasks...
                </div>
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
