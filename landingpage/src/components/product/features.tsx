'use client'

import {
  Database,
  HardDrive,
  Zap,
  Terminal,
  Edit3,
  Gauge,
  FileCode,
  BarChart3,
  Activity,
  Layers,
  Sparkles,
  Code,
  Cloud,
  GitBranch,
  Shield,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FeatureItem {
  title: string
  description: string
  icon: typeof Database
  docsUrl?: string
}

interface FeatureCategory {
  name: string
  description: string
  features: FeatureItem[]
}

const categories: FeatureCategory[] = [
  {
    name: 'Short-term Memory',
    description: 'Store and manage all agent context in one place',
    features: [
      {
        title: 'Multi-format Messages',
        description: 'OpenAI, Anthropic, and Gemini formats with automatic conversion',
        icon: Database,
        docsUrl: 'https://docs.acontext.app/store/messages/multi-provider',
      },
      {
        title: 'Disk & Artifacts',
        description: 'S3-backed file storage with glob pattern and regex search',
        icon: HardDrive,
        docsUrl: 'https://docs.acontext.app/store/disk',
      },
      {
        title: 'Session Management',
        description: 'Organize conversations by session with full lifecycle control',
        icon: Zap,
        docsUrl: 'https://docs.acontext.app/api-reference/session/create-session',
      },
      {
        title: 'Sandbox Execution',
        description: 'Run code in isolated, secure container environments',
        icon: Terminal,
        docsUrl: 'https://docs.acontext.app/store/sandbox',
      },
    ],
  },
  {
    name: 'Context Engineering',
    description: 'Fine-tune how context is served to your agents',
    features: [
      {
        title: 'Context Editing',
        description: 'Edit context on-the-fly without modifying stored messages',
        icon: Edit3,
        docsUrl: 'https://docs.acontext.app/engineering/editing',
      },
      {
        title: 'Prompt Cache Stability',
        description: 'Maintain LLM cache hits when using edit strategies',
        icon: Gauge,
        docsUrl: 'https://docs.acontext.app/engineering/cache',
      },
      {
        title: 'Session Summary',
        description: 'Compact task summaries for prompts to reduce token usage',
        icon: FileCode,
        docsUrl: 'https://docs.acontext.app/engineering/session_summary',
      },
    ],
  },
  {
    name: 'Observability',
    description: 'Monitor and understand your agents in real-time',
    features: [
      {
        title: 'Dashboard & Monitoring',
        description: 'Real-time agent task monitoring, traces, and success rates',
        icon: BarChart3,
        docsUrl: 'https://docs.acontext.app/observe/dashboard',
      },
      {
        title: 'Task Extraction',
        description: 'Automatic task extraction from conversations with status tracking',
        icon: Activity,
        docsUrl: 'https://docs.acontext.app/observe/agent_tasks',
      },
    ],
  },
  {
    name: 'Long-term Skill',
    description: 'Let agents learn and improve from every run',
    features: [
      {
        title: 'Agent Skills',
        description: 'Package and share reusable agent skills and knowledge',
        icon: Layers,
        docsUrl: 'https://docs.acontext.app/store/skill',
      },
      {
        title: 'Learning Spaces',
        description:
          'Automatically distill session outcomes into reusable, human-readable skills',
        icon: Sparkles,
        docsUrl: 'https://docs.acontext.app/learn/learning-spaces',
      },
    ],
  },
  {
    name: 'Platform & Developer Experience',
    description: 'Everything you need to build and deploy',
    features: [
      {
        title: 'Python & TypeScript SDKs',
        description: 'Official SDKs with full async support',
        icon: Code,
        docsUrl: 'https://docs.acontext.app/api-reference/introduction',
      },
      {
        title: 'Cloud Platform',
        description: 'Managed cloud service with dashboard and observability',
        icon: Cloud,
        docsUrl: 'https://dash.acontext.io',
      },
      {
        title: 'Open Source',
        description: 'Self-hostable with full source code on GitHub',
        icon: GitBranch,
        docsUrl: 'https://github.com/memodb-io/acontext',
      },
      {
        title: 'API Security',
        description: 'Bearer token authentication with secure key management',
        icon: Shield,
        docsUrl: 'https://docs.acontext.app/api-reference/introduction',
      },
    ],
  },
]

function CategoryCard({ category }: { category: FeatureCategory }) {
  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden',
        'bg-card/50 backdrop-blur border border-border/50',
        'shadow-[0_4px_12px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.06)]',
      )}
    >
      {/* Category header */}
      <div className="px-6 pt-6 pb-4">
        <h3 className="text-xl font-semibold text-foreground">{category.name}</h3>
        <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
      </div>

      {/* Feature list */}
      <div className="px-6 pb-6 space-y-4">
        {category.features.map((feature, index) => {
          const Icon = feature.icon
          return (
            <div
              key={index}
              className="group flex items-start gap-3"
            >
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{feature.title}</h4>
                  {feature.docsUrl && (
                    <a
                      href={feature.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary/50 hover:text-primary transition-colors shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  {feature.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Features() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[768px] lg:max-w-[1200px] mx-auto">
        {/* Section header */}
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
            All Features
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Everything you need to build, deploy, and scale production-ready AI agents
          </p>
        </div>

        {/* Category grid — top row 3, bottom row 2 centered */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category, index) => (
            <CategoryCard key={index} category={category} />
          ))}
        </div>
      </div>
    </section>
  )
}
