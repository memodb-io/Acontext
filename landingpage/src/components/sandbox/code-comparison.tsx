'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

export interface CodeComparisonProps {
  leftTitle: string
  rightTitle: string
  leftLabel?: string
  rightLabel?: string
  leftCode: string
  rightCode: string
  leftLanguage?: string
  rightLanguage?: string
}

export function CodeComparisonCard({
  leftTitle,
  rightTitle,
  leftLabel = 'Before',
  rightLabel = 'After',
  leftCode,
  rightCode,
  leftLanguage = 'python',
  rightLanguage = 'python',
}: CodeComparisonProps) {
  const [mobileTab, setMobileTab] = useState<'left' | 'right'>('right') // Default to Acontext
  const [leftHtml, setLeftHtml] = useState<{ light: string; dark: string } | null>(null)
  const [rightHtml, setRightHtml] = useState<{ light: string; dark: string } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fixed divider position - acontext (right) side is always expanded
  const dividerPosition = '40%'

  // Highlight code with shiki
  useEffect(() => {
    const langMap: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      tsx: 'tsx',
      jsx: 'jsx',
      sh: 'bash',
      shell: 'bash',
      yml: 'yaml',
      md: 'markdown',
      plaintext: 'text',
    }

    const highlightCode = async (code: string, language: string) => {
      const { codeToHtml } = await import('shiki')
      const lang = langMap[language] || language

      try {
        const [light, dark] = await Promise.all([
          codeToHtml(code.trim(), { lang, theme: 'github-light-default' }),
          codeToHtml(code.trim(), { lang, theme: 'github-dark-default' }),
        ])
        return { light, dark }
      } catch {
        const [light, dark] = await Promise.all([
          codeToHtml(code.trim(), { lang: 'text', theme: 'github-light-default' }),
          codeToHtml(code.trim(), { lang: 'text', theme: 'github-dark-default' }),
        ])
        return { light, dark }
      }
    }

    Promise.all([
      highlightCode(leftCode, leftLanguage),
      highlightCode(rightCode, rightLanguage),
    ]).then(([left, right]) => {
      setLeftHtml(left)
      setRightHtml(right)
    })
  }, [leftCode, rightCode, leftLanguage, rightLanguage])

  // Render code content helper
  const renderCodeContent = (
    html: { light: string; dark: string } | null,
    code: string,
    isRight: boolean,
  ) => (
    <div className={cn('p-4 text-sm', !isRight && 'opacity-80')}>
      {html ? (
        <>
          <div
            className="block dark:hidden [&_pre]:bg-transparent! [&_code]:text-xs"
            dangerouslySetInnerHTML={{ __html: html.light }}
          />
          <div
            className="hidden dark:block [&_pre]:bg-transparent! [&_code]:text-xs"
            dangerouslySetInnerHTML={{ __html: html.dark }}
          />
        </>
      ) : (
        <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
          {code.trim()}
        </pre>
      )}
    </div>
  )

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl overflow-hidden border border-border/50 bg-card/30 backdrop-blur"
    >
      {/* Mobile Tab Header */}
      <div className="flex lg:hidden border-b border-border/50">
        <button
          onClick={() => setMobileTab('left')}
          className={cn(
            'flex-1 px-3 sm:px-4 py-3 flex items-center justify-center gap-2 transition-all duration-300',
            mobileTab === 'left' ? 'bg-muted/30' : 'bg-muted/10',
          )}
        >
          <span
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full transition-colors shrink-0',
              mobileTab === 'left'
                ? 'bg-muted-foreground/20 text-foreground'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {leftLabel}
          </span>
          <span
            className={cn(
              'hidden sm:inline text-sm font-medium truncate transition-colors',
              mobileTab === 'left' ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {leftTitle}
          </span>
        </button>
        <div className="w-px bg-border/50" />
        <button
          onClick={() => setMobileTab('right')}
          className={cn(
            'flex-1 px-3 sm:px-4 py-3 flex items-center justify-center gap-2 transition-all duration-300',
            mobileTab === 'right'
              ? 'bg-linear-to-r from-primary/10 to-primary/15'
              : 'bg-linear-to-r from-primary/5 to-primary/5',
          )}
        >
          <span
            className={cn(
              'relative text-xs font-semibold px-2.5 py-0.5 rounded-full overflow-hidden transition-colors shrink-0',
              mobileTab === 'right'
                ? 'bg-primary text-primary-foreground'
                : 'bg-primary/20 text-primary',
            )}
          >
            <span className="relative z-10">{rightLabel}</span>
            {mobileTab === 'right' && (
              <span className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
            )}
          </span>
          <span
            className={cn(
              'hidden sm:inline text-sm font-semibold truncate transition-colors',
              mobileTab === 'right' ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {rightTitle}
          </span>
        </button>
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:flex border-b border-border/50">
        <div
          className="flex-1 px-4 py-3 flex items-center gap-2 transition-all duration-300 bg-muted/20"
          style={{ flexBasis: dividerPosition }}
        >
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {leftLabel}
          </span>
          <span className="text-sm font-medium text-muted-foreground truncate">{leftTitle}</span>
        </div>
        <div className="w-px bg-border/50" />
        <div
          className={cn(
            'flex-1 px-4 py-3 flex items-center gap-2 transition-all duration-300',
            'bg-linear-to-r from-primary/5 to-primary/10',
          )}
          style={{ flexBasis: `calc(100% - ${dividerPosition})` }}
        >
          <span className="relative text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground overflow-hidden">
            <span className="relative z-10">{rightLabel}</span>
            <span className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
          </span>
          <span className="text-sm font-semibold text-foreground truncate">{rightTitle}</span>
        </div>
      </div>

      {/* Mobile Code Panel */}
      <div className="lg:hidden min-h-[350px] max-h-[500px] overflow-auto">
        {mobileTab === 'left' ? (
          <div className="bg-muted/10">{renderCodeContent(leftHtml, leftCode, false)}</div>
        ) : (
          <div className="relative bg-linear-to-br from-primary/5 via-primary/10 to-primary/5">
            <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-primary/5 opacity-50" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
            <div className="relative z-10">{renderCodeContent(rightHtml, rightCode, true)}</div>
          </div>
        )}
      </div>

      {/* Desktop Code Panels */}
      <div className="relative hidden lg:flex min-h-[400px]">
        {/* Left panel - muted background, non-interactive */}
        <div
          className="overflow-auto transition-all duration-300 ease-out bg-muted/10"
          style={{ width: dividerPosition }}
        >
          {renderCodeContent(leftHtml, leftCode, false)}
        </div>

        {/* Animated divider */}
        <div
          className="absolute top-0 bottom-0 w-px bg-primary/30 transition-all duration-300 ease-out z-10"
          style={{ left: dividerPosition }}
        >
          {/* Glow effect - always visible */}
          <div
            className={cn(
              'absolute inset-0 w-[3px] -translate-x-1/2',
              'bg-linear-to-b from-transparent via-primary to-transparent',
              'opacity-100 blur-[1px]',
            )}
          />
          {/* Animated particles on the divider */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute w-1 h-1 bg-primary rounded-full animate-[float_3s_ease-in-out_infinite]" style={{ top: '20%', left: '-1px' }} />
            <div className="absolute w-1 h-1 bg-primary rounded-full animate-[float_3s_ease-in-out_infinite_0.5s]" style={{ top: '50%', left: '-1px' }} />
            <div className="absolute w-1 h-1 bg-primary rounded-full animate-[float_3s_ease-in-out_infinite_1s]" style={{ top: '80%', left: '-1px' }} />
          </div>
          {/* Divider indicator - always visible */}
          <div
            className={cn(
              'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
              'w-6 h-10 rounded-full bg-background border-2 border-primary/50',
              'flex items-center justify-center',
              'shadow-lg shadow-primary/20',
            )}
          >
            <svg
              className="w-4 h-4 text-primary/70"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        {/* Right panel - highlighted with gradient, always in active state */}
        <div
          className={cn(
            'relative overflow-auto transition-all duration-300 ease-out',
            'bg-linear-to-br from-primary/5 via-primary/10 to-primary/5',
          )}
          style={{ width: `calc(100% - ${dividerPosition})` }}
        >
          {/* Animated gradient overlay */}
          <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-primary/5 opacity-50" />
          {/* Corner glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
          
          <div className="relative z-10">{renderCodeContent(rightHtml, rightCode, true)}</div>
        </div>
      </div>

      {/* Right side glow border effect */}
      <div className="absolute top-0 right-0 bottom-0 w-px bg-linear-to-b from-primary/0 via-primary/50 to-primary/0" />
    </div>
  )
}

// Code examples for sandbox comparison
const skillsComparisonLeft = `# Claude API with Skills - Complex setup
import anthropic

client = anthropic.Anthropic()

# Step 1: Create message with Skills in container
response = client.beta.messages.create(
    model="claude-sonnet-4-5-20250929",
    max_tokens=4096,
    betas=["code-execution-2025-08-25", "skills-2025-10-02"],
    container={
        "skills": [
            {"type": "anthropic", "skill_id": "xlsx", "version": "latest"}
        ]
    },
    messages=[{
        "role": "user",
        "content": "Create an Excel file with a budget spreadsheet"
    }],
    tools=[{"type": "code_execution_20250825", "name": "code_execution"}]
)

# Step 2: Extract file IDs from nested response structure
def extract_file_ids(response):
    file_ids = []
    for item in response.content:
        if item.type == 'bash_code_execution_tool_result':
            content_item = item.content
            if content_item.type == 'bash_code_execution_result':
                for file in content_item.content:
                    if hasattr(file, 'file_id'):
                        file_ids.append(file.file_id)
    return file_ids

# Step 3: Download files using separate Files API
for file_id in extract_file_ids(response):
    file_metadata = client.beta.files.retrieve_metadata(
        file_id=file_id,
        betas=["files-api-2025-04-14"]
    )
    file_content = client.beta.files.download(
        file_id=file_id,
        betas=["files-api-2025-04-14"]
    )
    file_content.write_to_file(file_metadata.filename)`

const skillsComparisonRight = `# Acontext SDK - Simple & unified
from acontext import AcontextClient
from acontext.agent.sandbox import SANDBOX_TOOLS
from openai import OpenAI

client = AcontextClient()
openai = OpenAI()

# Create sandbox with skill mounted
sandbox = client.sandboxes.create()
disk = client.disks.create()

ctx = SANDBOX_TOOLS.format_context(
    client,
    sandbox_id=sandbox.sandbox_id,
    disk_id=disk.id,
    mount_skills=["excel-skill-uuid"]  # Mount any skill
)

# Use with any LLM - OpenAI, Anthropic, etc.
response = openai.chat.completions.create(
    model="gpt-4.1",
    messages=[
        {"role": "system", "content": ctx.get_context_prompt()},
        {"role": "user", "content": "Create an Excel budget spreadsheet"}
    ],
    tools=SANDBOX_TOOLS.to_openai_tool_schema()
)

# Execute tool and get result with download URL
for tc in response.choices[0].message.tool_calls:
    result = SANDBOX_TOOLS.execute_tool(
        ctx, 
        tc.function.name, 
        json.loads(tc.function.arguments)
    )
    # Result includes public_url for downloads`

// Sandbox code comparison component (used on Sandbox page)
export function SandboxCodeComparison() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[768px] lg:max-w-[1200px] mx-auto">
        {/* Section header */}
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">Acontext Skills Execution vs Claude Skills API</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Compare the complexity of traditional approaches with Acontext&apos;s unified SDK
          </p>
        </div>

        {/* Skills & Sandbox comparison */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-center">
            Code Execution & Skills
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-xl mx-auto">
            Execute code in sandboxes and use agent skills without complex beta APIs
          </p>
          <CodeComparisonCard
            leftTitle="Claude API Skills"
            rightTitle="Acontext Sandbox"
            leftLabel="Complex"
            rightLabel="Simple"
            leftCode={skillsComparisonLeft}
            rightCode={skillsComparisonRight}
            leftLanguage="python"
            rightLanguage="python"
          />
        </div>
      </div>
    </section>
  )
}
