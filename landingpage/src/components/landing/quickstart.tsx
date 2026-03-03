'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Sparkles, ArrowRight, Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HighlightedCode } from '@/components/ui/highlighted-code'

type Lang = 'python' | 'typescript'

interface TabSnippet {
  filename: string
  language: Lang
  code: string
  install: string
}

interface Tab {
  id: string
  label: string
  Icon: typeof Sparkles
  dotColor: string
  headerDotColor: string
  activeColor: string
  description: string
  docsUrl: string
  snippets: Record<Lang, TabSnippet>
}

const TABS: Tab[] = [
  {
    id: 'skill-memory',
    label: 'Skill Memory',
    Icon: Sparkles,
    dotColor: 'bg-emerald-400',
    headerDotColor: 'bg-emerald-500/60',
    activeColor: 'border-emerald-500 text-emerald-400',
    description:
      'Create a learning space, attach a session, and Acontext builds skill files from successful runs.',
    docsUrl: 'https://docs.acontext.app/learn/quick',
    snippets: {
      python: {
        filename: 'skill_memory.py',
        language: 'python',
        install: 'pip install acontext',
        code: `from acontext import AcontextClient

client = AcontextClient(api_key="sk-ac-...")

# Create a learning space and attach a session
space = client.learning_spaces.create()
session = client.sessions.create()
client.learning_spaces.learn(space.id, session_id=session.id)

# Run your agent, store messages — when tasks complete, learning runs automatically
client.sessions.store_message(session.id, blob={"role": "user", "content": "My name is Gus"})
# ... agent runs ...

# List and read learned skills (Markdown files)
client.learning_spaces.wait_for_learning(space.id, session_id=session.id)
skills = client.learning_spaces.list_skills(space.id)`,
      },
      typescript: {
        filename: 'skill_memory.ts',
        language: 'typescript',
        install: 'npm install @acontext/acontext',
        code: `import { AcontextClient } from "@acontext/acontext"

const client = new AcontextClient({ apiKey: "sk-ac-..." })

// Create a learning space and attach a session
const space = await client.learningSpaces.create()
const session = await client.sessions.create()
await client.learningSpaces.learn({
  spaceId: space.id, sessionId: session.id
})

// Run your agent, store messages — when tasks complete, learning runs automatically
await client.sessions.storeMessage(session.id,
  { role: "user", content: "My name is Gus" }
)
// ... agent runs ...

// List and read learned skills (Markdown files)
await client.learningSpaces.waitForLearning({
  spaceId: space.id, sessionId: session.id
})
const skills = await client.learningSpaces.listSkills(space.id)`,
      },
    },
  },
]

const LANGUAGES: { id: Lang; label: string }[] = [
  { id: 'python', label: 'Python' },
  { id: 'typescript', label: 'TypeScript' },
]

function InlineCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'absolute right-3 top-3 z-10 rounded-lg p-2',
        'transition-all duration-200',
        'bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground',
        'sm:opacity-0 sm:group-hover/code:opacity-100',
        copied && 'text-green-500 hover:text-green-500 sm:opacity-100',
      )}
      aria-label={copied ? 'Copied!' : 'Copy code'}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  )
}

export function Quickstart() {
  const [lang, setLang] = useState<Lang>('python')
  const tab = TABS[0]
  const snippet = tab.snippets[lang]

  return (
    <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] mx-auto">
        {/* Header */}
        <div className="text-center space-y-3 sm:space-y-4 mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
            Get Started in Minutes
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto">
            An{' '}
            <a
              href="https://dash.acontext.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:text-primary/80 transition-colors underline underline-offset-2"
            >
              Acontext API key
            </a>
            {' '}and{' '}
            <code className="text-xs sm:text-sm font-mono bg-muted/50 px-2 py-0.5 rounded border border-border/50">
              {snippet.install}
            </code>
            {' '}&mdash; that&apos;s all you need.
          </p>
          <div className="flex items-center justify-center pt-1">
            <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
              {LANGUAGES.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLang(l.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-200',
                    lang === l.id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Two-column layout: left description + right code */}
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr] gap-6 max-w-4xl mx-auto">
          {/* Left column — description */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-medium border border-emerald-500 text-emerald-400 bg-card shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <tab.Icon className="h-4 w-4 shrink-0 hidden sm:block" />
              <span className="truncate">{tab.label}</span>
            </div>

            <div className="hidden md:block px-1 space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {tab.description}
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                List and read learned skills as Markdown — use them in your agent with get_skill / get_skill_file.
              </p>
              <div className="flex flex-col gap-2">
                <a
                  href="https://docs.acontext.app/learn/quick"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  What is skill memory?
                  <ArrowRight className="h-3 w-3" />
                </a>
                <a
                  href="https://docs.acontext.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Read the docs
                  <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Right column — code panel */}
          <div className="group/code rounded-xl border border-border bg-card overflow-hidden flex flex-col">
            {/* File tab header */}
            <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center">
              <div className="flex items-center gap-2">
                <div className={cn('w-3 h-3 rounded-full', tab.headerDotColor)} />
                <span className="text-sm font-medium text-foreground font-mono">
                  {snippet.filename}
                </span>
              </div>
            </div>

            {/* Code content area */}
            <div className="relative flex-1">
              <InlineCopyButton code={snippet.code} />

              <AnimatePresence mode="wait">
                <motion.div
                  key={`${tab.id}-${lang}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="py-4 overflow-x-auto"
                >
                  <div className="px-4 min-w-fit">
                    <HighlightedCode
                      code={snippet.code}
                      language={snippet.language}
                      className="[&_code]:text-xs sm:[&_code]:text-sm"
                    />
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Mobile-only description — below code panel */}
          <div className="flex md:hidden items-start justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {tab.description}
            </p>
            <a
              href={tab.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
              Docs
              <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
