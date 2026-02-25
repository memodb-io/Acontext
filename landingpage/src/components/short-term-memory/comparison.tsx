'use client'

import { Check, X, Minus } from 'lucide-react'

type CellValue = 'yes' | 'no' | 'partial' | string

interface ComparisonRow {
  feature: string
  category: 'messages' | 'disk' | 'skill'
  acontext: CellValue
  diy: CellValue
  langchain: CellValue
}

const rows: ComparisonRow[] = [
  {
    feature: 'Multi-provider format',
    category: 'messages',
    acontext: 'yes',
    diy: 'no',
    langchain: 'partial',
  },
  {
    feature: 'Token-aware retrieval',
    category: 'messages',
    acontext: 'yes',
    diy: 'no',
    langchain: 'partial',
  },
  {
    feature: 'Edit strategies',
    category: 'messages',
    acontext: 'yes',
    diy: 'no',
    langchain: 'no',
  },
  {
    feature: 'Session summaries',
    category: 'messages',
    acontext: 'yes',
    diy: 'no',
    langchain: 'partial',
  },
  {
    feature: 'S3-backed file storage',
    category: 'disk',
    acontext: 'yes',
    diy: 'Manual',
    langchain: 'no',
  },
  {
    feature: 'Grep & glob file search',
    category: 'disk',
    acontext: 'yes',
    diy: 'Manual',
    langchain: 'no',
  },
  {
    feature: 'Pre-built agent file tools',
    category: 'disk',
    acontext: 'yes',
    diy: 'no',
    langchain: 'no',
  },
  {
    feature: 'Skill package storage (ZIP)',
    category: 'skill',
    acontext: 'yes',
    diy: 'no',
    langchain: 'no',
  },
  {
    feature: 'Skill catalog & file access',
    category: 'skill',
    acontext: 'yes',
    diy: 'no',
    langchain: 'no',
  },
  {
    feature: 'Pre-built agent skill tools',
    category: 'skill',
    acontext: 'yes',
    diy: 'no',
    langchain: 'no',
  },
  {
    feature: 'Per-user isolation',
    category: 'messages',
    acontext: 'yes',
    diy: 'Manual',
    langchain: 'Manual',
  },
  {
    feature: 'Cloud-native / API-first',
    category: 'messages',
    acontext: 'yes',
    diy: 'no',
    langchain: 'no',
  },
]

const categoryLabels: Record<string, { label: string; color: string }> = {
  messages: { label: 'Messages', color: 'text-blue-400' },
  disk: { label: 'Disk', color: 'text-amber-400' },
  skill: { label: 'Skills', color: 'text-emerald-400' },
}

function CellContent({ value }: { value: CellValue }) {
  if (value === 'yes') {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/15">
        <Check className="h-4 w-4 text-green-400" />
      </span>
    )
  }
  if (value === 'no') {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/15">
        <X className="h-4 w-4 text-red-400" />
      </span>
    )
  }
  if (value === 'partial') {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500/15">
        <Minus className="h-4 w-4 text-yellow-400" />
      </span>
    )
  }
  return <span className="text-sm text-muted-foreground">{value}</span>
}

export function Comparison() {
  const grouped = ['messages', 'disk', 'skill'] as const
  let rowIndex = 0

  return (
    <section className="w-full py-20">
      <div className="w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] mx-auto px-4">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold">How It Compares</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            See how Acontext Short-term Memory compares to building it yourself or using other
            frameworks.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground min-w-[220px]" />
                <th className="text-center py-4 px-4 text-sm font-semibold text-foreground min-w-[160px] relative">
                  <span className="relative z-10">Acontext</span>
                  <div className="absolute inset-x-0 -top-2 bottom-0 bg-blue-500/5 rounded-t-lg border-x border-t border-blue-500/20" />
                </th>
                <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground min-w-[140px]">
                  DIY
                </th>
                <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground min-w-[140px]">
                  LangChain Memory
                </th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((category) => {
                const categoryRows = rows.filter((r) => r.category === category)
                const meta = categoryLabels[category]
                return categoryRows.map((row, i) => {
                  const globalIndex = rowIndex++
                  return (
                    <tr
                      key={row.feature}
                      className={`border-b border-border/50 ${globalIndex % 2 === 0 ? '' : 'bg-muted/20'}`}
                    >
                      <td className="py-4 px-4 text-sm font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          {i === 0 && (
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-wider ${meta.color} opacity-70`}
                            >
                              {meta.label}
                            </span>
                          )}
                          {i === 0 && <span className="text-border">|</span>}
                          {row.feature}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center relative">
                        <span className="relative z-10">
                          <CellContent value={row.acontext} />
                        </span>
                        <div className="absolute inset-x-0 inset-y-0 bg-blue-500/5 border-x border-blue-500/20" />
                      </td>
                      <td className="py-4 px-4 text-center">
                        <CellContent value={row.diy} />
                      </td>
                      <td className="py-4 px-4 text-center">
                        <CellContent value={row.langchain} />
                      </td>
                    </tr>
                  )
                })
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
