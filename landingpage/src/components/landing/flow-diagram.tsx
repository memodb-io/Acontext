'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useInView } from 'motion/react'
import {
  Terminal,
  Brain,
  RotateCcw,
  Search,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Timeline ───────────────────────────────────────────────────────────────

type Stage =
  | 'idle'
  // Block 1: Agent runs
  | 'b1-user' | 'b1-skill' | 'b1-s1' | 'b1-s2' | 'b1-done'
  // Transfer 1→2
  | 'flow-1'
  // Block 2: Acontext learns
  | 'b2-capture' | 'b2-distill' | 'b2-sk1' | 'b2-sk2' | 'b2-done'
  // Transfer 2→3
  | 'flow-2'
  // Block 3: Skills reuse
  | 'b3-user' | 'b3-search' | 'b3-match' | 'b3-done'
  // Loop back 3→1
  | 'flow-3'

const TIMELINE: Record<Stage, number> = {
  'idle': 0,
  'b1-user': 500,
  'b1-skill': 1800,
  'b1-s1': 3000,
  'b1-s2': 3800,
  'b1-done': 4800,
  'flow-1': 5400,
  'b2-capture': 6400,
  'b2-distill': 7600,
  'b2-sk1': 9000,
  'b2-sk2': 10200,
  'b2-done': 11400,
  'flow-2': 12000,
  'b3-user': 13000,
  'b3-search': 14200,
  'b3-match': 15400,
  'b3-done': 16600,
  'flow-3': 17400,
}

const STAGES = Object.keys(TIMELINE) as Stage[]

// ─── Connector (desktop: horizontal, mobile: vertical) ─────────────────────

function Connector({
  active,
  dotActive,
  label,
  showLabel,
  gradientFrom,
  gradientTo,
  dotColor,
  chevronColor,
}: {
  active: boolean
  dotActive: boolean
  label: string
  showLabel: boolean
  gradientFrom: string
  gradientTo: string
  dotColor: string
  chevronColor: string
}) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:flex items-center shrink-0 px-1 xl:px-2 relative">
        <div className="flex items-center w-10 xl:w-14 relative">
          <div className={cn(
            'flex-1 h-px border-t border-dashed transition-colors duration-700',
            active ? 'border-transparent' : 'border-zinc-300 dark:border-zinc-700',
          )} />
          <ChevronRight className={cn(
            'w-3.5 h-3.5 shrink-0 -ml-0.5 transition-colors duration-700',
            active ? chevronColor : 'text-zinc-300 dark:text-zinc-700',
          )} />
          {active && (
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 left-0 right-4 h-0.5 rounded-full origin-left"
              style={{ background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})` }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          )}
          {/* Label — centered on the line */}
          <AnimatePresence>
            {showLabel && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute left-1/2 z-20 px-1 text-[9px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap bg-white dark:bg-zinc-950"
                style={{ top: '50%', transform: 'translate(-50%, calc(-100% - 6px))' }}
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {/* Traveling dot */}
        <AnimatePresence>
          {dotActive && (
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none z-10"
              initial={{ left: '0%', opacity: 0 }}
              animate={{ left: '75%', opacity: [0, 1, 1, 0.6] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeInOut' }}
            >
              <div className={cn('w-2 h-2 rounded-full shadow-sm', dotColor)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Mobile */}
      <div className="lg:hidden flex justify-center py-1.5 relative">
        <div className="flex items-center gap-1.5">
          <AnimatePresence>
            {showLabel && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-[9px] text-zinc-400 dark:text-zinc-500"
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
          <div className="flex flex-col items-center">
            <div className={cn(
              'w-px h-4 border-l border-dashed transition-colors duration-500',
              active ? `border-current ${chevronColor}` : 'border-zinc-300 dark:border-zinc-700',
            )} />
            <ChevronDown className={cn(
              'w-3.5 h-3.5 transition-colors duration-500 -mt-0.5',
              active ? chevronColor : 'text-zinc-300 dark:text-zinc-700',
            )} />
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export function FlowDiagram() {
  const containerRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(containerRef, { once: true, margin: '-60px' })
  const [stage, setStage] = useState<Stage>('idle')

  useEffect(() => {
    if (!isInView) return

    const timers: ReturnType<typeof setTimeout>[] = []

    for (const [s, delay] of Object.entries(TIMELINE)) {
      if (delay > 0) {
        timers.push(setTimeout(() => setStage(s as Stage), delay))
      }
    }

    return () => timers.forEach(clearTimeout)
  }, [isInView])

  const si = STAGES.indexOf(stage)
  const past = (s: Stage) => si >= STAGES.indexOf(s)

  // Block highlights
  const b1Active = past('b1-user') && !past('flow-1')
  const b2Active = past('b2-capture') && !past('flow-2')
  const b3Active = past('b3-user') && !past('flow-3')

  // Transfer animations
  const flow1Active = past('flow-1') && !past('b2-capture')
  const flow2Active = past('flow-2') && !past('b3-user')
  const flow3Active = past('flow-3')

  return (
    <section className="py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Section header */}
      <div className="w-full max-w-[768px] lg:max-w-[1200px] mx-auto mb-8 sm:mb-12">
        <div className="flex flex-col items-center gap-2 lg:gap-3">
          <h2 className="max-w-xl text-3xl sm:text-4xl lg:text-5xl leading-[1.1] text-center font-semibold text-foreground">
            How Acontext Connects
          </h2>
          <p className="max-w-xl text-sm sm:text-base lg:text-lg text-center text-muted-foreground">
            Your agent runs, Acontext captures the session, distills skills, and feeds them back — a continuous learning loop.
          </p>
        </div>
      </div>

      {/* 3-block pipeline */}
      <div ref={containerRef} className="w-full max-w-[768px] lg:max-w-[1200px] mx-auto">
        <div className="flex flex-col lg:flex-row items-stretch">

          {/* ── Block 1: AI Agents ────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <div className={cn(
              'h-full rounded-lg border overflow-hidden bg-white dark:bg-zinc-950 transition-all duration-700',
              b1Active
                ? 'border-emerald-300/60 dark:border-emerald-600/40 shadow-lg shadow-emerald-500/10'
                : past('b1-done')
                  ? 'border-emerald-200/30 dark:border-emerald-800/20'
                  : 'border-zinc-200 dark:border-zinc-800',
            )}>
              <div className={cn(
                'h-0.5 transition-all duration-700',
                past('b1-user') ? 'bg-emerald-400' : 'bg-zinc-200 dark:bg-zinc-800',
              )} />
              <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/50 flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-emerald-500/70" />
                <span className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300">AI Agents</span>
                <span className="text-[9px] text-zinc-400 dark:text-zinc-600 hidden sm:inline">Claude Code, OpenClaw, ...</span>
                {past('b1-done') && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="ml-auto">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  </motion.div>
                )}
              </div>
              <div className="p-3 space-y-2 min-h-[180px] sm:min-h-[200px]">
                <AnimatePresence>
                  {past('b1-user') && (
                    <motion.div key="b1u" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      className="flex gap-2 items-start"
                    >
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">U</div>
                      <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed pt-0.5">
                        Deploy the API to staging
                      </p>
                    </motion.div>
                  )}
                  {past('b1-skill') && (
                    <motion.div key="b1sk" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-1.5 px-2 py-1.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800/60 rounded font-mono text-[10px] text-zinc-500 dark:text-zinc-400"
                    >
                      <Search className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">get_skill(&quot;deploy-sop&quot;)</span>
                      {past('b1-s1') && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="ml-auto shrink-0">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        </motion.span>
                      )}
                    </motion.div>
                  )}
                  {past('b1-s1') && (
                    <motion.div key="b1steps" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="space-y-1.5 pt-1"
                    >
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-600 font-medium uppercase tracking-wider">Following SOP</p>
                      {['Run pre-deploy checks', 'Deploy to staging via CI'].map((step, i) => (
                        <motion.div
                          key={step}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.15 }}
                          className="flex items-center gap-1.5"
                        >
                          <CheckCircle2 className={cn(
                            'w-3 h-3 shrink-0 transition-colors',
                            (i === 0 && past('b1-s1')) || (i === 1 && past('b1-s2'))
                              ? 'text-emerald-500'
                              : 'text-zinc-300 dark:text-zinc-700',
                          )} />
                          <span className="text-[11px] text-zinc-600 dark:text-zinc-400">{step}</span>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* ── Connector 1→2 ─────────────────────────────────────────────── */}
          <Connector
            active={past('flow-1')}
            dotActive={flow1Active}
            label="session data"
            showLabel={past('flow-1') && !past('b2-done')}
            gradientFrom="#34d399"
            gradientTo="#a78bfa"
            dotColor="bg-emerald-400 shadow-emerald-400/50"
            chevronColor="text-violet-400"
          />

          {/* ── Block 2: Acontext ─────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <div className={cn(
              'h-full rounded-lg border overflow-hidden bg-white dark:bg-zinc-950 transition-all duration-700',
              b2Active
                ? 'border-violet-300/60 dark:border-violet-600/40 shadow-lg shadow-violet-500/10'
                : past('b2-done')
                  ? 'border-violet-200/30 dark:border-violet-800/20'
                  : 'border-zinc-200 dark:border-zinc-800',
            )}>
              <div className={cn(
                'h-0.5 transition-all duration-700',
                past('b2-capture') ? 'bg-violet-400' : 'bg-zinc-200 dark:bg-zinc-800',
              )} />
              <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/50 flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-violet-500/70" />
                <span className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300">Acontext</span>
                {past('b2-done') && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="ml-auto">
                    <Check className="w-3.5 h-3.5 text-violet-500" />
                  </motion.div>
                )}
              </div>
              <div className="p-3 space-y-2 min-h-[180px] sm:min-h-[200px]">
                <AnimatePresence>
                  {past('b2-capture') && (
                    <motion.div key="b2cap" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-1.5 px-2 py-1.5 bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200/50 dark:border-cyan-800/30 rounded"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0"
                      />
                      <span className="text-[10px] sm:text-xs text-cyan-600 dark:text-cyan-400">Session captured — buffering</span>
                    </motion.div>
                  )}
                  {past('b2-distill') && (
                    <motion.div key="b2dist" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-1.5 px-2 py-1"
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      >
                        <Brain className="w-3 h-3 text-violet-400 dark:text-violet-500" />
                      </motion.div>
                      <span className="text-[10px] sm:text-xs text-violet-500 dark:text-violet-400">Distilling outcomes...</span>
                    </motion.div>
                  )}
                  {past('b2-sk1') && (
                    <motion.div key="b2s1" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-violet-300/50 dark:border-violet-700/50 bg-violet-50/30 dark:bg-violet-950/20"
                    >
                      <Sparkles className="w-3 h-3 text-violet-500 shrink-0" />
                      <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-mono truncate flex-1">deployment-sop</span>
                      <span className="text-[10px] text-violet-500 dark:text-violet-400 font-medium shrink-0">UPDATED</span>
                    </motion.div>
                  )}
                  {past('b2-sk2') && (
                    <motion.div key="b2s2" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-emerald-300/50 dark:border-emerald-700/50 bg-emerald-50/30 dark:bg-emerald-950/20"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-mono truncate flex-1">staging-checklist</span>
                      <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-medium shrink-0">NEW</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* ── Connector 2→3 ─────────────────────────────────────────────── */}
          <Connector
            active={past('flow-2')}
            dotActive={flow2Active}
            label="skills"
            showLabel={past('flow-2') && !past('b3-done')}
            gradientFrom="#a78bfa"
            gradientTo="#22d3ee"
            dotColor="bg-violet-400 shadow-violet-400/50"
            chevronColor="text-cyan-400"
          />

          {/* ── Block 3: Skills Reuse ──────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <div className={cn(
              'h-full rounded-lg border overflow-hidden bg-white dark:bg-zinc-950 transition-all duration-700',
              b3Active
                ? 'border-cyan-300/60 dark:border-cyan-600/40 shadow-lg shadow-cyan-500/10'
                : past('b3-done')
                  ? 'border-cyan-200/30 dark:border-cyan-800/20'
                  : 'border-zinc-200 dark:border-zinc-800',
            )}>
              <div className={cn(
                'h-0.5 transition-all duration-700',
                past('b3-user') ? 'bg-cyan-400' : 'bg-zinc-200 dark:bg-zinc-800',
              )} />
              <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/50 flex items-center gap-2">
                <RotateCcw className="w-3.5 h-3.5 text-cyan-500/70" />
                <span className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300">Skills Reuse</span>
                {past('b3-done') && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="ml-auto">
                    <Check className="w-3.5 h-3.5 text-cyan-500" />
                  </motion.div>
                )}
              </div>
              <div className="p-3 space-y-2 min-h-[180px] sm:min-h-[200px]">
                <AnimatePresence>
                  {past('b3-user') && (
                    <motion.div key="b3u" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      className="flex gap-2 items-start"
                    >
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">U</div>
                      <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed pt-0.5">
                        Deploy the backend to staging again
                      </p>
                    </motion.div>
                  )}
                  {past('b3-search') && (
                    <motion.div key="b3sr" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-1.5 px-2 py-1.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800/60 rounded font-mono text-[10px] text-zinc-500 dark:text-zinc-400"
                    >
                      <Search className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">search_skills(&quot;staging&quot;)</span>
                      {past('b3-match') && (
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="ml-auto text-emerald-500 text-[10px] shrink-0"
                        >
                          1 match
                        </motion.span>
                      )}
                    </motion.div>
                  )}
                  {past('b3-match') && (
                    <motion.div key="b3m" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-violet-300/40 dark:border-violet-700/40 bg-violet-50/20 dark:bg-violet-950/10"
                    >
                      <Sparkles className="w-3 h-3 text-violet-500 shrink-0" />
                      <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-mono truncate">deployment-sop</span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono shrink-0 ml-auto">0.94</span>
                    </motion.div>
                  )}
                  {past('b3-done') && (
                    <motion.div key="b3d" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-emerald-300/50 dark:border-emerald-700/40 bg-emerald-50/30 dark:bg-emerald-950/20"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Skill applied — task done</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

        </div>

        {/* ── Loop-back arrow: Block 3 → Block 1 ─────────────────────────── */}
        {/* Desktop: curved path below the 3 blocks */}
        <div className="hidden lg:block relative h-12 mt-1">
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 1000 48"
            preserveAspectRatio="none"
            fill="none"
          >
            {/* Dashed baseline (always visible) */}
            <path
              d="M 850 0 L 850 20 Q 850 40 800 40 L 200 40 Q 150 40 150 20 L 150 0"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="6 4"
              className="text-zinc-300 dark:text-zinc-700"
            />
            {/* Animated gradient fill */}
            {flow3Active && (
              <>
                <defs>
                  <linearGradient id="loop-grad" x1="100%" y1="0%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M 850 0 L 850 20 Q 850 40 800 40 L 200 40 Q 150 40 150 20 L 150 0"
                  stroke="url(#loop-grad)"
                  strokeWidth="2.5"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.2, ease: 'easeInOut' }}
                />
              </>
            )}
          </svg>
          {/* Left arrowhead (points up into Block 1) */}
          <div className={cn(
            'absolute left-[15%] -top-1.5 -translate-x-1/2 transition-colors duration-700',
            flow3Active ? 'text-emerald-400' : 'text-zinc-300 dark:text-zinc-700',
          )}>
            <ChevronUp className="w-4 h-4" />
          </div>
          {/* Label centered on the bottom of the curve */}
          <AnimatePresence>
            {flow3Active && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute bottom-0 left-1/2 -translate-x-1/2 px-1.5 text-[9px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap bg-white dark:bg-zinc-950"
                style={{ transform: 'translate(-50%, 50%)' }}
              >
                next run
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile: simple arrow back up */}
        <div className="lg:hidden flex justify-center py-1.5">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              'text-[9px] transition-colors duration-500',
              flow3Active ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-300 dark:text-zinc-700',
            )}>
              next run
            </span>
            <div className="flex flex-col items-center">
              <ChevronUp className={cn(
                'w-3.5 h-3.5 -mb-0.5 transition-colors duration-500',
                flow3Active ? 'text-emerald-400' : 'text-zinc-300 dark:text-zinc-700',
              )} />
              <div className={cn(
                'w-px h-4 border-l border-dashed transition-colors duration-500',
                flow3Active ? 'border-emerald-400/60' : 'border-zinc-300 dark:border-zinc-700',
              )} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
