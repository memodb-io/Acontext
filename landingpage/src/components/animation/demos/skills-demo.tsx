'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Sparkles,
  Upload,
  Package,
  FileText,
  FolderOpen,
  Play,
  Check,
  Terminal,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ToolCallLog } from './shared'

// ─── Timeline stages ────────────────────────────────────────────────────────

type Stage =
  | 'init'
  | 'show-package'
  | 'uploading'
  | 'uploaded'
  | 'logged-upload'
  | 'catalog'
  | 'logged-catalog'
  | 'sandbox-mount'
  | 'logged-mount'
  | 'executing'
  | 'success'
  | 'logged-success'

const TIMELINE: Record<Stage, number> = {
  'init': 0,
  'show-package': 600,
  'uploading': 1400,
  'uploaded': 2800,
  'logged-upload': 3400,
  'catalog': 4200,
  'logged-catalog': 5000,
  'sandbox-mount': 5800,
  'logged-mount': 6600,
  'executing': 7400,
  'success': 9200,
  'logged-success': 10000,
}

const STAGES: Stage[] = Object.keys(TIMELINE) as Stage[]

// ─── Tool calls ─────────────────────────────────────────────────────────────

const TOOL_CALLS = [
  { id: '1', message: 'Uploaded skill: data-extraction', label: 'Skills', icon: Upload },
  { id: '2', message: 'Skill available in catalog', label: 'Skills', icon: Sparkles },
  { id: '3', message: 'Mounted to sandbox env-42', label: 'Sandbox', icon: Package },
  { id: '4', message: 'Executed successfully', label: 'Skills', icon: Check, iconClassName: 'text-emerald-400' },
]

const STAGE_TO_LOG: Record<Stage, number> = {
  'init': 0, 'show-package': 0, 'uploading': 0,
  'uploaded': 0, 'logged-upload': 1,
  'catalog': 1, 'logged-catalog': 2,
  'sandbox-mount': 2, 'logged-mount': 3,
  'executing': 3, 'success': 3, 'logged-success': 4,
}

// ─── Skill package files ─────────────────────────────────────────────────────

const SKILL_FILES = [
  { name: 'SKILL.md', icon: BookOpen, type: 'instructions' },
  { name: 'scripts/extract.py', icon: Play, type: 'script' },
  { name: 'resources/template.json', icon: FileText, type: 'resource' },
]

// ─── Main Skills Demo ───────────────────────────────────────────────────────

export function SkillsDemo() {
  const [stage, setStage] = useState<Stage>('init')
  const [logCount, setLogCount] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)

  useEffect(() => {
    setStage('init')
    setLogCount(0)
    setUploadProgress(0)

    const timers: ReturnType<typeof setTimeout>[] = []
    for (const [s, delay] of Object.entries(TIMELINE)) {
      if (delay > 0) {
        timers.push(
          setTimeout(() => {
            const st = s as Stage
            setStage(st)
            setLogCount(STAGE_TO_LOG[st])
          }, delay),
        )
      }
    }
    return () => timers.forEach(clearTimeout)
  }, [])

  // Upload progress bar
  useEffect(() => {
    if (stage !== 'uploading') return
    setUploadProgress(0)
    const start = Date.now()
    const dur = 1200
    const tick = () => {
      const p = Math.min((Date.now() - start) / dur, 1)
      setUploadProgress(p)
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [stage])

  const si = STAGES.indexOf(stage)
  const showPackage = si >= STAGES.indexOf('show-package')
  const isUploading = si >= STAGES.indexOf('uploading')
  const isUploaded = si >= STAGES.indexOf('uploaded')
  const showCatalog = si >= STAGES.indexOf('catalog')
  const showSandbox = si >= STAGES.indexOf('sandbox-mount')
  const isExecuting = si >= STAGES.indexOf('executing')
  const showSuccess = si >= STAGES.indexOf('success')

  return (
    <div className="h-full flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-4">
        {/* Left: Skill flow */}
        <div className="flex-3 min-w-0 flex flex-col gap-3">
          {/* Skill Package */}
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl">
            <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2">
              <Package className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
              <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">Skill Package</span>
              {isUploading && !isUploaded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="ml-auto flex items-center gap-1.5"
                >
                  <Upload className="w-3 h-3 text-violet-500 animate-pulse" />
                  <span className="text-[10px] sm:text-xs text-violet-600 dark:text-violet-400">
                    Uploading...
                  </span>
                </motion.div>
              )}
              {isUploaded && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="ml-auto flex items-center gap-1.5"
                >
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400">
                    Stored
                  </span>
                </motion.div>
              )}
            </div>
            <div className="p-3 sm:p-4">
              <AnimatePresence>
                {showPackage && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-2"
                  >
                    {/* Skill name header */}
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-violet-500" />
                      <span className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        data-extraction
                      </span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-600">v1.0</span>
                    </div>

                    {/* File list */}
                    {SKILL_FILES.map((file, i) => (
                      <motion.div
                        key={file.name}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.15, type: 'spring', stiffness: 300, damping: 20 }}
                        className="flex items-center gap-2 px-2 py-1.5 border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/30 rounded"
                      >
                        <file.icon className="w-3 h-3 text-zinc-400 dark:text-zinc-500 shrink-0" />
                        <span className="text-xs text-zinc-600 dark:text-zinc-400 font-mono truncate">
                          {file.name}
                        </span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-600 ml-auto capitalize">
                          {file.type}
                        </span>
                      </motion.div>
                    ))}

                    {/* Upload progress */}
                    {isUploading && !isUploaded && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-2"
                      >
                        <div className="h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-violet-500 rounded-full"
                            style={{ width: `${uploadProgress * 100}%` }}
                          />
                        </div>
                      </motion.div>
                    )}

                    {/* Catalog badge after upload */}
                    {showCatalog && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="mt-2 flex items-center gap-2 px-2 py-1.5 border border-violet-300/50 dark:border-violet-700/50 bg-violet-100/20 dark:bg-violet-950/20 rounded"
                      >
                        <Sparkles className="w-3 h-3 text-violet-500 dark:text-violet-400" />
                        <span className="text-[10px] sm:text-xs text-violet-600 dark:text-violet-400">
                          Available in skill catalog
                        </span>
                        <span className="text-[10px] text-violet-400 dark:text-violet-600 ml-auto">
                          3 files
                        </span>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Sandbox Execution */}
          <AnimatePresence>
            {showSandbox && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 shadow-md dark:shadow-2xl"
              >
                <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-3 py-2">
                  <Terminal className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-2" />
                  <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">Sandbox</span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-600 ml-2 font-mono">env-42</span>
                  {showSuccess && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="ml-auto"
                    >
                      <Check className="w-4 h-4 text-emerald-500" />
                    </motion.div>
                  )}
                </div>
                <div className="p-3 sm:p-4">
                  {/* Mounted skill path */}
                  <div className="flex items-center gap-2 mb-2">
                    <FolderOpen className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
                    <span className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 font-mono">
                      /skills/data-extraction/
                    </span>
                  </div>

                  {/* Terminal output */}
                  <div className="font-mono text-[10px] sm:text-xs space-y-0.5">
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-zinc-400 dark:text-zinc-500"
                    >
                      $ cat SKILL.md | head -3
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-zinc-600 dark:text-zinc-400"
                    >
                      name: data-extraction
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.35 }}
                      className="text-zinc-600 dark:text-zinc-400"
                    >
                      description: Extract structured data from docs
                    </motion.p>

                    {isExecuting && (
                      <>
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.1 }}
                          className="text-zinc-400 dark:text-zinc-500 mt-1"
                        >
                          $ python scripts/extract.py --input docs/
                        </motion.p>
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.3 }}
                          className="text-zinc-600 dark:text-zinc-400"
                        >
                          Processing 3 documents...
                        </motion.p>
                      </>
                    )}

                    {showSuccess && (
                      <>
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-zinc-600 dark:text-zinc-400"
                        >
                          Extracted 12 records to output.json
                        </motion.p>
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.15 }}
                          className="text-emerald-400"
                        >
                          Done in 0.8s
                        </motion.p>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Tool call log */}
        <div className="hidden sm:flex flex-2 min-w-0 flex-col justify-center">
          <ToolCallLog calls={TOOL_CALLS.slice(0, logCount)} />
        </div>
      </div>
    </div>
  )
}
