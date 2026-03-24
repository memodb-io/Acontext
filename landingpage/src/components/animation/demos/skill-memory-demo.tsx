'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
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

const SKILLS: Skill[] = [
  { id: 'deployment-sop', name: 'deployment-sop', files: ['SKILL.md', 'staging-steps.md', 'rollback.md'] },
  { id: 'api-testing', name: 'api-testing', files: ['SKILL.md', 'smoke-tests.md'] },
  { id: 'sdk-doc-patterns', name: 'sdk-doc-patterns', files: ['SKILL.md', 'ts-patterns.md', 'py-patterns.md'] },
  { id: 'git-pr-workflows', name: 'git-pr-workflows', files: ['SKILL.md', 'pr-template.md'] },
  { id: 'db-migration-sop', name: 'db-migration-sop', files: ['SKILL.md', 'migration-steps.md'] },
]

const MESSAGE_PAIRS: MessagePair[] = [
  {
    id: 'p1',
    user: 'Deploy the API to staging environment',
    assistant: 'Deployed to staging. All 12 health checks pass.',
    userDetail: [{ type: 'text', text: 'Deploy the API to staging and make sure all health checks pass.' }],
    assistantDetail: [
      { type: 'tool-call', text: 'get_skill("deployment-sop")' },
      { type: 'tool-result', text: '✓ Skill loaded (3 files)' },
      { type: 'tool-call', text: 'deploy("staging")' },
      { type: 'tool-result', text: '✓ 12/12 health checks passed' },
    ],
    skillEffect: {
      skillId: 'deployment-sop', file: 'SKILL.md', action: 'updated',
      diff: [
        { type: ' ', text: '# Deployment SOP' },
        { type: ' ', text: '1. Run pre-deploy checks' },
        { type: '+', text: '3. Verify all 12 health endpoints' },
        { type: '-', text: '3. Verify health endpoints' },
        { type: ' ', text: '4. Monitor for 15 minutes' },
      ],
    },
  },
  {
    id: 'p2',
    user: 'Run the full smoke test suite',
    assistant: 'All 48 smoke tests passed. No regressions.',
    userDetail: [{ type: 'text', text: 'Run the complete API smoke tests against staging.' }],
    assistantDetail: [
      { type: 'tool-call', text: 'run_smoke_tests("staging")' },
      { type: 'tool-result', text: '✓ 48/48 tests passed (34.2s)' },
    ],
    skillEffect: {
      skillId: 'api-testing', file: 'SKILL.md', action: 'created',
      diff: [
        { type: '+', text: '---' },
        { type: '+', text: 'name: api-testing' },
        { type: '+', text: '---' },
        { type: '+', text: '# API Testing Patterns' },
        { type: '+', text: '- Run against staging first' },
        { type: '+', text: '- Full suite: 48 endpoints' },
      ],
    },
  },
  {
    id: 'p3',
    user: 'Update the SDK docs for v2.1',
    assistant: 'SDK docs updated with migration guide.',
    userDetail: [{ type: 'text', text: 'Update TypeScript and Python SDK docs for v2.1 with migration guide.' }],
    assistantDetail: [
      { type: 'tool-call', text: 'get_skill("sdk-doc-patterns")' },
      { type: 'tool-result', text: '✓ Skill loaded (3 files)' },
      { type: 'tool-call', text: 'edit_file("sdk-ts/MIGRATION.md")' },
      { type: 'tool-result', text: '✓ Created migration guide' },
    ],
    skillEffect: {
      skillId: 'sdk-doc-patterns', file: 'SKILL.md', action: 'updated',
      diff: [
        { type: ' ', text: '# SDK Doc Patterns' },
        { type: '+', text: '- Always update CHANGELOG.md' },
        { type: '+', text: '- Include migration guide' },
        { type: ' ', text: '- Mirror structure across langs' },
      ],
    },
  },
  {
    id: 'p4',
    user: 'Create a PR and merge to dev',
    assistant: 'PR #247 merged to dev.',
    userDetail: [{ type: 'text', text: 'Create a pull request with all changes and merge to dev.' }],
    assistantDetail: [
      { type: 'tool-call', text: 'get_skill("git-pr-workflows")' },
      { type: 'tool-result', text: '✓ Skill loaded (2 files)' },
      { type: 'tool-call', text: 'gh_pr_merge("#247")' },
      { type: 'tool-result', text: '✓ PR #247 merged to dev' },
    ],
    skillEffect: {
      skillId: 'git-pr-workflows', file: 'SKILL.md', action: 'updated',
      diff: [
        { type: ' ', text: '# Git PR Workflows' },
        { type: '+', text: '- Include "Impact Areas" in PR body' },
        { type: ' ', text: '- Squash merge to main' },
      ],
    },
  },
  {
    id: 'p5',
    user: 'Run the pending DB migration',
    assistant: 'Migration applied. Performance +40%.',
    userDetail: [{ type: 'text', text: 'Apply the pending migration for the new users table index.' }],
    assistantDetail: [
      { type: 'tool-call', text: 'run_migration("add_users_idx")' },
      { type: 'tool-result', text: '✓ Migration applied in 2.3s' },
    ],
    skillEffect: {
      skillId: 'db-migration-sop', file: 'SKILL.md', action: 'created',
      diff: [
        { type: '+', text: '---' },
        { type: '+', text: 'name: db-migration-sop' },
        { type: '+', text: '---' },
        { type: '+', text: '# DB Migration SOP' },
        { type: '+', text: '- Backup schema first' },
        { type: '+', text: '- Always run on staging' },
      ],
    },
  },
  {
    id: 'p6',
    user: 'Verify the rollback procedure',
    assistant: 'Rollback tested. Recovery in 4.1s.',
    userDetail: [{ type: 'text', text: 'Test that the rollback procedure works.' }],
    assistantDetail: [
      { type: 'tool-call', text: 'test_rollback("add_users_idx")' },
      { type: 'tool-result', text: '✓ Rollback completed in 4.1s' },
    ],
    skillEffect: {
      skillId: 'db-migration-sop', file: 'migration-steps.md', action: 'updated',
      diff: [
        { type: ' ', text: '# Migration Steps' },
        { type: '+', text: '3. Test rollback procedure' },
        { type: '+', text: '4. Verify schema integrity' },
        { type: ' ', text: '5. Run performance checks' },
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
  'deployment-sop/SKILL.md': '---\nname: deployment-sop\ndescription: Standard operating procedure\n---\n\n# Deployment SOP\n1. Run pre-deploy checks\n2. Deploy to staging first\n3. Verify all 12 health endpoints\n4. Monitor for 15 minutes',
  'deployment-sop/staging-steps.md': '# Staging Deployment\n\n## Pre-checks\n- All tests passing\n- No pending migrations\n\n## Steps\n1. Tag release branch\n2. Deploy via CI pipeline\n3. Run smoke tests',
  'deployment-sop/rollback.md': '# Rollback Procedure\n\n## When to Rollback\n- Health check failures > 3\n- Error rate exceeds 1%\n\n## Steps\n1. Revert to previous tag\n2. Trigger CI rollback',
  'api-testing/SKILL.md': '---\nname: api-testing\ndescription: API endpoint testing\n---\n\n# API Testing Patterns\n- Run against staging first\n- Full suite: 48 endpoints\n- Check for regressions',
  'api-testing/smoke-tests.md': '# Smoke Tests\n\n## Endpoints\n- GET /health -> 200\n- GET /api/v1/status -> 200\n- POST /api/v1/ping -> 200',
  'sdk-doc-patterns/SKILL.md': '---\nname: sdk-doc-patterns\n---\n\n# SDK Doc Patterns\n- Keep README.md as entry point\n- Always update CHANGELOG.md\n- Include migration guide\n- Mirror structure across langs',
  'sdk-doc-patterns/ts-patterns.md': '# TypeScript SDK Patterns\n\n## Code Examples\nAlways include import statements\nUse async/await, not .then()',
  'sdk-doc-patterns/py-patterns.md': '# Python SDK Patterns\n\n## Code Examples\nUse type hints in all examples\nInclude both sync and async',
  'git-pr-workflows/SKILL.md': '---\nname: git-pr-workflows\n---\n\n# Git PR Workflows\n- Always branch from dev\n- Use conventional commits\n- Include "Impact Areas" in PR body\n- Squash merge to main',
  'git-pr-workflows/pr-template.md': '# PR Template\n\n## Summary\n## Impact Areas\n## Test Plan\n- [ ] Unit tests pass\n- [ ] E2E tests pass',
  'db-migration-sop/SKILL.md': '---\nname: db-migration-sop\n---\n\n# DB Migration SOP\n- Backup schema first\n- Always run on staging\n- Monitor query performance after',
  'db-migration-sop/migration-steps.md': '# Migration Steps\n\n1. Backup current schema\n2. Apply migration\n3. Test rollback procedure\n4. Verify schema integrity\n5. Run performance checks',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function PartIcon({ type }: { type: string }) {
  if (type === 'tool-call') return <Code className="w-3 h-3 text-blue-500 shrink-0" />
  if (type === 'tool-result') return <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
  return <FileText className="w-3 h-3 text-zinc-400 shrink-0" />
}

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
    setExpandedSkills(new Set(PRE_EXISTING_SKILLS))
    setSelectedFile(null)
    setActiveDiff(null)
    setHighlightedFile(null)
    setDetailPair(null)
    setAnimDone(false)

    // Reset DOM opacity for messages
    containerRef.current.querySelectorAll('[data-msg-user], [data-msg-assistant]').forEach((el) => {
      ;(el as HTMLElement).style.opacity = '0'
      ;(el as HTMLElement).style.transform = 'translateX(-10px)'
    })

    const ctx = gsap.context(() => {
      const tl = gsap.timeline()

      // Messages appear one by one, slower pacing
      MESSAGE_PAIRS.forEach((pair, pi) => {
        const baseT = 0.5 + pi * 1.5

        // User message
        tl.call(() => {
          const el = containerRef.current?.querySelector(`[data-msg-user="${pi}"]`) as HTMLElement
          if (el) gsap.fromTo(el, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.4, ease: 'power3.out' })
        }, [], baseT)

        // Assistant message
        tl.call(() => {
          const el = containerRef.current?.querySelector(`[data-msg-assistant="${pi}"]`) as HTMLElement
          if (el) gsap.fromTo(el, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.4, ease: 'power3.out' })
        }, [], baseT + 0.5)

        // After both messages: sweep + skill effect
        if (pair.skillEffect) {
          const effect = pair.skillEffect
          tl.call(() => {
            fireSweep()

            // Skill effect triggers when sweep reaches the middle columns
            setTimeout(() => {
              // New skill: add to tree. Existing skill: already visible.
              if (effect.action === 'created') {
                setVisibleSkills((prev) => new Set(prev).add(effect.skillId))
              }
              setExpandedSkills((prev) => new Set(prev).add(effect.skillId))
              setHighlightedFile({ skillId: effect.skillId, file: effect.file })
              setActiveDiff(effect)
              setSelectedFile(null)
            }, 400)
          }, [], baseT + 0.9)
        }
      })

      // Animation done: clear diff, expand all, open first file
      const endTime = 0.5 + MESSAGE_PAIRS.length * 1.5 + 1.2
      tl.call(() => {
        setActiveDiff(null)
        setHighlightedFile(null)
        setVisibleSkills(new Set(SKILLS.map((s) => s.id)))
        setExpandedSkills(new Set(SKILLS.map((s) => s.id)))
        setSelectedFile({ skillId: SKILLS[0].id, file: SKILLS[0].files[0] })
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
        <div className="skill-scroll flex-1 overflow-y-auto min-h-0 flex flex-col">
          {MESSAGE_PAIRS.map((pair, pi) => (
            <div
              key={pair.id}
              onClick={() => handlePairClick(pair)}
              className="flex-1 min-h-0 flex flex-col border-b border-zinc-100 dark:border-zinc-800/60 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
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
          ))}
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
            return (
              <div key={skill.id} data-skill-folder className="select-none">
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
                {isExpanded && (
                  <div className="ml-4">
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
                )}
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
            <div className="px-3 py-2 bg-zinc-950 dark:bg-black font-mono text-[10px] sm:text-[11px] leading-relaxed min-h-full">
              {activeDiff.diff.map((line, li) => (
                <div key={li} className={cn(
                  'px-1.5',
                  line.type === '+' && 'bg-emerald-950/40 text-emerald-400',
                  line.type === '-' && 'bg-red-950/40 text-red-400 line-through opacity-60',
                  line.type === ' ' && 'text-zinc-500',
                )}>
                  <span className="select-none mr-2 text-zinc-600 inline-block w-3 text-right">
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
            <div className="flex items-center justify-center h-full p-8">
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
