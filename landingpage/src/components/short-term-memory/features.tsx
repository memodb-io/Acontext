'use client'

import {
  Repeat,
  Scissors,
  FileText,
  Search,
  FileUp,
  Wrench,
  BookOpen,
  FolderTree,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { HighlightedCode } from '@/components/ui/highlighted-code'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
  example: {
    title: string
    code: string
  }
}

interface FeatureGroup {
  label: string
  color: string
  bgColor: string
  borderColor: string
  dotColor: string
  features: Feature[]
}

const groups: FeatureGroup[] = [
  {
    label: 'Messages',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    dotColor: 'bg-blue-400',
    features: [
      {
        icon: Repeat,
        title: 'Multi-Provider Format',
        description:
          'Store messages once, retrieve in OpenAI, Anthropic, or Gemini format. Switch providers without rewriting serialization logic.',
        example: {
          title: 'Multi-format retrieval',
          code: `# Store in any format
session.store_message(blob={...})

# Retrieve in OpenAI format
get_messages(format="openai")
# Retrieve in Anthropic format
get_messages(format="anthropic")`,
        },
      },
      {
        icon: Scissors,
        title: 'Edit Strategies',
        description:
          'Manage context window size with composable edit strategies. Remove old tool results, trim by token limit, or apply custom rules.',
        example: {
          title: 'Edit strategies',
          code: `edit_strategies=[
  {"type": "remove_tool_result",
   "params": {"keep_recent_n": 3}},
  {"type": "token_limit",
   "params": {"limit_tokens": 30000}}
]`,
        },
      },
      {
        icon: FileText,
        title: 'Session Summaries',
        description:
          'Get token-efficient summaries of any session for prompt injection. Maintain context without blowing up your token budget.',
        example: {
          title: 'Session summary',
          code: `# Summarize recent turns
summary = client.sessions
  .get_session_summary(
    session.id, limit=5)

# Inject into new prompt
system_msg = f"Context: {summary}"`,
        },
      },
    ],
  },
  {
    label: 'Disk Storage',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    dotColor: 'bg-amber-400',
    features: [
      {
        icon: FileUp,
        title: 'File Upload & Download',
        description:
          'Upload any file with paths and metadata. Generate secure, time-limited download URLs for sharing artifacts.',
        example: {
          title: 'Upload a file',
          code: `artifact = client.disks.artifacts
  .upsert(disk.id,
    file=FileUpload(
      filename="report.md",
      content=b"# Report"),
    file_path="/docs/")`,
        },
      },
      {
        icon: Search,
        title: 'Grep & Glob Search',
        description:
          'Search file contents with regex via grep, or find files by path patterns with glob. Full codebase-style search for your agent\'s files.',
        example: {
          title: 'Search files',
          code: `# Regex search in contents
client.disks.artifacts
  .grep_artifacts(disk.id,
    query="TODO.*")

# Glob pattern matching
  .glob_artifacts(disk.id,
    pattern="**/*.md")`,
        },
      },
      {
        icon: Wrench,
        title: 'Agent Tools',
        description:
          'Pre-built LLM function-calling tools (DISK_TOOLS) let your agents read, write, and search files autonomously.',
        example: {
          title: 'Agent tools',
          code: `from acontext.tools import (
  DISK_TOOLS)

# Give agent file access
tools = DISK_TOOLS(disk.id)
# read_file, write_file,
# search_files, list_files`,
        },
      },
    ],
  },
  {
    label: 'Skill Storage',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    dotColor: 'bg-emerald-400',
    features: [
      {
        icon: FolderTree,
        title: 'Skill Packages',
        description:
          'Upload reusable skill packages as ZIP files with a SKILL.md, scripts, and resources. Agents discover and use them at runtime.',
        example: {
          title: 'Upload a skill',
          code: `skill = client.skills.create(
  file=FileUpload(
    filename="my-skill.zip",
    content=f.read()),
  meta={"version": "1.0"})

print(skill.name, skill.id)`,
        },
      },
      {
        icon: BookOpen,
        title: 'Catalog & File Access',
        description:
          'Browse the skill catalog, inspect file indexes, and read any file — text content returned inline, binary files via presigned URLs.',
        example: {
          title: 'Browse & read skills',
          code: `catalog = client.skills
  .list_catalog()

skill = client.skills.get(skill_id)
for f in skill.file_index:
  result = client.skills
    .get_file(skill.id, f.path)
  print(result.content.raw)`,
        },
      },
      {
        icon: Wrench,
        title: 'Skill Tools for Agents',
        description:
          'Pre-built SKILL_TOOLS let LLMs read skill content via function calling, or mount skills in a sandbox to execute scripts directly.',
        example: {
          title: 'Agent skill tools',
          code: `from acontext.agent.skill \\
  import SKILL_TOOLS

ctx = SKILL_TOOLS.format_context(
  client, skill_ids)
tools = SKILL_TOOLS
  .to_openai_tool_schema()`,
        },
      },
    ],
  },
]

function FeatureCard({ feature, group }: { feature: Feature; group: FeatureGroup }) {
  return (
    <div
      className={`rounded-xl border ${group.borderColor} bg-card p-6 flex flex-col gap-5 transition-all duration-200 hover:shadow-lg hover:shadow-black/5`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg ${group.bgColor} flex items-center justify-center`}
        >
          <feature.icon className={`h-5 w-5 ${group.color}`} />
        </div>
        <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>

      <div className="mt-auto rounded-lg bg-muted/50 border border-border/50 overflow-hidden flex flex-col">
        <div className="px-3 py-1.5 border-b border-border/50 text-muted-foreground/70 bg-muted/30 text-xs font-mono">
          {feature.example.title}
        </div>
        <div className="py-2 overflow-x-auto flex-1">
          <div className="px-3 min-w-fit">
            <HighlightedCode code={feature.example.code} language="python" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function Features() {
  return (
    <section className="w-full py-20">
      <div className="w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] mx-auto px-4">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">Core Capabilities</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Three storage pillars for complete agent state management — messages, files, and
            learned skills.
          </p>
        </div>

        <div className="space-y-16">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="flex items-center gap-3 mb-6">
                <span className={`w-2.5 h-2.5 rounded-full ${group.dotColor}`} />
                <h3 className="text-xl font-semibold text-foreground">{group.label}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {group.features.map((feat) => (
                  <FeatureCard key={feat.title} feature={feat} group={group} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
