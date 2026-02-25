'use client'

import { useEffect, useState } from 'react'

interface HighlightedCodeProps {
  code: string
  language?: string
  className?: string
}

export function HighlightedCode({ code, language = 'python', className }: HighlightedCodeProps) {
  const [html, setHtml] = useState<{ light: string; dark: string } | null>(null)

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

    const highlight = async () => {
      const { codeToHtml } = await import('shiki')
      const lang = langMap[language] || language

      try {
        const [light, dark] = await Promise.all([
          codeToHtml(code.trim(), { lang, theme: 'github-light-default' }),
          codeToHtml(code.trim(), { lang, theme: 'github-dark-default' }),
        ])
        setHtml({ light, dark })
      } catch {
        const [light, dark] = await Promise.all([
          codeToHtml(code.trim(), { lang: 'text', theme: 'github-light-default' }),
          codeToHtml(code.trim(), { lang: 'text', theme: 'github-dark-default' }),
        ])
        setHtml({ light, dark })
      }
    }

    highlight()
  }, [code, language])

  if (!html) {
    return (
      <pre className={`text-sm text-foreground/80 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto ${className ?? ''}`}>
        {code.trim()}
      </pre>
    )
  }

  return (
    <>
      <div
        className={`block dark:hidden [&_pre]:bg-transparent! [&_pre]:p-0! [&_code]:text-sm [&_code]:leading-relaxed ${className ?? ''}`}
        dangerouslySetInnerHTML={{ __html: html.light }}
      />
      <div
        className={`hidden dark:block [&_pre]:bg-transparent! [&_pre]:p-0! [&_code]:text-sm [&_code]:leading-relaxed ${className ?? ''}`}
        dangerouslySetInnerHTML={{ __html: html.dark }}
      />
    </>
  )
}
