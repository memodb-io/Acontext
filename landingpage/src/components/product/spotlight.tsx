'use client'

import { useState } from 'react'
import {
  MessageSquare,
  FileText,
  BarChart3,
  BookOpen,
  ArrowRight,
  Terminal,
  HardDrive,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpotlightCard {
  title: string
  description: string
  icon: typeof MessageSquare
  href: string
  gradient: string
  badge?: string
}

const spotlightCards: SpotlightCard[] = [
  {
    title: 'Sessions',
    description:
      'Store and manage conversation sessions with support for OpenAI, Anthropic, and Gemini formats. Organize messages by session for easy retrieval and context management.',
    icon: MessageSquare,
    href: 'https://docs.acontext.io/store/messages/multi-provider',
    gradient: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    title: 'Disk & Artifacts',
    description:
      'S3-backed file storage for your agent. Upload, download, and manage artifacts with glob pattern search and regex content search capabilities.',
    icon: HardDrive,
    href: 'https://docs.acontext.io/store/disk',
    gradient: 'from-green-500/20 to-emerald-500/20',
  },
  {
    title: 'Agent Skills',
    description:
      'Upload and manage reusable agent skills. Package knowledge, tools, and patterns into skills that can be shared and reused across different agents.',
    icon: BookOpen,
    href: 'https://docs.acontext.io/store/skill',
    gradient: 'from-violet-500/20 to-purple-500/20',
  },
  {
    title: 'Sandbox',
    description:
      'Execute code in isolated environments. Run skills, process files, and build agent workflows in secure containers with full command execution.',
    icon: Terminal,
    href: 'https://docs.acontext.io/store/sandbox',
    gradient: 'from-amber-500/20 to-orange-500/20',
  },
  {
    title: 'Observability',
    description:
      'Monitor agent tasks, trace execution flows, and track success rates in real-time. Visualize agent behavior with dashboards and detailed traces.',
    icon: BarChart3,
    href: 'https://docs.acontext.io/observe/dashboard',
    gradient: 'from-indigo-500/20 to-blue-500/20',
  },
  {
    title: 'Dashboard',
    description:
      'View Context, Artifacts, Tasks and Skills in a unified dashboard. Monitor agent performance and manage resources with an intuitive interface.',
    icon: FileText,
    href: 'https://dash.acontext.io',
    gradient: 'from-purple-500/20 to-pink-500/20',
  },
]

function SpotlightCard({ card }: { card: SpotlightCard }) {
  const [isHovered, setIsHovered] = useState(false)
  const Icon = card.icon

  return (
    <a
      href={card.href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group relative overflow-hidden rounded-xl',
        'bg-card/50 backdrop-blur border border-border/50',
        'hover:border-border/80 hover:-translate-y-1 transition-all duration-300',
        'shadow-[0_4px_12px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.06)]',
        'hover:shadow-[0_8px_24px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]',
        'cursor-pointer',
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Gradient background */}
      <div
        className={cn(
          'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500',
          `bg-linear-to-br ${card.gradient}`,
        )}
      />

      {/* Content */}
      <div className="relative z-10 p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 rounded-lg bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110">
            <Icon className="h-6 w-6 transition-transform duration-300 group-hover:rotate-12" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-xl font-semibold text-foreground transition-transform duration-300 group-hover:translate-x-1">
                {card.title}
              </h3>
              {/* Link indicator - on the right */}
              <div className="flex items-center gap-2 text-primary/70 group-hover:text-primary text-sm font-medium transition-colors duration-300 shrink-0">
                <span>Learn more</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            </div>
            {card.badge && (
              <div className="mb-2">
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground border border-border/50">
                  {card.badge}
                </span>
              </div>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed transition-colors duration-300 group-hover:text-foreground/70">
              {card.description}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom gradient glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-linear-to-t from-primary/10 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </a>
  )
}

export function Spotlight() {
  return (
    <section id="spotlight" className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="w-full max-w-[768px] lg:max-w-[1200px] mx-auto">
        {/* Section header */}
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">Product Spotlight</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Explore the core capabilities that make Acontext the platform of choice for building
            production-ready AI agents
          </p>
        </div>

        {/* Grid of spotlight cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {spotlightCards.map((card, index) => (
            <SpotlightCard key={index} card={card} />
          ))}
        </div>
      </div>
    </section>
  )
}
