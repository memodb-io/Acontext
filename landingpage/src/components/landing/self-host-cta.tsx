'use client'

import { CopyCommand } from './copy-command'

export function SelfHostCTA() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 border border-primary/20 text-xs sm:text-sm font-medium select-none">
          <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-full w-full bg-primary"></span>
          </span>
          <span className="whitespace-nowrap">Open-source, one command to host</span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-bold">Self-Host in Seconds</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Run the full Acontext stack on your own infrastructure with a single command.
        </p>

        <CopyCommand
          command="curl -fsSL https://install.acontext.io | sh"
          className="max-w-lg mx-auto"
        />
      </div>
    </section>
  )
}
