'use client'

import { useState } from 'react'
import {
  Database,
  BarChart3,
  Sparkles,
  Cloud,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface SpotlightCard {
  title: string
  description: string
  icon: typeof Database
  href: string
  gradient: string
  isExternal?: boolean
}

const spotlightCards: SpotlightCard[] = [
  {
    title: 'Short-term Memory',
    description:
      'Store and manage messages, files, and artifacts across OpenAI, Anthropic, and Gemini formats. Organize by session with disk storage and sandbox execution.',
    icon: Database,
    href: '/product/short-term-memory',
    gradient: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    title: 'Mid-term State',
    description:
      'Monitor agent tasks, trace execution flows, and track success rates in real-time. Visualize agent behavior with dashboards and detailed traces.',
    icon: BarChart3,
    href: '/product/mid-term-state',
    gradient: 'from-indigo-500/20 to-blue-500/20',
  },
  {
    title: 'Long-term Skill',
    description:
      'Automatically distill agent sessions into reusable, human-readable skills. Create learning spaces that let agents improve from every run.',
    icon: Sparkles,
    href: '/product/long-term-skill',
    gradient: 'from-violet-500/20 to-purple-500/20',
  },
  {
    title: 'Cloud Platform',
    description:
      'Managed cloud service with a full-featured dashboard. Monitor projects, manage sessions, and collaborate with your team — no infrastructure to maintain.',
    icon: Cloud,
    href: 'https://dash.acontext.io',
    gradient: 'from-emerald-500/20 to-teal-500/20',
    isExternal: true,
  },
]

function SpotlightCardComponent({ card }: { card: SpotlightCard }) {
  const [_isHovered, setIsHovered] = useState(false)
  const Icon = card.icon

  const content = (
    <>
      {/* Gradient background */}
      <div
        className={cn(
          'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500',
          `bg-linear-to-br ${card.gradient}`,
        )}
      />

      {/* Content */}
      <div className="relative z-10 p-6 sm:p-8">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 rounded-lg bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110">
            <Icon className="h-6 w-6 transition-transform duration-300 group-hover:rotate-12" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-xl font-semibold text-foreground transition-transform duration-300 group-hover:translate-x-1">
                {card.title}
              </h3>
              <div className="flex items-center gap-2 text-primary/70 group-hover:text-primary text-sm font-medium transition-colors duration-300 shrink-0">
                <span>Learn more</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed transition-colors duration-300 group-hover:text-foreground/70">
              {card.description}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom gradient glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-linear-to-t from-primary/10 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </>
  )

  const sharedClasses = cn(
    'group relative overflow-hidden rounded-xl',
    'bg-card/50 backdrop-blur border border-border/50',
    'hover:border-border/80 hover:-translate-y-1 transition-all duration-300',
    'shadow-[0_4px_12px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.06)]',
    'hover:shadow-[0_8px_24px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]',
    'cursor-pointer block',
  )

  if (card.isExternal) {
    return (
      <a
        href={card.href}
        target="_blank"
        rel="noopener noreferrer"
        className={sharedClasses}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {content}
      </a>
    )
  }

  return (
    <Link
      href={card.href}
      className={sharedClasses}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {content}
    </Link>
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
            Four pillars that make Acontext the platform of choice for production-ready AI agents
          </p>
        </div>

        {/* 2x2 grid of spotlight cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {spotlightCards.map((card, index) => (
            <SpotlightCardComponent key={index} card={card} />
          ))}
        </div>
      </div>
    </section>
  )
}
