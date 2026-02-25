'use client'

import { Check, X, Minus } from 'lucide-react'

type CellValue = 'yes' | 'no' | 'partial' | string

interface ComparisonRow {
  feature: string
  acontext: CellValue
  langsmith: CellValue
  custom: CellValue
}

const rows: ComparisonRow[] = [
  {
    feature: 'Agent task extraction',
    acontext: 'yes',
    langsmith: 'no',
    custom: 'no',
  },
  {
    feature: 'Session-level analytics',
    acontext: 'yes',
    langsmith: 'partial',
    custom: 'Manual',
  },
  {
    feature: 'Token usage tracking',
    acontext: 'yes',
    langsmith: 'yes',
    custom: 'Manual',
  },
  {
    feature: 'OpenTelemetry traces',
    acontext: 'yes',
    langsmith: 'no',
    custom: 'partial',
  },
  {
    feature: 'Built-in dashboard',
    acontext: 'yes',
    langsmith: 'yes',
    custom: 'no',
  },
  {
    feature: 'Zero-config setup',
    acontext: 'yes',
    langsmith: 'partial',
    custom: 'no',
  },
  {
    feature: 'Self-hostable',
    acontext: 'yes',
    langsmith: 'no',
    custom: 'yes',
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

export function Capabilities() {
  return (
    <section className="w-full py-20">
      <div className="w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] mx-auto px-4">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold">How It Compares</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Mid-term State is purpose-built for AI agent sessions — not retrofitted from generic APM.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground min-w-[180px]" />
                <th className="text-center py-4 px-4 text-sm font-semibold text-foreground min-w-[160px] relative">
                  <span className="relative z-10">Acontext</span>
                  <div className="absolute inset-x-0 -top-2 bottom-0 bg-indigo-500/5 rounded-t-lg border-x border-t border-indigo-500/20" />
                </th>
                <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground min-w-[140px]">
                  LangSmith
                </th>
                <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground min-w-[140px]">
                  Custom Build
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
                      <CellContent value={row.acontext} />
                    </span>
                    <div className="absolute inset-x-0 inset-y-0 bg-indigo-500/5 border-x border-indigo-500/20" />
                  </td>
                  <td className="py-4 px-4 text-center">
                    <CellContent value={row.langsmith} />
                  </td>
                  <td className="py-4 px-4 text-center">
                    <CellContent value={row.custom} />
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
