'use client'

import { ArrowRight } from 'lucide-react'
import { HighlightedCode } from '@/components/ui/highlighted-code'

const steps = [
  {
    number: '1',
    title: 'Task Completes',
    description: 'An agent session finishes a task successfully.',
    color: 'bg-blue-500',
  },
  {
    number: '2',
    title: 'Distillation',
    description: 'The learning pipeline extracts knowledge from the session.',
    color: 'bg-violet-500',
  },
  {
    number: '3',
    title: 'Skill Agent',
    description: 'A specialized agent decides which skills to update and how.',
    color: 'bg-pink-500',
  },
  {
    number: '4',
    title: 'Skills Updated',
    description: 'Skill files are created or updated as plain markdown.',
    color: 'bg-emerald-500',
  },
]

const skillFileExample = `# Daily Logs
> description: Records daily activities and decisions
> naming: YYYY-MM-DD.md
> retention: 30 days

## Guidelines
- One entry per significant event
- Include outcomes and decisions
- Reference related tasks by ID`

const dataFileExample = `## Deployed v2.1 to staging
- Fixed auth timeout bug (issue #342)
- Updated rate limit config to 1000 req/min
- User confirmed the fix resolves their issue

## Reviewed PR #89
- Approved with minor suggestions
- Performance improvement: 40% faster queries`

export function HowItWorks() {
  return (
    <section className="w-full py-20">
      <div className="w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] mx-auto px-4">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">How It Works</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            From completed tasks to reusable skill files — fully automatic.
          </p>
        </div>

        {/* Flow steps */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-0 mb-16">
          {steps.map((step, i) => (
            <div key={step.number} className="flex items-center">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card min-w-[200px]">
                <div
                  className={`w-8 h-8 rounded-full ${step.color} flex items-center justify-center text-white text-sm font-bold shrink-0`}
                >
                  {step.number}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{step.title}</div>
                  <div className="text-xs text-muted-foreground">{step.description}</div>
                </div>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="h-5 w-5 text-muted-foreground/40 mx-2 hidden md:block shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Skill file examples */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-pink-500/60" />
              <span className="text-sm font-medium text-foreground font-mono">SKILL.md</span>
            </div>
            <div className="py-4 overflow-x-auto flex-1">
              <div className="px-4 min-w-fit">
                <HighlightedCode code={skillFileExample} language="markdown" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              <span className="text-sm font-medium text-foreground font-mono">2025-02-22.md</span>
            </div>
            <div className="py-4 overflow-x-auto flex-1">
              <div className="px-4 min-w-fit">
                <HighlightedCode code={dataFileExample} language="markdown" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
