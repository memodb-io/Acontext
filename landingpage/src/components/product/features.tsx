'use client'

import {
  CheckCircle2,
  Clock,
  Database,
  Search,
  FileText,
  Zap,
  Code,
  Cloud,
  Shield,
  GitBranch,
  Layers,
  Activity,
  BarChart3,
  ExternalLink,
  Share2,
  GitBranch as VersionControl,
  ThumbsUp,
  Tags,
  HardDrive,
  Eye,
  Server,
  Lock,
  Box,
  Network,
  Plug,
  Terminal,
  Edit3,
  FileCode,
  Gauge,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Feature {
  title: string
  description: string
  icon: typeof Database
  status: 'available' | 'coming-soon'
  docsUrl?: string // Optional docs URL
}

const availableFeatures: Feature[] = [
  {
    title: 'Multi-format Message Storage',
    description:
      'Store messages in OpenAI, Anthropic, and Gemini formats with automatic format conversion',
    icon: Database,
    status: 'available',
    docsUrl: 'https://docs.acontext.io/store/messages/multi-provider',
  },
  {
    title: 'Disk & Artifact Storage',
    description: 'S3-backed file storage with glob pattern search and regex content search',
    icon: HardDrive,
    status: 'available',
    docsUrl: 'https://docs.acontext.io/store/disk',
  },
  {
    title: 'Sandbox Execution',
    description: 'Execute code in isolated environments with secure container execution',
    icon: Terminal,
    status: 'available',
    docsUrl: 'https://docs.acontext.io/store/sandbox',
  },
  {
    title: 'Session Management',
    description: 'Organize conversations by session with full lifecycle management',
    icon: Zap,
    status: 'available',
    docsUrl: 'https://docs.acontext.io/api-reference/session/create-session',
  },
  {
    title: 'Python & TypeScript SDKs',
    description: 'Official SDKs for Python and TypeScript with full async support',
    icon: Code,
    status: 'available',
    docsUrl: 'https://docs.acontext.io/api-reference/introduction',
  },
  {
    title: 'Cloud Platform',
    description: 'Managed cloud service with dashboard and observability tools',
    icon: Cloud,
    status: 'available',
    docsUrl: 'https://dash.acontext.io',
  },
  {
    title: 'Open Source',
    description: 'Self-hostable with full source code available on GitHub',
    icon: GitBranch,
    status: 'available',
    docsUrl: 'https://github.com/memodb-io/acontext',
  },
  {
    title: 'Observability Dashboard',
    description: 'Real-time monitoring of agent tasks, traces, and success rates',
    icon: BarChart3,
    status: 'available',
    docsUrl: 'https://docs.acontext.io/observe/dashboard',
  },
  {
    title: 'Context Editing',
    description: 'Edit context on-the-fly without modifying stored messages',
    icon: Edit3,
    status: 'available',
    docsUrl: 'https://docs.acontext.io/engineering/editing',
  },
  {
    title: 'Agent Skills',
    description: 'Package and share reusable agent skills and knowledge',
    icon: Layers,
    status: 'available',
    docsUrl: 'https://docs.acontext.io/store/skill',
  },
  {
    title: 'Learning Spaces',
    description: 'Automatic skill learning from agent sessions — distills task outcomes into reusable skills',
    icon: Sparkles,
    status: 'available',
    docsUrl: 'https://docs.acontext.io/learn/self-learning',
  },
  {
    title: 'Task Monitoring',
    description: 'Automatic task extraction from agent conversations with status tracking',
    icon: Activity,
    status: 'available',
    docsUrl: 'https://docs.acontext.io/observe/agent_tasks',
  },
  {
    title: 'Prompt Cache Stability',
    description: 'Maintain LLM cache hits when using edit strategies',
    icon: Gauge,
    status: 'available',
    docsUrl: 'https://docs.acontext.io/engineering/cache',
  },
  {
    title: 'Session Summary',
    description: 'Compact task summary for prompts to reduce token usage',
    icon: FileCode,
    status: 'available',
    docsUrl: 'https://docs.acontext.io/engineering/session_summary',
  },
  {
    title: 'API Security',
    description: 'Bearer token authentication with secure API key management',
    icon: Shield,
    status: 'available',
    docsUrl: 'https://docs.acontext.io/api-reference/introduction',
  },
]

const comingSoonFeatures: Feature[] = [
  {
    title: 'Disk File/Dir Sharing',
    description: 'UI component for sharing files and directories with fine-grained access control',
    icon: Share2,
    status: 'coming-soon',
  },
  {
    title: 'Artifact Line Number Access',
    description: 'Retrieve artifacts with precise line number and offset positioning',
    icon: FileText,
    status: 'coming-soon',
  },
  {
    title: 'Message Version Control',
    description: 'Track and manage different versions of messages with full history',
    icon: VersionControl,
    status: 'coming-soon',
  },
  {
    title: 'Context Offloading',
    description: 'Intelligent context offloading to Disks for better memory management',
    icon: Search,
    status: 'coming-soon',
  },
  {
    title: 'Message Labeling',
    description: 'Like, dislike, and provide feedback on messages for improved learning',
    icon: ThumbsUp,
    status: 'coming-soon',
  },
  {
    title: 'Session Metadata',
    description: 'Add custom metadata fields (JSONB) to sessions for user binding and filtering',
    icon: Tags,
    status: 'coming-soon',
  },
  {
    title: 'User Telemetry Observation',
    description: 'Comprehensive user telemetry metrics and service chain observation',
    icon: Eye,
    status: 'coming-soon',
  },
  {
    title: 'Service Chain Traces',
    description: 'Visualize and trace complete service chains with latency and error tracking',
    icon: Network,
    status: 'coming-soon',
  },
  {
    title: 'Internal Service Monitoring',
    description: 'Real-time UI for service health, latency, and error rate visualization',
    icon: Server,
    status: 'coming-soon',
  },
  {
    title: 'Disk Operation Observability',
    description: 'Track file/dir sharing metrics and artifact access patterns',
    icon: Activity,
    status: 'coming-soon',
  },
  {
    title: 'Sandbox Resource Monitoring',
    description: 'Enhanced sandbox monitoring with resource usage and execution history',
    icon: Box,
    status: 'coming-soon',
  },
  {
    title: 'Encrypted Context Storage',
    description: 'Use project API keys to encrypt context data in S3 for enhanced security',
    icon: Lock,
    status: 'coming-soon',
  },
  {
    title: 'LiteLLM Proxy',
    description: 'Add LiteLLM as a proxy for unified LLM API access across providers',
    icon: Plug,
    status: 'coming-soon',
  },
]

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon
  const isAvailable = feature.status === 'available'

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl p-6 flex flex-col',
        'bg-card/50 backdrop-blur border border-border/50',
        'hover:border-border/80 hover:-translate-y-1 transition-all duration-300',
        'shadow-[0_4px_12px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.06)]',
        'hover:shadow-[0_8px_24px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]',
        !isAvailable && 'opacity-75',
      )}
    >
      <div className="flex items-start gap-4 flex-1">
        <div
          className={cn(
            'p-3 rounded-lg transition-all duration-300 group-hover:scale-110',
            isAvailable
              ? 'bg-primary/10 text-primary group-hover:bg-primary/20'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between w-full mb-2">
            <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
            {isAvailable ? (
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0 ml-2" />
            ) : (
              <Clock className="h-5 w-5 text-muted-foreground shrink-0 ml-2" />
            )}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
        </div>
      </div>

      {/* Bottom right corner links */}
      <div className="flex justify-end mt-4">
        {isAvailable && feature.docsUrl ? (
          <a
            href={feature.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors group/link"
            onClick={(e) => e.stopPropagation()}
          >
            <span>View docs</span>
            <ExternalLink className="h-3 w-3 transition-transform duration-300 group-hover/link:translate-x-0.5" />
          </a>
        ) : !isAvailable ? (
          <span className="text-xs text-muted-foreground/70 font-medium">Coming Soon</span>
        ) : null}
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
            Explore the Full Set of Powerful Features
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Everything you need to build, deploy, and scale production-ready AI agents
          </p>
        </div>

        {/* Available Features */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <h3 className="text-2xl font-semibold">Available Now</h3>
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground font-medium">
              {availableFeatures.length} features
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableFeatures.map((feature, index) => (
              <FeatureCard key={index} feature={feature} />
            ))}
          </div>
        </div>

        {/* Coming Soon Features */}
        <div>
          <div className="flex items-center gap-3 mb-8">
            <h3 className="text-2xl font-semibold">Coming Soon</h3>
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground font-medium">
              {comingSoonFeatures.length} features
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {comingSoonFeatures.map((feature, index) => (
              <FeatureCard key={index} feature={feature} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
