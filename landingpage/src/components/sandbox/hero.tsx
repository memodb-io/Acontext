'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Code2, Layers, Cpu } from 'lucide-react'

// Terminal entries - commands and responses with different types
type TerminalEntry = {
  text: string
  type: 'command' | 'response'
}

// Left column - Sandbox API commands
const leftColumnEntries: TerminalEntry[] = [
  { text: '$ sandbox = client.sandboxes.create()', type: 'command' },
  { text: '{"sandbox_id": "sbx_a1b2c3", "status": "running"}', type: 'response' },
  { text: '$ disk = client.disks.create()', type: 'command' },
  { text: '{"disk_id": "dsk_x7y8z9", "size": "10GB"}', type: 'response' },
  { text: '$ ctx = SANDBOX_TOOLS.format_context(client, sandbox.id)', type: 'command' },
  { text: '{"context": "initialized", "tools": 12}', type: 'response' },
  { text: '$ result = execute_tool(ctx, "bash_execution", {...})', type: 'command' },
  { text: '{"exit_code": 0, "stdout": "Hello World"}', type: 'response' },
  { text: '$ export = execute_tool(ctx, "export_file", {...})', type: 'command' },
  { text: '{"public_url": "https://...", "status": "success"}', type: 'response' },
  { text: '$ client.sandboxes.kill(sandbox.sandbox_id)', type: 'command' },
  { text: '{"status": "terminated", "duration": "45s"}', type: 'response' },
  { text: '$ snapshot = client.disks.snapshot(disk_id)', type: 'command' },
  { text: '{"snapshot_id": "snap_123", "size": "2.3GB"}', type: 'response' },
]

// Right column - File & Process operations
const rightColumnEntries: TerminalEntry[] = [
  { text: '$ files = SANDBOX_TOOLS.list_files(ctx, "/")', type: 'command' },
  { text: '["main.py", "config.json", "output/"]', type: 'response' },
  { text: '$ content = SANDBOX_TOOLS.read_file(ctx, "main.py")', type: 'command' },
  { text: '{"content": "import os\\n...", "size": "1.2KB"}', type: 'response' },
  { text: '$ SANDBOX_TOOLS.write_file(ctx, "test.py", code)', type: 'command' },
  { text: '{"status": "written", "path": "/workspace/test.py"}', type: 'response' },
  { text: '$ proc = SANDBOX_TOOLS.run_process(ctx, "python")', type: 'command' },
  { text: '{"pid": 1234, "status": "running"}', type: 'response' },
  { text: '$ logs = SANDBOX_TOOLS.get_logs(ctx, proc.pid)', type: 'command' },
  { text: '{"stdout": "Processing...", "stderr": ""}', type: 'response' },
  { text: '$ SANDBOX_TOOLS.install_package(ctx, "numpy")', type: 'command' },
  { text: '{"installed": "numpy==1.24.0", "time": "3.2s"}', type: 'response' },
  { text: '$ env = SANDBOX_TOOLS.get_environment(ctx)', type: 'command' },
  { text: '{"python": "3.11", "node": "18.x", "go": "1.21"}', type: 'response' },
]

// Theme badges configuration
const themeBadges = [
  {
    Icon: Code2,
    title: 'Simple & Open Source',
    description: 'Easy to integrate, community-driven',
    color: 'rgba(62, 207, 142, 0.8)',
  },
  {
    Icon: Layers,
    title: 'Model Agnostic',
    description: 'Works with any LLM',
    color: 'rgba(139, 92, 246, 0.8)',
  },
  {
    Icon: Cpu,
    title: 'Composable',
    description: 'Mix tools, skills, sandboxes',
    color: 'rgba(59, 130, 246, 0.8)',
  },
]

// Helper to get RGBA with custom opacity
const withOpacity = (color: string, opacity: number): string => {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (match) {
    return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`
  }
  return color
}

// Colors for terminal
const COMMAND_COLOR = 'rgba(62, 207, 142, 0.6)' // Green for commands
const RESPONSE_COLOR = 'rgba(139, 92, 246, 0.6)' // Purple for responses

// Single terminal line with color based on type and position
function TerminalLine({
  text,
  type,
  style,
  align = 'left',
}: {
  text: string
  type: 'command' | 'response'
  style?: React.CSSProperties
  align?: 'left' | 'right'
}) {
  const color = type === 'command' ? COMMAND_COLOR : RESPONSE_COLOR

  return (
    <div
      className={`font-mono text-[9px] sm:text-[10px] md:text-xs leading-relaxed whitespace-nowrap ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
      style={{
        color,
        ...style,
      }}
    >
      {text}
    </div>
  )
}

// Single column of scrolling terminal lines
function TerminalColumn({
  entries,
  interval,
  align = 'left',
}: {
  entries: TerminalEntry[]
  interval: number
  align?: 'left' | 'right'
}) {
  const [lines, setLines] = useState<Array<{ id: number; entry: TerminalEntry }>>([])
  const lineIdRef = useRef(0)
  const entryIndexRef = useRef(0)

  const MAX_LINES = 28

  useEffect(() => {
    // Initialize with lines to fill the column
    const initialLines: Array<{ id: number; entry: TerminalEntry }> = []
    for (let i = 0; i < MAX_LINES; i++) {
      initialLines.push({
        id: lineIdRef.current++,
        entry: entries[entryIndexRef.current % entries.length],
      })
      entryIndexRef.current++
    }
    setLines(initialLines)

    // Add new lines periodically
    const timer = setInterval(() => {
      setLines((prev) => {
        const newLine = {
          id: lineIdRef.current++,
          entry: entries[entryIndexRef.current % entries.length],
        }
        entryIndexRef.current++
        return [...prev.slice(1), newLine]
      })
    }, interval)

    return () => clearInterval(timer)
  }, [entries, interval])

  return (
    <div className="flex-1 flex flex-col justify-between py-2 overflow-hidden">
      {lines.map((line, index) => {
        const totalLines = lines.length
        const fadeTopCount = 5
        const fadeBottomCount = 4

        let opacity = 0.45

        if (index < fadeTopCount) {
          opacity = 0.08 + (index / fadeTopCount) * 0.37
        } else if (index >= totalLines - fadeBottomCount) {
          const fromBottom = totalLines - 1 - index
          opacity = 0.08 + (fromBottom / fadeBottomCount) * 0.37
        }

        return (
          <TerminalLine
            key={line.id}
            text={line.entry.text}
            type={line.entry.type}
            align={align}
            style={{
              opacity,
              transition: 'all 0.5s ease-out',
            }}
          />
        )
      })}
    </div>
  )
}

// Terminal background with two columns of scrolling lines
function TerminalBackground() {
  return (
    <div className="absolute inset-0 flex flex-col pointer-events-none overflow-hidden">
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(62, 207, 142, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(62, 207, 142, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Two columns of terminal lines */}
      <div className="absolute inset-0 flex gap-8 sm:gap-16 md:gap-24 px-2 sm:px-4 md:px-8">
        {/* Left column - scrolls slightly faster */}
        <TerminalColumn entries={leftColumnEntries} interval={1400} align="left" />

        {/* Right column - scrolls slightly slower */}
        <TerminalColumn entries={rightColumnEntries} interval={1700} align="right" />
      </div>

      {/* Top fade gradient */}
      <div
        className="absolute top-0 left-0 right-0 h-20 pointer-events-none z-10"
        style={{
          background: 'linear-gradient(to bottom, hsl(var(--background)) 0%, transparent 100%)',
        }}
      />

      {/* Bottom fade gradient */}
      <div
        className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none z-10"
        style={{
          background: 'linear-gradient(to top, hsl(var(--background)) 0%, transparent 100%)',
        }}
      />

      {/* Center fade for content readability */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, hsl(var(--background) / 0.7) 0%, transparent 70%)',
        }}
      />
    </div>
  )
}

// Theme badge component
function ThemeBadge({
  Icon,
  title,
  description,
  color,
  delay,
}: {
  Icon: React.ElementType
  title: string
  description: string
  color: string
  delay: number
}) {
  return (
    <div
      className="group flex flex-col items-center gap-1 sm:gap-2 px-2 py-2 sm:px-4 sm:py-3 rounded-lg sm:rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm transition-all duration-300 hover:border-border/60 hover:bg-card/50 hover:scale-105 hover:-translate-y-0.5 animate-fade-in-up opacity-0 cursor-pointer"
      style={{
        animationDelay: `${delay}ms`,
        animationFillMode: 'forwards',
      }}
    >
      <div
        className="p-1.5 sm:p-2 rounded-md sm:rounded-lg transition-all duration-300 group-hover:scale-110"
        style={{
          backgroundColor: withOpacity(color, 0.1),
          border: `1px solid ${withOpacity(color, 0.2)}`,
          boxShadow: `0 0 0 0 ${withOpacity(color, 0)}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = `0 0 20px 2px ${withOpacity(color, 0.3)}`
          e.currentTarget.style.backgroundColor = withOpacity(color, 0.15)
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = `0 0 0 0 ${withOpacity(color, 0)}`
          e.currentTarget.style.backgroundColor = withOpacity(color, 0.1)
        }}
      >
        <Icon
          className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 group-hover:scale-105"
          style={{ color }}
        />
      </div>
      <div className="text-center">
        <h3 className="text-xs sm:text-sm font-semibold text-foreground transition-colors duration-300 group-hover:text-foreground/90">{title}</h3>
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0 sm:mt-0.5 hidden sm:block">{description}</p>
      </div>
    </div>
  )
}

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const title = titleRef.current
    if (!title) return

    // Animate title on mount
    title.style.opacity = '0'
    title.style.transform = 'translateY(30px)'

    const animateTitle = () => {
      const start = performance.now()
      const duration = 800

      const animate = (currentTime: number) => {
        const elapsed = currentTime - start
        const progress = Math.min(elapsed / duration, 1)
        const ease = 1 - Math.pow(1 - progress, 3) // ease-out cubic

        title.style.opacity = String(ease)
        title.style.transform = `translateY(${30 * (1 - ease)}px)`

        if (progress < 1) {
          requestAnimationFrame(animate)
        }
      }
      requestAnimationFrame(animate)
    }
    animateTitle()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[calc(35vh*4/3)] flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 overflow-hidden"
    >
      {/* Background container with max-width */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center">
        <div className="relative w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] h-full">
          {/* Terminal background animation */}
          <TerminalBackground />

          {/* Background gradient */}
          <div className="absolute inset-0">
            <div className="absolute top-1/4 left-1/4 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-accent/5 rounded-full blur-3xl" />
          </div>

          {/* Scanline effect */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.02]"
            style={{
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
            }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] mx-auto text-center space-y-6 pt-16 pb-12 relative z-10">
        <h1
          ref={titleRef}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight"
        >
          <span className="hero-text-gradient">Secure Agent Skills Execution</span>
        </h1>
        <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          Acontext Sandbox provides secure, isolated environments for code and file management.
        </p>

        {/* Open Source badge */}
        <div className="flex justify-center pt-4">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20">
            <span className="font-bold open-source-gradient">Open Source</span>&nbsp;Alternative to Claude Skills API
          </span>
        </div>

        {/* Theme badges */}
        <div className="flex flex-nowrap justify-center gap-2 sm:gap-4 pt-6 sm:pt-8">
          {themeBadges.map((badge, index) => (
            <ThemeBadge
              key={badge.title}
              {...badge}
              delay={400 + index * 150}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
