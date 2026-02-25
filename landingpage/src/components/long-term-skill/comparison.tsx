'use client'

import { Check, X, Minus } from 'lucide-react'

type CellValue = 'yes' | 'no' | 'partial' | string

interface ComparisonRow {
  feature: string
  skillMemory: CellValue
  vectorStore: CellValue
  knowledgeGraph: CellValue
  plainText: CellValue
}

const rows: ComparisonRow[] = [
  {
    feature: 'Storage format',
    skillMemory: 'Markdown files',
    vectorStore: 'Embeddings',
    knowledgeGraph: 'Nodes & edges',
    plainText: 'Text files',
  },
  {
    feature: 'Human-readable',
    skillMemory: 'yes',
    vectorStore: 'no',
    knowledgeGraph: 'partial',
    plainText: 'partial',
  },
  {
    feature: 'Configurable schema',
    skillMemory: 'yes',
    vectorStore: 'no',
    knowledgeGraph: 'Complex upfront',
    plainText: 'no',
  },
  {
    feature: 'Filesystem-native',
    skillMemory: 'yes',
    vectorStore: 'no',
    knowledgeGraph: 'no',
    plainText: 'yes',
  },
  {
    feature: 'Version controllable',
    skillMemory: 'yes',
    vectorStore: 'no',
    knowledgeGraph: 'no',
    plainText: 'no',
  },
]

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
  return (
    <section className="w-full py-20">
      <div className="w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] mx-auto px-4">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold">How It Compares</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            See how Long-term Skill stacks up against other approaches to AI agent memory.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground min-w-[160px]" />
                <th className="text-center py-4 px-4 text-sm font-semibold text-foreground min-w-[160px] relative">
                  <span className="relative z-10">Long-term Skill (Acontext)</span>
                  <div className="absolute inset-x-0 -top-2 bottom-0 bg-pink-500/5 rounded-t-lg border-x border-t border-pink-500/20" />
                </th>
                <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground min-w-[140px]">
                  Vector Store
                </th>
                <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground min-w-[140px]">
                  Knowledge Graph
                </th>
                <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground min-w-[140px]">
                  Plain-text Files
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.feature}
                  className={`border-b border-border/50 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}
                >
                  <td className="py-4 px-4 text-sm font-medium text-foreground">{row.feature}</td>
                  <td className="py-4 px-4 text-center relative">
                    <span className="relative z-10">
                      <CellContent value={row.skillMemory} />
                    </span>
                    <div className="absolute inset-x-0 inset-y-0 bg-pink-500/5 border-x border-pink-500/20" />
                  </td>
                  <td className="py-4 px-4 text-center">
                    <CellContent value={row.vectorStore} />
                  </td>
                  <td className="py-4 px-4 text-center">
                    <CellContent value={row.knowledgeGraph} />
                  </td>
                  <td className="py-4 px-4 text-center">
                    <CellContent value={row.plainText} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
