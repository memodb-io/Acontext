'use client'

import { useEffect, useRef, useState, useCallback, forwardRef } from 'react'
import gsap from 'gsap'
import {
  MessageSquare,
  Sparkles,
  FileText,
  User,
  Bot,
  Code,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  Pencil,
  X,
  Eye,
  RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DiffLine {
  type: '+' | '-' | ' '
  text: string
}

interface SkillEffect {
  skillId: string
  file: string
  action: 'created' | 'updated'
  diff: DiffLine[]
}

interface MessagePair {
  id: string
  user: string
  assistant: string
  userDetail: { type: string; text: string }[]
  assistantDetail: { type: string; text: string }[]
  skillEffect?: SkillEffect
}

interface Skill {
  id: string
  name: string
  files: string[]
}

// ─── Data ────────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10) // yyyy-mm-dd

const SKILLS: Skill[] = [
  { id: 'user-general-facts', name: 'user-general-facts', files: ['SKILL.md', 'work-context.md', 'tech-stack.md'] },
  { id: 'daily-logs', name: 'daily-logs', files: ['SKILL.md', `${TODAY}.md`] },
  { id: 'deployment-sop', name: 'deployment-sop', files: ['SKILL.md', 'troubleshooting.md'] },
  { id: 'api-testing', name: 'api-testing', files: ['SKILL.md', 'param-validation.md'] },
  { id: 'db-migration-sop', name: 'db-migration-sop', files: ['SKILL.md', 'safety-checks.md'] },
  { id: 'git-pr-workflows', name: 'git-pr-workflows', files: ['SKILL.md', 'ci-config.md'] },
]

const MESSAGE_PAIRS: MessagePair[] = [
  {
    id: 'p1',
    user: "I'm Gus, backend lead at MemoDB. Gener handles infra.",
    assistant: 'Got it — saved your role and team context.',
    userDetail: [{ type: 'text', text: "Hey, I'm Gus, backend lead on the MemoDB team. Gener handles all the infra and DevOps." }],
    assistantDetail: [
      { type: 'text', text: "Got it! I've saved your role and team info so I can tailor responses to your context." },
      { type: 'tool-call', text: 'get_skill("user-general-facts")' },
      { type: 'tool-result', text: '✓ Skill loaded (1 file)' },
      { type: 'tool-call', text: 'upsert_skill_file("work-context.md")' },
      { type: 'tool-result', text: '✓ Created work-context.md' },
    ],
    skillEffect: {
      skillId: 'user-general-facts', file: 'work-context.md', action: 'updated',
      diff: [
        { type: '+', text: '# Work Context' },
        { type: '+', text: '' },
        { type: '+', text: '- Gus is the backend lead at MemoDB' },
        { type: '+', text: '- Gener handles infra and DevOps' },
        { type: '+', text: '- Team uses Go API + Python CORE' },
      ],
    },
  },
  {
    id: 'p2',
    user: 'Staging deploy failed — pods crashing with OOM',
    assistant: 'Found it: memory limit was 256Mi, bumped to 512Mi. Redeployed OK.',
    userDetail: [{ type: 'text', text: 'The staging deploy just failed. Pods are crash-looping with OOMKilled. Can you figure out what happened and fix it?' }],
    assistantDetail: [
      { type: 'text', text: 'Found the issue — memory limit was set to 256Mi but usage peaked at 481Mi. Bumped to 512Mi and redeployed. All pods healthy now.' },
      { type: 'tool-call', text: 'kubectl_logs("api-staging")' },
      { type: 'tool-result', text: '✗ OOMKilled — limit 256Mi, usage peaked 481Mi' },
      { type: 'tool-call', text: 'edit_file("k8s/staging/api.yaml")' },
      { type: 'tool-result', text: '✓ Memory limit: 256Mi → 512Mi' },
      { type: 'tool-call', text: 'deploy("staging")' },
      { type: 'tool-result', text: '✓ All pods running (3/3 ready)' },
    ],
    skillEffect: {
      skillId: 'daily-logs', file: `${TODAY}.md`, action: 'updated',
      diff: [
        { type: '+', text: `# ${TODAY}` },
        { type: '+', text: '' },
        { type: '+', text: '## Fixed staging OOM crash' },
        { type: '+', text: '- API pods OOMKilled at 256Mi limit' },
        { type: '+', text: '- Bumped to 512Mi, redeployed OK' },
      ],
    },
  },
  {
    id: 'p3',
    user: 'I sent wrong params to /billing/charge — got 422',
    assistant: 'Fixed: amount was string, needs int. Also added validation rules.',
    userDetail: [{ type: 'text', text: 'I called POST /api/v1/billing/charge with { "amount": "50.00", "currency": "usd" } and got a 422. The amount should be an integer in cents — I forgot.' }],
    assistantDetail: [
      { type: 'text', text: 'The amount field needs to be an integer in cents, not a string. I retried with 5000 and it went through. Saved the validation rules as a skill.' },
      { type: 'tool-call', text: 'api_call("POST /billing/charge", {"amount": 5000, "currency": "usd"})' },
      { type: 'tool-result', text: '✓ 200 OK — charge_id: ch_9f3k2m' },
      { type: 'tool-call', text: 'create_skill("api-testing")' },
      { type: 'tool-result', text: '✓ Skill created with param-validation.md' },
    ],
    skillEffect: {
      skillId: 'api-testing', file: 'param-validation.md', action: 'created',
      diff: [
        { type: '+', text: '# Parameter Validation Rules' },
        { type: '+', text: '' },
        { type: '+', text: '## /billing/charge' },
        { type: '+', text: '- amount: integer (cents), NOT string' },
        { type: '+', text: '- currency: lowercase ISO 4217' },
        { type: '+', text: '- idempotency_key: required for retries' },
      ],
    },
  },
  {
    id: 'p4',
    user: 'I accidentally ran the migration on prod instead of staging',
    assistant: 'Rolled back in 3.2s. No data loss — schema restored.',
    userDetail: [{ type: 'text', text: "I just ran the add_billing_cols migration on prod by mistake instead of staging. The columns got added but the data backfill didn't finish. Can you roll it back?" }],
    assistantDetail: [
      { type: 'text', text: 'Rolled back successfully in 3.2s — schema is restored, no data loss. I created a safety checklist skill so this doesn\'t happen again.' },
      { type: 'tool-call', text: 'check_migration_status("prod")' },
      { type: 'tool-result', text: '✗ add_billing_cols: partial — 3 cols added, backfill at 12%' },
      { type: 'tool-call', text: 'rollback_migration("prod", "add_billing_cols")' },
      { type: 'tool-result', text: '✓ Rolled back in 3.2s — schema restored' },
    ],
    skillEffect: {
      skillId: 'db-migration-sop', file: 'safety-checks.md', action: 'created',
      diff: [
        { type: '+', text: '# Migration Safety Checks' },
        { type: '+', text: '' },
        { type: '+', text: '## Before Running' },
        { type: '+', text: '- ALWAYS confirm target env (staging vs prod)' },
        { type: '+', text: '- Require --env flag, never use default' },
        { type: '+', text: '- Take schema snapshot before applying' },
      ],
    },
  },
  {
    id: 'p5',
    user: 'CI is failing — wrong test command in the workflow',
    assistant: 'Fixed: was `npm test`, should be `go test ./...`. Pipeline green.',
    userDetail: [{ type: 'text', text: "The CI pipeline is failing on every PR. Looks like someone changed the test command to `npm test` but this is a Go repo. It should be `go test ./...`." }],
    assistantDetail: [
      { type: 'text', text: 'Found it — the test command was changed to `npm test` but this is a Go repo. Fixed to `go test ./...` and the pipeline is green now.' },
      { type: 'tool-call', text: 'edit_file(".github/workflows/ci.yml")' },
      { type: 'tool-result', text: '✓ Test command: npm test → go test ./...' },
      { type: 'tool-call', text: 'trigger_ci("main")' },
      { type: 'tool-result', text: '✓ Pipeline passed (2m 14s)' },
    ],
    skillEffect: {
      skillId: 'git-pr-workflows', file: 'ci-config.md', action: 'created',
      diff: [
        { type: '+', text: '# CI Configuration Notes' },
        { type: '+', text: '' },
        { type: '+', text: '## Test Commands' },
        { type: '+', text: '- API (Go): go test ./...' },
        { type: '+', text: '- SDK-TS: npm run test' },
        { type: '+', text: '- SDK-PY: pytest tests/' },
      ],
    },
  },
  {
    id: 'p6',
    user: 'We use Go 1.22 and prefer table-driven tests',
    assistant: 'Noted — saved to your tech stack preferences.',
    userDetail: [{ type: 'text', text: "By the way, we're on Go 1.22 and we prefer table-driven tests everywhere. Also using pgvector for embeddings." }],
    assistantDetail: [
      { type: 'text', text: 'Noted! Saved Go 1.22, table-driven tests preference, and pgvector usage to your tech stack profile.' },
      { type: 'tool-call', text: 'get_skill("user-general-facts")' },
      { type: 'tool-result', text: '✓ Skill loaded (2 files)' },
      { type: 'tool-call', text: 'upsert_skill_file("tech-stack.md")' },
      { type: 'tool-result', text: '✓ Created tech-stack.md' },
    ],
    skillEffect: {
      skillId: 'user-general-facts', file: 'tech-stack.md', action: 'updated',
      diff: [
        { type: '+', text: '# Tech Stack' },
        { type: '+', text: '' },
        { type: '+', text: '- Go 1.22 with table-driven tests' },
        { type: '+', text: '- PostgreSQL + pgvector for embeddings' },
        { type: '+', text: '- Redis for caching and queues' },
      ],
    },
  },
]

// Pre-existing skills: their first appearance in MESSAGE_PAIRS is 'updated' (not 'created')
// These show in the file tree from the start, already expanded.
const PRE_EXISTING_SKILLS = new Set<string>()
const _seenSkills = new Set<string>()
for (const pair of MESSAGE_PAIRS) {
  if (pair.skillEffect && !_seenSkills.has(pair.skillEffect.skillId)) {
    _seenSkills.add(pair.skillEffect.skillId)
    if (pair.skillEffect.action === 'updated') {
      PRE_EXISTING_SKILLS.add(pair.skillEffect.skillId)
    }
  }
}

const FILE_CONTENTS: Record<string, string> = {
  'user-general-facts/SKILL.md': '---\nname: user-general-facts\ndescription: Capture and organize general facts about the user by topic\n---\n\n# User General Facts\n\nLearn and recall general facts about the user — preferences, background, goals.',
  'user-general-facts/work-context.md': '# Work Context\n\n- Gus is the backend lead at MemoDB\n- Gener handles infra and DevOps\n- Team uses Go API + Python CORE',
  'user-general-facts/tech-stack.md': '# Tech Stack\n\n- Go 1.22 with table-driven tests\n- PostgreSQL + pgvector for embeddings\n- Redis for caching and queues',
  'daily-logs/SKILL.md': '---\nname: daily-logs\ndescription: Track daily activity logs and summaries\n---\n\n# Daily Logs\n\nRecord daily activities, progress, decisions in chronological format.\nOne file per day: yyyy-mm-dd.md',
  [`daily-logs/${TODAY}.md`]: `# ${TODAY}\n\n## Fixed staging OOM crash\n- API pods OOMKilled at 256Mi limit\n- Bumped to 512Mi, redeployed OK`,
  'deployment-sop/SKILL.md': '---\nname: deployment-sop\ndescription: Standard deployment procedures\n---\n\n# Deployment SOP\n1. Run pre-deploy checks\n2. Deploy to staging first\n3. Verify health endpoints\n4. Monitor for 15 minutes',
  'deployment-sop/troubleshooting.md': '# Deployment Troubleshooting\n\n## OOMKilled Pods\n- Check current limits in k8s/*.yaml\n- Compare against actual peak usage\n- Bump limit to 2x observed peak',
  'api-testing/SKILL.md': '---\nname: api-testing\ndescription: API testing patterns and rules\n---\n\n# API Testing Patterns\n- Run against staging first\n- Full suite: 48 endpoints\n- Check for regressions',
  'api-testing/param-validation.md': '# Parameter Validation Rules\n\n## /billing/charge\n- amount: integer (cents), NOT string\n- currency: lowercase ISO 4217\n- idempotency_key: required for retries',
  'db-migration-sop/SKILL.md': '---\nname: db-migration-sop\n---\n\n# DB Migration SOP\n- Backup schema first\n- Always run on staging\n- Monitor query performance after',
  'db-migration-sop/safety-checks.md': '# Migration Safety Checks\n\n## Before Running\n- ALWAYS confirm target env (staging vs prod)\n- Require --env flag, never use default\n- Take schema snapshot before applying',
  'git-pr-workflows/SKILL.md': '---\nname: git-pr-workflows\n---\n\n# Git PR Workflows\n- Always branch from dev\n- Use conventional commits\n- Include "Impact Areas" in PR body\n- Squash merge to main',
  'git-pr-workflows/ci-config.md': '# CI Configuration Notes\n\n## Test Commands\n- API (Go): go test ./...\n- SDK-TS: npm run test\n- SDK-PY: pytest tests/',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function PartIcon({ type }: { type: string }) {
  if (type === 'tool-call') return <Code className="w-3 h-3 text-blue-500 shrink-0" />
  if (type === 'tool-result') return <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
  return <FileText className="w-3 h-3 text-zinc-400 shrink-0" />
}

const DetailContent = forwardRef<HTMLDivElement, { pair: MessagePair }>(
  function DetailContent({ pair }, ref) {
    const innerRef = useRef<HTMLDivElement>(null)

    // Slide in from the left on mount
    useEffect(() => {
      const el = innerRef.current
      if (el) {
        gsap.fromTo(el, { x: -30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.25, ease: 'power2.out' })
      }
    }, [])

    return (
      <div
        ref={(node) => {
          (innerRef as React.MutableRefObject<HTMLDivElement | null>).current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
        }}
        className="skill-scroll flex-1 overflow-y-auto p-3 space-y-2.5"
      >
        {/* User detail */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              <User className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase">User</span>
          </div>
          <div className="pl-7 space-y-0.5">
            {pair.userDetail.map((part, i) => (
              <p key={i} className="text-[11px] sm:text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">{part.text}</p>
            ))}
          </div>
        </div>
        {/* Assistant detail */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
              <Bot className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase">Agent</span>
          </div>
          <div className="pl-7 space-y-1">
            {pair.assistantDetail.map((part, i) => (
              <div key={i} className={cn(
                'flex items-start gap-1.5 text-[10px] sm:text-xs px-2 py-1 rounded',
                part.type === 'text' ? '' : 'opacity-50',
                part.type === 'tool-call' ? 'bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40' : '',
                part.type === 'tool-result' ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40' : '',
              )}>
                {part.type !== 'text' && <PartIcon type={part.type} />}
                <span className={cn(
                  part.type === 'tool-call' ? 'font-mono text-blue-600 dark:text-blue-400'
                    : part.type === 'tool-result' ? 'font-mono text-emerald-600 dark:text-emerald-400'
                      : 'text-zinc-700 dark:text-zinc-300',
                )}>{part.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  },
)

// ─── Main Component ──────────────────────────────────────────────────────────

export function SkillMemoryDemo() {
  const containerRef = useRef<HTMLDivElement>(null)

  const [visibleSkills, setVisibleSkills] = useState<Set<string>>(new Set())
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set())
  const [selectedFile, setSelectedFile] = useState<{ skillId: string; file: string } | null>(null)
  const [activeDiff, setActiveDiff] = useState<SkillEffect | null>(null)
  const [highlightedFile, setHighlightedFile] = useState<{ skillId: string; file: string } | null>(null)
  const [detailPair, setDetailPair] = useState<MessagePair | null>(null)
  const [animDone, setAnimDone] = useState(false)
  // Index of the message pair currently being animated (-1 = none / done)
  const [focusedPairIndex, setFocusedPairIndex] = useState<number>(-1)
  // The pair index actually rendered inside the popup (lags behind focusedPairIndex for exit anim)
  const [displayedPairIndex, setDisplayedPairIndex] = useState<number>(-1)
  // How many message pairs have been fully shown (used to know which ones to dim)
  const [shownCount, setShownCount] = useState<number>(0)
  // Whether the file tree is in dimmed/focus mode (during sweep)
  const [treeDimmed, setTreeDimmed] = useState(false)

  const detailContentRef = useRef<HTMLDivElement>(null)

  // When focusedPairIndex changes: animate old content right-out, then swap to new content
  useEffect(() => {
    // First render or closing popup — just sync immediately
    if (focusedPairIndex < 0 || displayedPairIndex < 0) {
      setDisplayedPairIndex(focusedPairIndex)
      return
    }
    // Same index — no transition needed
    if (focusedPairIndex === displayedPairIndex) return

    const el = detailContentRef.current
    if (el) {
      // Slide old content out to the right
      gsap.to(el, {
        x: 30, opacity: 0, duration: 0.2, ease: 'power2.in',
        onComplete: () => {
          // Swap to new content
          setDisplayedPairIndex(focusedPairIndex)
        },
      })
    } else {
      setDisplayedPairIndex(focusedPairIndex)
    }
  }, [focusedPairIndex, displayedPairIndex])

  const previewMode = selectedFile ? 'file' : activeDiff ? 'diff' : 'empty'

  const toggleSkill = useCallback((skillId: string) => {
    setExpandedSkills((prev) => {
      const next = new Set(prev)
      if (next.has(skillId)) next.delete(skillId)
      else next.add(skillId)
      return next
    })
  }, [])

  const handleFileClick = useCallback((skillId: string, file: string) => {
    if (selectedFile?.skillId === skillId && selectedFile?.file === file) {
      setSelectedFile(null)
    } else {
      setSelectedFile({ skillId, file })
      setActiveDiff(null)
    }
  }, [selectedFile])

  const handlePairClick = useCallback((pair: MessagePair) => {
    setDetailPair((prev) => (prev?.id === pair.id ? null : pair))
  }, [])

  // Full-height sweep that washes across each column: messages → tree → preview
  const fireSweep = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    // Create a full-height gradient sweep element
    const sweep = document.createElement('div')
    sweep.style.cssText = `
      position: absolute; left: -30%; top: 0; width: 30%; height: 100%;
      pointer-events: none; z-index: 20;
      background: linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.08) 30%, rgba(139,92,246,0.15) 50%, rgba(139,92,246,0.08) 70%, transparent 100%);
    `
    container.appendChild(sweep)

    // Sweep from left to right across all 3 columns
    gsap.to(sweep, {
      left: '100%',
      duration: 1.0,
      ease: 'power1.inOut',
      onComplete: () => sweep.remove(),
    })
  }, [])

  // Build and run the GSAP animation
  const ctxRef = useRef<gsap.Context | null>(null)

  const runAnimation = useCallback(() => {
    if (!containerRef.current) return

    // Kill previous animation if replaying
    if (ctxRef.current) ctxRef.current.revert()

    // Reset all state — pre-existing skills visible + expanded from the start
    setVisibleSkills(new Set(PRE_EXISTING_SKILLS))
    setExpandedSkills(new Set())
    setSelectedFile(null)
    setActiveDiff(null)
    setHighlightedFile(null)
    setDetailPair(null)
    setAnimDone(false)
    setFocusedPairIndex(-1)
    setDisplayedPairIndex(-1)
    setShownCount(0)
    setTreeDimmed(false)

    // Reset DOM opacity for messages
    containerRef.current.querySelectorAll('[data-msg-user], [data-msg-assistant]').forEach((el) => {
      ;(el as HTMLElement).style.opacity = '0'
      ;(el as HTMLElement).style.transform = 'translateX(-10px)'
    })

    const ctx = gsap.context(() => {
      const tl = gsap.timeline()

      // Timeline: message detail (1.2s) → sweep + tree/view update (1s) → wait (1s) → next
      const STEP = 3.2 // seconds per message pair
      MESSAGE_PAIRS.forEach((pair, pi) => {
        const baseT = 0.8 + pi * STEP

        // 1) Show message detail popup
        tl.call(() => {
          setFocusedPairIndex(pi)
          setShownCount(pi)
        }, [], baseT)

        // Fade in underlying message row
        tl.call(() => {
          const uEl = containerRef.current?.querySelector(`[data-msg-user="${pi}"]`) as HTMLElement
          if (uEl) gsap.fromTo(uEl, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.5, ease: 'power3.out' })
        }, [], baseT + 0.1)
        tl.call(() => {
          const aEl = containerRef.current?.querySelector(`[data-msg-assistant="${pi}"]`) as HTMLElement
          if (aEl) gsap.fromTo(aEl, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.5, ease: 'power3.out' })
        }, [], baseT + 0.1)

        // 2) Sweep starts: simultaneously update tree (dim + highlight) + view (diff)
        if (pair.skillEffect) {
          const effect = pair.skillEffect
          tl.call(() => {
            // Tree: dim non-active, collapse others, highlight target file
            setTreeDimmed(true)
            if (effect.action === 'created') {
              setVisibleSkills((prev) => new Set(prev).add(effect.skillId))
            }
            // Only expand the active skill, collapse the rest
            setExpandedSkills(new Set([effect.skillId]))
            setHighlightedFile({ skillId: effect.skillId, file: effect.file })
            // View: show diff immediately
            setActiveDiff(effect)
            setSelectedFile(null)

            fireSweep()
          }, [], baseT + 1.2)
        }
      })

      // Animation done: clear focus, expand all, open first file
      const endTime = 0.8 + MESSAGE_PAIRS.length * STEP + 1.0
      tl.call(() => {
        setFocusedPairIndex(-1)
        setShownCount(MESSAGE_PAIRS.length)
        setActiveDiff(null)
        setHighlightedFile(null)
        setVisibleSkills(new Set(SKILLS.map((s) => s.id)))
        setExpandedSkills(new Set(SKILLS.map((s) => s.id)))
        setSelectedFile({ skillId: SKILLS[0].id, file: SKILLS[0].files[0] })
        setTreeDimmed(false)
        setAnimDone(true)
      }, [], endTime)
    }, containerRef)

    ctxRef.current = ctx
  }, [fireSweep])

  // Run on mount
  useEffect(() => {
    runAnimation()
    return () => { if (ctxRef.current) ctxRef.current.revert() }
  }, [runAnimation])

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col lg:flex-row min-h-[420px] sm:min-h-[480px] lg:h-[560px] border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl"
    >
      {/* ── Col 1: Messages (~40%) ── */}
      <div className="lg:w-[40%] min-w-0 flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-700">
        <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2 shrink-0">
          <MessageSquare className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
          <span className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400">Messages</span>
        </div>
        <div className="skill-scroll flex-1 overflow-y-auto min-h-0 flex flex-col relative">
          {MESSAGE_PAIRS.map((pair, pi) => {
            const isFocused = focusedPairIndex === pi
            const isShown = pi < shownCount || isFocused
            const isDimmed = focusedPairIndex >= 0 && !isFocused && isShown
            return (
              <div
                key={pair.id}
                onClick={() => handlePairClick(pair)}
                className={cn(
                  'flex-1 min-h-0 flex flex-col border-b border-zinc-100 dark:border-zinc-800/60 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-all duration-300',
                  isFocused ? 'bg-violet-50/40 dark:bg-violet-950/20' : '',
                  isDimmed ? 'opacity-30' : '',
                )}
              >
                {/* User */}
                <div
                  data-msg-user={pi}
                  style={{ opacity: 0 }}
                  className="flex items-center gap-2 px-3 flex-1"
                >
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                    <User className="w-2.5 h-2.5 text-white" />
                  </div>
                  <p className="text-[11px] sm:text-xs text-zinc-700 dark:text-zinc-300 truncate flex-1">{pair.user}</p>
                </div>
                {/* Assistant */}
                <div
                  data-msg-assistant={pi}
                  style={{ opacity: 0 }}
                  className="flex items-center gap-2 px-3 flex-1"
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                    <Bot className="w-2.5 h-2.5 text-white" />
                  </div>
                  <p className="text-[11px] sm:text-xs text-zinc-700 dark:text-zinc-300 truncate flex-1">{pair.assistant}</p>
                  {pair.skillEffect && <Sparkles className="w-3 h-3 text-violet-400 shrink-0" />}
                </div>
              </div>
            )
          })}

          {/* ── Focused pair detail popup (overlays the message list) ── */}
          {displayedPairIndex >= 0 && displayedPairIndex < MESSAGE_PAIRS.length && (
            <div className="absolute inset-x-2 top-2 bottom-2 z-10 flex flex-col border border-violet-200 dark:border-violet-800/60 rounded-lg overflow-hidden bg-white/95 dark:bg-zinc-950/95 backdrop-blur shadow-lg">
              {/* Inner content — GSAP handles slide-in/out */}
              <DetailContent
                key={`focus-inner-${displayedPairIndex}`}
                ref={detailContentRef}
                pair={MESSAGE_PAIRS[displayedPairIndex]}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Col 2: File Tree (~20%) ── */}
      <div className="lg:w-[20%] min-w-0 flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-700">
        <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2 shrink-0">
          <FolderOpen className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 mr-2" />
          <span className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400">Skills</span>
        </div>
        <div className="skill-scroll flex-1 overflow-y-auto min-h-0 py-1">
          {SKILLS.filter((s) => visibleSkills.has(s.id)).map((skill) => {
            const isExpanded = expandedSkills.has(skill.id)
            const isActiveSkill = highlightedFile?.skillId === skill.id
            const isDimmedSkill = treeDimmed && !isActiveSkill
            return (
              <div key={skill.id} data-skill-folder className={cn('select-none transition-opacity duration-300', isDimmedSkill ? 'opacity-30' : '')}>
                <div
                  onClick={() => toggleSkill(skill.id)}
                  className="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  {isExpanded
                    ? <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
                    : <ChevronRight className="w-3 h-3 text-zinc-400 shrink-0" />}
                  {isExpanded
                    ? <FolderOpen className="w-3 h-3 text-amber-500 shrink-0" />
                    : <Folder className="w-3 h-3 text-amber-500 shrink-0" />}
                  <span className="text-[10px] sm:text-[11px] font-mono text-zinc-700 dark:text-zinc-300 truncate">
                    {skill.name}/
                  </span>
                </div>
                <div
                  className="ml-4 grid transition-[grid-template-rows] duration-300 ease-in-out"
                  style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    {skill.files.map((file) => {
                      const isHL = highlightedFile?.skillId === skill.id && highlightedFile?.file === file
                      const isSel = selectedFile?.skillId === skill.id && selectedFile?.file === file
                      return (
                        <div
                          key={file}
                          onClick={() => handleFileClick(skill.id, file)}
                          className={cn(
                            'flex items-center gap-1 px-2 py-0.5 cursor-pointer transition-all duration-200 text-[10px] sm:text-[11px] font-mono',
                            isSel ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                              : isHL ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50',
                          )}
                        >
                          <FileText className={cn('w-3 h-3 shrink-0', isHL ? 'text-amber-500' : isSel ? 'text-violet-500' : 'text-zinc-400')} />
                          <span className="truncate">{file}</span>
                          {isHL && <Pencil className="w-2 h-2 text-amber-500 ml-auto shrink-0" />}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Col 3: Preview (~40%) ── */}
      <div className="lg:w-[40%] min-w-0 flex flex-col min-h-0">
        <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2 shrink-0">
          <Eye className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
          <span className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 truncate">
            {previewMode === 'file' && selectedFile
              ? `${selectedFile.skillId}/${selectedFile.file}`
              : previewMode === 'diff' && activeDiff
                ? `${activeDiff.skillId}/${activeDiff.file}`
                : 'Preview'}
          </span>
          {previewMode === 'diff' && activeDiff && (
            <span className={cn(
              'ml-auto text-[9px] px-1.5 py-px border font-medium shrink-0',
              activeDiff.action === 'created'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400',
            )}>
              {activeDiff.action === 'created' ? '+' : '~'} {activeDiff.action}
            </span>
          )}
          {previewMode === 'file' && (
            <button onClick={() => setSelectedFile(null)} className="ml-auto p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 shrink-0">
              <X className="w-3 h-3 text-zinc-400" />
            </button>
          )}
        </div>

        <div className="skill-scroll flex-1 overflow-y-auto min-h-0">
          {previewMode === 'diff' && activeDiff && (
            <div className="px-3 py-2 bg-zinc-100 dark:bg-zinc-950 font-mono text-[10px] sm:text-[11px] leading-relaxed min-h-full">
              {activeDiff.diff.map((line, li) => (
                <div key={li} className={cn(
                  'px-1.5',
                  line.type === '+' && 'bg-emerald-100/60 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
                  line.type === '-' && 'bg-red-100/60 text-red-500 line-through opacity-60 dark:bg-red-950/40 dark:text-red-400',
                  line.type === ' ' && 'text-zinc-400 dark:text-zinc-500',
                )}>
                  <span className="select-none mr-2 text-zinc-400 dark:text-zinc-600 inline-block w-3 text-right">
                    {line.type === ' ' ? '' : line.type}
                  </span>
                  {line.text}
                </div>
              ))}
            </div>
          )}

          {previewMode === 'file' && selectedFile && (
            <div className="p-3">
              <pre className="text-[10px] sm:text-[11px] leading-relaxed font-mono whitespace-pre-wrap">
                {(FILE_CONTENTS[`${selectedFile.skillId}/${selectedFile.file}`] ?? '').split('\n').map((line, idx) => {
                  let cls = 'text-zinc-600 dark:text-zinc-400'
                  if (line.startsWith('---')) cls = 'text-zinc-400 dark:text-zinc-600'
                  else if (/^(name|description|type):/.test(line)) cls = 'text-cyan-600 dark:text-cyan-400'
                  else if (line.startsWith('# ')) cls = 'text-zinc-800 dark:text-zinc-200 font-semibold'
                  else if (line.startsWith('## ')) cls = 'text-zinc-700 dark:text-zinc-300 font-medium'
                  return <span key={idx} className={cn('block', cls)}>{line || '\u00A0'}</span>
                })}
              </pre>
            </div>
          )}

          {previewMode === 'empty' && (
            <div className={cn(
              'flex items-center justify-center h-full p-8 transition-opacity duration-300',
              focusedPairIndex >= 0 ? 'opacity-30' : '',
            )}>
              <div className="text-center">
                <FileText className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-400 dark:text-zinc-600">Select a file to preview</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Message Detail Popup ── */}
      {detailPair && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={() => setDetailPair(null)}>
          <div
            className="w-[92%] max-w-lg max-h-[80%] border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-xl flex flex-col"
            style={{ animation: 'popIn 0.15s ease-out' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2 shrink-0">
              <MessageSquare className="w-3.5 h-3.5 text-zinc-400 mr-2" />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Message Detail</span>
              <button onClick={() => setDetailPair(null)} className="ml-auto p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800">
                <X className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            </div>
            <div className="skill-scroll flex-1 overflow-y-auto p-3 space-y-3">
              {/* User */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center"><User className="w-2.5 h-2.5 text-white" /></div>
                  <span className="text-[10px] font-medium text-zinc-500 uppercase">User</span>
                </div>
                <div className="pl-7 space-y-1">
                  {detailPair.userDetail.map((part, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[10px] sm:text-xs">
                      <PartIcon type={part.type} />
                      <span className={cn(
                        part.type === 'tool-call' ? 'font-mono text-blue-600 dark:text-blue-400'
                          : part.type === 'tool-result' ? 'font-mono text-emerald-600 dark:text-emerald-400'
                            : 'text-zinc-600 dark:text-zinc-400',
                      )}>{part.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Assistant */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center"><Bot className="w-2.5 h-2.5 text-white" /></div>
                  <span className="text-[10px] font-medium text-zinc-500 uppercase">Assistant</span>
                </div>
                <div className="pl-7 space-y-1">
                  {detailPair.assistantDetail.map((part, i) => (
                    <div key={i} className={cn(
                      'flex items-start gap-1.5 text-[10px] sm:text-xs px-2 py-1 rounded',
                      part.type === 'tool-call' ? 'bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40'
                        : part.type === 'tool-result' ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40' : '',
                    )}>
                      <PartIcon type={part.type} />
                      <span className={cn(
                        part.type === 'tool-call' ? 'font-mono text-blue-600 dark:text-blue-400'
                          : part.type === 'tool-result' ? 'font-mono text-emerald-600 dark:text-emerald-400'
                            : 'text-zinc-600 dark:text-zinc-400',
                      )}>{part.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Replay Button ── */}
      {animDone && (
        <button
          onClick={runAnimation}
          className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/80 backdrop-blur text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 hover:border-violet-300 dark:hover:border-violet-600 transition-all duration-200 shadow-sm"
        >
          <RotateCcw className="w-3 h-3" />
          Replay
        </button>
      )}

      <style jsx>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .skill-scroll::-webkit-scrollbar { width: 4px; }
        .skill-scroll::-webkit-scrollbar-track { background: transparent; }
        .skill-scroll::-webkit-scrollbar-thumb { background: rgba(161,161,170,0.3); border-radius: 4px; }
        .skill-scroll::-webkit-scrollbar-thumb:hover { background: rgba(161,161,170,0.5); }
        :global(.dark) .skill-scroll::-webkit-scrollbar-thumb { background: rgba(113,113,122,0.3); }
        :global(.dark) .skill-scroll::-webkit-scrollbar-thumb:hover { background: rgba(113,113,122,0.5); }
        .skill-scroll { scrollbar-width: thin; scrollbar-color: rgba(161,161,170,0.3) transparent; }
      `}</style>
    </div>
  )
}
