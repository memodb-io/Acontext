'use client'

import { useState } from 'react'

interface CopyButtonProps {
  code: string
}

export function CopyButton({ code }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = code
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 z-10 rounded-md px-2 py-1.5 text-xs font-medium
        opacity-0 transition-all duration-200 group-hover:opacity-100
        bg-neutral-200/80 hover:bg-neutral-300 text-neutral-700
        dark:bg-neutral-700/80 dark:hover:bg-neutral-600 dark:text-neutral-300
        focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
      aria-label={copied ? 'Copied!' : 'Copy code'}
    >
      {copied ? (
        <span className="flex items-center gap-1">
          <CheckIcon className="h-3.5 w-3.5" />
          Copied!
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <CopyIcon className="h-3.5 w-3.5" />
          Copy
        </span>
      )}
    </button>
  )
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

