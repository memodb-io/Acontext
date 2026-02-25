'use client'

import { ListChecks, Route, BarChart3 } from 'lucide-react'

const features = [
  {
    icon: ListChecks,
    title: 'Agent Tasks',
    description:
      'Automatically extract and track tasks from agent sessions. See what your agents committed to do, what they completed, and what they missed.',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    example: {
      title: 'Extracted tasks',
      lines: [
        '{ "task": "Fix auth timeout bug",',
        '  "status": "completed",',
        '  "session_id": "sess_abc123",',
        '  "confidence": 0.95 }',
        '',
        '{ "task": "Update rate limit config",',
        '  "status": "in_progress",',
        '  "session_id": "sess_abc123" }',
      ],
    },
  },
  {
    icon: Route,
    title: 'Traces',
    description:
      'OpenTelemetry-compatible distributed tracing across your agent pipeline. Follow requests from API call through LLM invocation to tool execution.',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    example: {
      title: 'Trace spans',
      lines: [
        'api.request     ─── 245ms',
        '  session.get   ─── 12ms',
        '  llm.invoke    ─── 180ms',
        '  tool.execute  ─── 45ms',
        '  session.store ─── 8ms',
      ],
    },
  },
  {
    icon: BarChart3,
    title: 'Session Analytics',
    description:
      'Track token usage, session duration, and message volume across projects. Identify patterns and optimize your agent workflows.',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    example: {
      title: 'Session metrics',
      lines: [
        'Total sessions:     1,284',
        'Avg tokens/session: 12,450',
        'Avg duration:       3.2 min',
        'Success rate:       94.7%',
      ],
    },
  },
]

export function Features() {
  return (
    <section className="w-full py-20">
      <div className="w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] mx-auto px-4">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold">What You Can Observe</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Every dimension of your agent&apos;s behavior — tasks, traces, and usage.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feat) => (
            <div
              key={feat.title}
              className={`rounded-xl border ${feat.borderColor} bg-card p-6 flex flex-col gap-5 transition-all duration-200 hover:shadow-lg hover:shadow-black/5`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg ${feat.bgColor} flex items-center justify-center`}
                >
                  <feat.icon className={`h-5 w-5 ${feat.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{feat.title}</h3>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">{feat.description}</p>

              <div className="mt-auto rounded-lg bg-muted/50 border border-border/50 overflow-hidden font-mono text-xs">
                <div className="px-3 py-1.5 border-b border-border/50 text-muted-foreground/70 bg-muted/30">
                  {feat.example.title}
                </div>
                <div className="px-3 py-2 space-y-0.5">
                  {feat.example.lines.map((line, i) => (
                    <div key={i} className="text-foreground/80">
                      {line || '\u00A0'}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
