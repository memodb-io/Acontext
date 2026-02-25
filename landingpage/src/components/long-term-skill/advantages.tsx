'use client'

import { FolderOpen, Settings, Eye } from 'lucide-react'

const advantages = [
  {
    icon: FolderOpen,
    title: 'Filesystem-Compatible',
    description:
      'Skills are real files on disk. Mount them in sandboxes, sync across environments, version control with Git, and inspect with cat and grep.',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    example: {
      title: 'skills/daily-logs/',
      lines: [
        'SKILL.md',
        '2025-02-20.md',
        '2025-02-21.md',
        '2025-02-22.md',
      ],
    },
  },
  {
    icon: Settings,
    title: 'Configurable',
    description:
      'Each SKILL.md defines the schema, purpose, and organization rules. You control how your agent stores memory — not the platform.',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
    example: {
      title: 'SKILL.md',
      lines: [
        '# Daily Logs',
        'description: One file per day',
        'naming: YYYY-MM-DD.md',
        'retention: 30 days',
      ],
    },
  },
  {
    icon: Eye,
    title: 'Human-Friendly',
    description:
      'Plain markdown files your team can read, edit, review, and audit directly. No embeddings decoder needed — just open the file.',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    example: {
      title: '2025-02-22.md',
      lines: [
        '## Deployed v2.1 to staging',
        'Fixed auth timeout bug.',
        'Updated rate limit to 1000/min.',
        'User confirmed fix works.',
      ],
    },
  },
]

export function Advantages() {
  return (
    <section className="w-full py-20">
      <div className="w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] mx-auto px-4">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold">Three Advantages</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Long-term Skill gives you properties no other agent memory system offers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {advantages.map((adv) => (
            <div
              key={adv.title}
              className={`rounded-xl border ${adv.borderColor} bg-card p-6 flex flex-col gap-5 transition-all duration-200 hover:shadow-lg hover:shadow-black/5`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg ${adv.bgColor} flex items-center justify-center`}
                >
                  <adv.icon className={`h-5 w-5 ${adv.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{adv.title}</h3>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">{adv.description}</p>

              <div className="mt-auto rounded-lg bg-muted/50 border border-border/50 overflow-hidden font-mono text-xs">
                <div className="px-3 py-1.5 border-b border-border/50 text-muted-foreground/70 bg-muted/30">
                  {adv.example.title}
                </div>
                <div className="px-3 py-2 space-y-0.5">
                  {adv.example.lines.map((line, i) => (
                    <div key={i} className="text-foreground/80">
                      {line}
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
