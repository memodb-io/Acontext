'use client'

import { ArrowRight } from 'lucide-react'
import { HighlightedCode } from '@/components/ui/highlighted-code'

const steps = [
  {
    number: '1',
    title: 'Agent Runs',
    description: 'Your agent processes tasks through Acontext sessions.',
    color: 'bg-indigo-500',
  },
  {
    number: '2',
    title: 'Data Collected',
    description: 'Messages, tool calls, and metadata are captured automatically.',
    color: 'bg-amber-500',
  },
  {
    number: '3',
    title: 'Tasks Extracted',
    description: 'AI pipeline identifies tasks, outcomes, and patterns.',
    color: 'bg-violet-500',
  },
  {
    number: '4',
    title: 'Insights Surfaced',
    description: 'Dashboard shows analytics, traces, and task status.',
    color: 'bg-emerald-500',
  },
]

const observeExample = `from acontext import AcontextClient

client = AcontextClient()

# Sessions are automatically tracked
session = client.sessions.create(user="alice")

# Store messages — observability is automatic
client.sessions.store_message(
    session.id,
    blob={"role": "user", "content": "Deploy v2.1"}
)

# Tasks are extracted automatically
# View them in the dashboard or via API
tasks = client.sessions.get_tasks(session.id)
for task in tasks.items:
    print(task.data.description, task.status)`

const dashboardExample = `# Get token usage for a session
token_counts = client.sessions.get_token_counts(
    session.id
)
print(f"Tokens: {token_counts}")

# Get extracted tasks for a session
tasks = client.sessions.get_tasks(
    session.id
)
for task in tasks.items:
    print(f"{task.data.description}: {task.status}")

# Check message observing status
status = client.sessions.messages_observing_status(
    session.id
)
print(f"Observed: {status}")`

export function HowItWorks() {
  return (
    <section className="w-full py-20">
      <div className="w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] mx-auto px-4">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">How It Works</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Zero-config observability — just use Acontext sessions, and insights appear automatically.
          </p>
        </div>

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-500/60" />
              <span className="text-sm font-medium text-foreground font-mono">observe.py</span>
            </div>
            <div className="py-4 overflow-x-auto flex-1">
              <div className="px-4 min-w-fit">
                <HighlightedCode code={observeExample} language="python" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              <span className="text-sm font-medium text-foreground font-mono">analytics.py</span>
            </div>
            <div className="py-4 overflow-x-auto flex-1">
              <div className="px-4 min-w-fit">
                <HighlightedCode code={dashboardExample} language="python" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
