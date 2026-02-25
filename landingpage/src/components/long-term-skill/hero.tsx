'use client'

import { Button } from '@/components/ui/button'
import { Github, BookOpen } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative w-full overflow-hidden pt-32 pb-20">
      <div className="absolute inset-0 bg-gradient-to-b from-pink-500/5 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] mx-auto px-4 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-sm font-medium mb-6">
          <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
          New Approach to Agent Memory
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
          <span className="hero-text-gradient">Long-term Skill</span>
        </h1>

        <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-4">
          Agent memory stored as skills — filesystem-compatible, configurable, and human-readable
        </p>

        <p className="text-sm sm:text-base text-muted-foreground/70 max-w-2xl mx-auto leading-relaxed mb-10">
          Your agents build memory as plain markdown skill files you can read, edit, version control, and mount in sandboxes.
          No opaque embeddings. No vendor lock-in.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" className="min-w-48 h-12 text-base font-semibold" asChild>
            <a
              href="https://docs.acontext.app/learn/skill-memory"
              target="_blank"
              rel="noopener noreferrer"
            >
              <BookOpen className="h-5 w-5 mr-2" />
              Get Started
            </a>
          </Button>
          <Button variant="outline" size="lg" className="min-w-48 h-12 text-base" asChild>
            <a
              href="https://github.com/memodb-io/acontext"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-5 w-5 mr-2" />
              GitHub
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}
