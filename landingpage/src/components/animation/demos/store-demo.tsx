'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Database,
  Upload,
  Search,
  ArrowRightLeft,
  FileText,
  MessageSquare,
  HardDrive,
  FolderOpen,
  Check,
  Image,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ToolCallLog, ProviderBadge, useTypingAnimation } from './shared'

// ─── Timeline stages ────────────────────────────────────────────────────────

type Stage =
  | 'init'
  // Messages tab
  | 'user-msg'
  | 'assistant-msg'
  | 'stored'
  | 'switch-provider'
  | 'retrieved'
  | 'user-msg-2'
  | 'assistant-msg-2'
  // Disk tab
  | 'switch-disk'
  | 'file-upload'
  | 'uploaded'
  | 'file-upload-2'
  | 'uploaded-2'
  | 'glob-search'
  | 'found'

const TIMELINE: Record<Stage, number> = {
  'init': 0,
  'user-msg': 400,
  'assistant-msg': 1600,
  'stored': 3200,
  'switch-provider': 4400,
  'retrieved': 5400,
  'user-msg-2': 6200,
  'assistant-msg-2': 7400,
  'switch-disk': 9800,
  'file-upload': 10200,
  'uploaded': 11200,
  'file-upload-2': 11700,
  'uploaded-2': 12500,
  'glob-search': 13000,
  'found': 13500,
}

const STAGES: Stage[] = Object.keys(TIMELINE) as Stage[]

// ─── Tool call definitions ──────────────────────────────────────────────────

const TOOL_CALLS = [
  {
    id: '1',
    message: 'Stored 2 messages (OpenAI format)',
    label: 'Sessions',
    icon: Database,
  },
  {
    id: '2',
    message: 'Retrieved in Anthropic format',
    label: 'Sessions',
    icon: ArrowRightLeft,
  },
  {
    id: '3',
    message: 'Stored 2 messages (Anthropic format)',
    label: 'Sessions',
    icon: Database,
  },
  {
    id: '4',
    message: 'Uploaded report.pdf to /docs/',
    label: 'Disk',
    icon: Upload,
  },
  {
    id: '5',
    message: 'Uploaded screenshot.png to /assets/',
    label: 'Disk',
    icon: Upload,
  },
  {
    id: '6',
    message: 'Found 4 matching artifacts',
    label: 'Disk',
    icon: Search,
  },
]

const STAGE_TO_LOG_COUNT: Record<Stage, number> = {
  'init': 0,
  'user-msg': 0,
  'assistant-msg': 0,
  'stored': 1,
  'switch-provider': 1,
  'retrieved': 2,
  'user-msg-2': 2,
  'assistant-msg-2': 3,
  'switch-disk': 3,
  'file-upload': 3,
  'uploaded': 4,
  'file-upload-2': 4,
  'uploaded-2': 5,
  'glob-search': 5,
  'found': 6,
}

// ─── Chat message component ────────────────────────────────────────────────

function ChatMessage({
  role,
  content,
  typing = false,
}: {
  role: 'user' | 'assistant'
  content: string
  typing?: boolean
}) {
  const isUser = role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="flex gap-2 sm:gap-3"
    >
      <div
        className={cn(
          'w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] sm:text-xs font-bold',
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-emerald-600 text-white',
        )}
      >
        {isUser ? 'U' : 'A'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 mb-0.5">
          {isUser ? 'User' : 'Assistant'}
        </p>
        <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          {content}
          {typing && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
              className="text-emerald-500 ml-0.5"
            >
              |
            </motion.span>
          )}
        </p>
      </div>
    </motion.div>
  )
}

// ─── Format conversion indicator ─────────────────────────────────────────────

function FormatIndicator({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center justify-center gap-1.5 py-1.5"
    >
      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1 px-2">
        <Check className="w-3 h-3 text-emerald-500" />
        {text}
      </span>
      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
    </motion.div>
  )
}

// ─── Upload file card ────────────────────────────────────────────────────────

function UploadCard({
  name,
  size,
  icon: Icon,
  stored = false,
}: {
  name: string
  size: string
  icon: React.ComponentType<{ className?: string }>
  stored?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-dashed border-zinc-300 dark:border-zinc-700 p-2 sm:p-3 rounded"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
        <span className="text-xs text-zinc-600 dark:text-zinc-400">{name}</span>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-600">{size}</span>
        <AnimatePresence>
          {stored && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="ml-auto text-emerald-500 text-[10px] flex items-center gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Stored
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {/* Progress bar */}
      <div className="mt-2 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: stored ? '100%' : '60%' }}
          transition={{ duration: stored ? 0.3 : 1.5, ease: 'easeOut' }}
          className={cn(
            'h-full rounded-full',
            stored ? 'bg-emerald-500' : 'bg-blue-500',
          )}
        />
      </div>
    </motion.div>
  )
}

// ─── File list component ────────────────────────────────────────────────────

function FileList() {
  const files = [
    { name: 'report.pdf', size: '2.4 MB', path: '/docs/' },
    { name: 'screenshot.png', size: '840 KB', path: '/assets/' },
    { name: 'analysis.md', size: '18 KB', path: '/docs/' },
    { name: 'summary.md', size: '4 KB', path: '/docs/' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-zinc-200 dark:border-zinc-700 bg-zinc-100/50 dark:bg-zinc-900/50 p-2 sm:p-3 rounded"
    >
      <div className="flex items-center gap-2 mb-2">
        <Search className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
        <span className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 font-mono">
          **/*.md, **/*.pdf, **/*.png
        </span>
      </div>
      <div className="space-y-1">
        {files.map((file, i) => (
          <motion.div
            key={file.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12 }}
            className="flex items-center gap-2 text-xs"
          >
            <FileText className="w-3 h-3 text-zinc-400 dark:text-zinc-500 shrink-0" />
            <span className="text-zinc-500 dark:text-zinc-600 text-[10px] font-mono shrink-0">
              {file.path}
            </span>
            <span className="text-zinc-700 dark:text-zinc-300 truncate">{file.name}</span>
            <span className="text-zinc-400 dark:text-zinc-600 ml-auto text-[10px] shrink-0">{file.size}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Main Store Demo ────────────────────────────────────────────────────────

export function StoreDemo() {
  const [stage, setStage] = useState<Stage>('init')
  const [logCount, setLogCount] = useState(0)
  const [provider, setProvider] = useState<'openai' | 'anthropic'>('openai')
  const [activeTab, setActiveTab] = useState<'messages' | 'disk'>('messages')

  const assistantText = useTypingAnimation(
    "I'll analyze the Q4 revenue data and prepare a summary report...",
    stage === 'assistant-msg' || STAGES.indexOf(stage) > STAGES.indexOf('assistant-msg'),
    40,
  )

  const assistantText2 = useTypingAnimation(
    'Based on the previous analysis, Q4 revenue grew 23% YoY driven by enterprise deals...',
    stage === 'assistant-msg-2' || STAGES.indexOf(stage) > STAGES.indexOf('assistant-msg-2'),
    28,
  )

  // Drive timeline
  useEffect(() => {
    setStage('init')
    setLogCount(0)
    setProvider('openai')
    setActiveTab('messages')

    const timers: ReturnType<typeof setTimeout>[] = []

    for (const [s, delay] of Object.entries(TIMELINE)) {
      if (delay > 0) {
        timers.push(
          setTimeout(() => {
            const st = s as Stage
            setStage(st)
            setLogCount(STAGE_TO_LOG_COUNT[st])
            if (st === 'switch-provider' || STAGES.indexOf(st) >= STAGES.indexOf('switch-provider')) {
              setProvider('anthropic')
            }
            // Auto-switch to Disk tab when disk operations begin
            if (STAGES.indexOf(st) >= STAGES.indexOf('switch-disk')) {
              setActiveTab('disk')
            }
          }, delay),
        )
      }
    }

    return () => timers.forEach(clearTimeout)
  }, [])

  const stageIdx = STAGES.indexOf(stage)

  // Messages tab flags
  const showUserMsg = stageIdx >= STAGES.indexOf('user-msg')
  const showAssistantMsg = stageIdx >= STAGES.indexOf('assistant-msg')
  const showStored = stageIdx >= STAGES.indexOf('stored')
  const showSwitchProvider = stageIdx >= STAGES.indexOf('switch-provider')
  const showRetrieved = stageIdx >= STAGES.indexOf('retrieved')
  const showUserMsg2 = stageIdx >= STAGES.indexOf('user-msg-2')
  const showAssistantMsg2 = stageIdx >= STAGES.indexOf('assistant-msg-2')

  // Disk tab flags
  const showFileUpload = stageIdx >= STAGES.indexOf('file-upload')
  const showUploaded = stageIdx >= STAGES.indexOf('uploaded')
  const showFileUpload2 = stageIdx >= STAGES.indexOf('file-upload-2')
  const showUploaded2 = stageIdx >= STAGES.indexOf('uploaded-2')
  const showGlob = stageIdx >= STAGES.indexOf('glob-search')

  return (
    <div className="h-full flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-4">
        {/* Left: Chat / Storage interface */}
        <div className="flex-3 min-w-0">
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl">
            {/* Tab bar */}
            <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-2">
              {/* Messages tab */}
              <div
                className={cn(
                  'relative flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm transition-colors',
                  activeTab === 'messages'
                    ? 'text-zinc-900 dark:text-white'
                    : 'text-zinc-400 dark:text-zinc-500',
                )}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Messages</span>
                {activeTab === 'messages' && (
                  <motion.div
                    layoutId="store-tab-indicator"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-500"
                  />
                )}
              </div>

              {/* Disk tab */}
              <div
                className={cn(
                  'relative flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm transition-colors',
                  activeTab === 'disk'
                    ? 'text-zinc-900 dark:text-white'
                    : 'text-zinc-400 dark:text-zinc-500',
                )}
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Disk</span>
                {activeTab === 'disk' && (
                  <motion.div
                    layoutId="store-tab-indicator"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-500"
                  />
                )}
              </div>

              {/* Provider badge (only in Messages tab) */}
              {activeTab === 'messages' && (
                <div className="ml-auto flex items-center gap-2 pr-2">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={provider}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ProviderBadge provider={provider} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}

              {/* Path indicator (only in Disk tab) */}
              {activeTab === 'disk' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="ml-auto flex items-center gap-1.5 pr-2"
                >
                  <FolderOpen className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
                  <span className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 font-mono">
                    /workspace
                  </span>
                </motion.div>
              )}
            </div>

            {/* Content area */}
            <div className="bg-white dark:bg-zinc-950 min-h-[220px] sm:min-h-[280px] lg:min-h-[340px] p-3 sm:p-4 overflow-y-auto max-h-[360px]">
              <AnimatePresence mode="wait">
                {activeTab === 'messages' ? (
                  /* Messages tab content */
                  <motion.div
                    key="messages"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3 sm:space-y-4"
                  >
                    <AnimatePresence>
                      {showUserMsg && (
                        <ChatMessage
                          key="user"
                          role="user"
                          content="Analyze Q4 revenue data and prepare a summary"
                        />
                      )}
                      {showAssistantMsg && (
                        <ChatMessage
                          key="assistant"
                          role="assistant"
                          content={assistantText}
                          typing={stage === 'assistant-msg'}
                        />
                      )}
                      {showStored && !showSwitchProvider && (
                        <FormatIndicator key="stored-indicator" text="Stored in OpenAI format" />
                      )}
                      {showRetrieved && (
                        <FormatIndicator key="retrieved-indicator" text="Retrieved in Anthropic format" />
                      )}
                      {showUserMsg2 && (
                        <ChatMessage
                          key="user-2"
                          role="user"
                          content="What were the key takeaways from that analysis?"
                        />
                      )}
                      {showAssistantMsg2 && (
                        <ChatMessage
                          key="assistant-2"
                          role="assistant"
                          content={assistantText2}
                          typing={stage === 'assistant-msg-2'}
                        />
                      )}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  /* Disk tab content */
                  <motion.div
                    key="disk"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3 sm:space-y-4"
                  >
                    {/* File uploads */}
                    <AnimatePresence>
                      {showFileUpload && (
                        <UploadCard
                          key="upload-1"
                          name="report.pdf"
                          size="2.4 MB"
                          icon={FileText}
                          stored={showUploaded}
                        />
                      )}
                      {showFileUpload2 && (
                        <UploadCard
                          key="upload-2"
                          name="screenshot.png"
                          size="840 KB"
                          icon={Image}
                          stored={showUploaded2}
                        />
                      )}
                    </AnimatePresence>

                    {/* Glob search results */}
                    <AnimatePresence>
                      {showGlob && <FileList key="filelist" />}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right: Tool call log */}
        <div className="hidden sm:flex flex-2 min-w-0 flex-col justify-center">
          <ToolCallLog calls={TOOL_CALLS.slice(0, logCount)} />
        </div>
      </div>
    </div>
  )
}
