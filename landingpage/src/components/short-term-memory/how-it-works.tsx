'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { HighlightedCode } from '@/components/ui/highlighted-code'
import { cn } from '@/lib/utils'

interface Step {
  number: string
  title: string
  description: string
  color: string
}

interface TabConfig {
  id: string
  label: string
  dotColor: string
  activeColor: string
  steps: Step[]
  leftPanel: { filename: string; dotColor: string; code: string }
  rightPanel: { filename: string; dotColor: string; code: string }
}

const tabs: TabConfig[] = [
  {
    id: 'messages',
    label: 'Messages',
    dotColor: 'bg-blue-400',
    activeColor: 'border-blue-500 text-blue-400',
    steps: [
      { number: '1', title: 'Create Session', description: 'Initialize a session to scope your agent\'s context.', color: 'bg-blue-500' },
      { number: '2', title: 'Store Messages', description: 'Persist messages in any provider format.', color: 'bg-violet-500' },
      { number: '3', title: 'Retrieve & Transform', description: 'Get messages in any format with edit strategies.', color: 'bg-cyan-500' },
      { number: '4', title: 'Optimize & Resume', description: 'Summarize, trim, and continue sessions.', color: 'bg-emerald-500' },
    ],
    leftPanel: {
      filename: 'store.py',
      dotColor: 'bg-blue-500/60',
      code: `from acontext import AcontextClient

client = AcontextClient()

# Create a session
session = client.sessions.create(
    project_id="my-project"
)

# Store messages (any provider format)
client.sessions.store_message(
    session.id,
    blob={"role": "user", "content": "Hello!"}
)
client.sessions.store_message(
    session.id,
    blob={"role": "assistant", "content": "Hi!"}
)`,
    },
    rightPanel: {
      filename: 'retrieve.py',
      dotColor: 'bg-cyan-500/60',
      code: `# Retrieve in OpenAI format
messages = client.sessions.get_messages(
    session.id, format="openai"
)

# Retrieve in Anthropic format
messages = client.sessions.get_messages(
    session.id, format="anthropic"
)

# Apply edit strategies
result = client.sessions.get_messages(
    session.id,
    edit_strategies=[
        {"type": "remove_tool_result",
         "params": {"keep_recent_n_tool_results": 3}},
        {"type": "token_limit",
         "params": {"limit_tokens": 30000}}
    ]
)
print(f"Tokens used: {result.this_time_tokens}")`,
    },
  },
  {
    id: 'disk',
    label: 'Disk Storage',
    dotColor: 'bg-amber-400',
    activeColor: 'border-amber-500 text-amber-400',
    steps: [
      { number: '1', title: 'Create Disk', description: 'Initialize an S3-backed disk for your agent.', color: 'bg-amber-500' },
      { number: '2', title: 'Upload Files', description: 'Store files with paths and metadata.', color: 'bg-orange-500' },
      { number: '3', title: 'Search & Retrieve', description: 'Grep contents or glob by path patterns.', color: 'bg-cyan-500' },
      { number: '4', title: 'Agent Tools', description: 'Give your agent autonomous file access.', color: 'bg-emerald-500' },
    ],
    leftPanel: {
      filename: 'upload.py',
      dotColor: 'bg-amber-500/60',
      code: `from acontext import AcontextClient, FileUpload

client = AcontextClient()

# Create a disk
disk = client.disks.create()

# Upload files with paths and metadata
artifact = client.disks.artifacts.upsert(
    disk.id,
    file=FileUpload(
        filename="notes.md",
        content=b"# Meeting Notes\\n- Discussed API"
    ),
    file_path="/documents/",
    meta={"author": "alice", "type": "notes"}
)

# Get a secure download URL
url = artifact.public_url`,
    },
    rightPanel: {
      filename: 'search.py',
      dotColor: 'bg-cyan-500/60',
      code: `# Regex search across file contents
results = client.disks.artifacts.grep_artifacts(
    disk.id,
    query="TODO.*fix"
)
for match in results:
    print(f"{match.file_path}: {match.line}")

# Find files by path pattern
files = client.disks.artifacts.glob_artifacts(
    disk.id,
    pattern="**/*.md"
)

# List files in a directory
artifacts = client.disks.artifacts.list(
    disk.id,
    file_path="/documents/"
)`,
    },
  },
  {
    id: 'skill',
    label: 'Skill Storage',
    dotColor: 'bg-emerald-400',
    activeColor: 'border-emerald-500 text-emerald-400',
    steps: [
      { number: '1', title: 'Upload Skill', description: 'Upload a ZIP with SKILL.md and resources.', color: 'bg-emerald-500' },
      { number: '2', title: 'Browse Catalog', description: 'Discover available skills by name.', color: 'bg-teal-500' },
      { number: '3', title: 'Read Files', description: 'Access any file — text or binary URLs.', color: 'bg-cyan-500' },
      { number: '4', title: 'Agent Tools', description: 'LLMs use skills via function calling.', color: 'bg-blue-500' },
    ],
    leftPanel: {
      filename: 'upload.py',
      dotColor: 'bg-emerald-500/60',
      code: `from acontext import AcontextClient, FileUpload

client = AcontextClient()

# Upload a skill package
with open("my-skill.zip", "rb") as f:
    skill = client.skills.create(
        file=FileUpload(
            filename="my-skill.zip",
            content=f.read()
        ),
        meta={"version": "1.0"}
    )
print(f"Created: {skill.name} ({skill.id})")

# Browse the skill catalog
catalog = client.skills.list_catalog()
for item in catalog.items:
    print(f"{item.name}: {item.description}")`,
    },
    rightPanel: {
      filename: 'use_skill.py',
      dotColor: 'bg-cyan-500/60',
      code: `# Read skill files
skill = client.skills.get(skill_id)
for f in skill.file_index:
    print(f"{f.path} ({f.mime})")

result = client.skills.get_file(
    skill_id=skill.id, file_path="SKILL.md"
)
print(result.content.raw)

# Give an LLM access to skills
from acontext.agent.skill import SKILL_TOOLS

ctx = SKILL_TOOLS.format_context(
    client, [skill.id]
)
tools = SKILL_TOOLS.to_openai_tool_schema()
prompt = ctx.get_context_prompt()`,
    },
  },
]

export function HowItWorks() {
  const [activeTab, setActiveTab] = useState('messages')
  const active = tabs.find((t) => t.id === activeTab)!

  return (
    <section className="w-full py-20">
      <div className="w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] mx-auto px-4">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold">How It Works</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Pick a storage type to see the workflow and code examples.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center justify-center gap-1 mb-12">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                'border',
                activeTab === tab.id
                  ? `${tab.activeColor} bg-card shadow-sm`
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  activeTab === tab.id ? tab.dotColor : 'bg-muted-foreground/30',
                )}
              />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Steps */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-0 mb-16">
          {active.steps.map((step, i) => (
            <div key={step.number} className="flex items-center">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card min-w-[200px]">
                <div
                  className={`w-8 h-8 rounded-full ${step.color} flex items-center justify-center text-white text-sm font-bold shrink-0`}
                >
                  {step.number}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{step.title}</div>
                  <div className="text-xs text-muted-foreground">{step.description}</div>
                </div>
              </div>
              {i < active.steps.length - 1 && (
                <ArrowRight className="h-5 w-5 text-muted-foreground/40 mx-2 hidden md:block shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Code panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${active.leftPanel.dotColor}`} />
              <span className="text-sm font-medium text-foreground font-mono">
                {active.leftPanel.filename}
              </span>
            </div>
            <div className="py-4 overflow-x-auto flex-1">
              <div className="px-4 min-w-fit">
                <HighlightedCode code={active.leftPanel.code} language="python" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${active.rightPanel.dotColor}`} />
              <span className="text-sm font-medium text-foreground font-mono">
                {active.rightPanel.filename}
              </span>
            </div>
            <div className="py-4 overflow-x-auto flex-1">
              <div className="px-4 min-w-fit">
                <HighlightedCode code={active.rightPanel.code} language="python" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
