'use client'

import { useEffect, useState, useRef } from 'react'
import { CopyButton } from './copy-button'

interface CodeBlockProps {
  code: string
  language?: string
}

export function CodeBlock({ code, language = 'text' }: CodeBlockProps) {
  const [lightHtml, setLightHtml] = useState<string | null>(null)
  const [darkHtml, setDarkHtml] = useState<string | null>(null)
  const highlightedRef = useRef(false)

  // Trim leading/trailing whitespace and empty lines
  const trimmedCode = code.replace(/^\n+/, '').replace(/\n+$/, '')

  useEffect(() => {
    // Prevent double highlighting in strict mode
    if (highlightedRef.current) return
    highlightedRef.current = true

    // Map common language aliases
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

    const lang = langMap[language] || language

    // Dynamically import shiki for client-side highlighting
    import('shiki').then(async ({ codeToHtml }) => {
      try {
        const [light, dark] = await Promise.all([
          codeToHtml(trimmedCode, {
            lang,
            theme: 'github-light-default',
          }),
          codeToHtml(trimmedCode, {
            lang,
            theme: 'github-dark-default',
          }),
        ])
        setLightHtml(light)
        setDarkHtml(dark)
      } catch {
        // Fallback if language not supported
        const [light, dark] = await Promise.all([
          codeToHtml(trimmedCode, {
            lang: 'text',
            theme: 'github-light-default',
          }),
          codeToHtml(trimmedCode, {
            lang: 'text',
            theme: 'github-dark-default',
          }),
        ])
        setLightHtml(light)
        setDarkHtml(dark)
      }
    })
  }, [trimmedCode, language])

  // Show skeleton while loading
  if (!lightHtml || !darkHtml) {
    return (
      <div className="code-block group relative my-6 rounded-lg overflow-hidden">
        <CopyButton code={trimmedCode} />
        <pre className="p-4 bg-muted/50 overflow-x-auto">
          <code className="text-sm font-mono text-foreground/70">{trimmedCode}</code>
        </pre>
      </div>
    )
  }

  return (
    <div className="code-block group relative my-6 rounded-lg overflow-hidden">
      <CopyButton code={trimmedCode} />
      {/* Light theme - hidden in dark mode */}
      <div
        className="block dark:hidden overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: lightHtml }}
      />
      {/* Dark theme - shown only in dark mode */}
      <div
        className="hidden dark:block overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: darkHtml }}
      />
    </div>
  )
}
