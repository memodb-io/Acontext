'use client'

import { useState, useRef } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CopyCommandProps {
  command: string
  className?: string
}

export function CopyCommand({ command, className }: CopyCommandProps) {
  const [copied, setCopied] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  const handleCopy = async (e: React.MouseEvent<HTMLDivElement>) => {
    // Create ripple effect at click position
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const newRipple = { id: Date.now(), x, y }
      setRipples((prev) => [...prev, newRipple])
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id))
      }, 600)
    }

    // Copy to clipboard
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setIsActive(true)

    // Reset states
    setTimeout(() => setCopied(false), 2000)
    setTimeout(() => setIsActive(false), 300)
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'group relative flex items-center gap-3 px-5 py-3 rounded-xl overflow-hidden',
        'bg-card/50 backdrop-blur border border-border/50',
        'hover:border-primary/50 hover:bg-card/80',
        'cursor-pointer select-none',
        'transition-all duration-300 ease-out',
        // Active state - scale down slightly and glow
        isActive && 'scale-[0.98] border-primary/70 shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]',
        // Copied state - persistent glow
        copied && 'border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)]',
        className,
      )}
      onClick={handleCopy}
    >
      {/* Ripple effects */}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute rounded-full bg-primary/30 animate-ripple pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}

      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-linear-to-r from-transparent via-white/5 to-transparent pointer-events-none" />

      <code
        className={cn(
          'text-sm sm:text-base font-mono flex-1 overflow-x-auto whitespace-nowrap scrollbar-hide',
          'transition-colors duration-300',
          copied ? 'text-green-500' : 'text-foreground/90',
        )}
      >
        {command}
      </code>

      <button
        className={cn(
          'shrink-0 p-2 rounded-lg',
          'transition-all duration-300 ease-out',
          'hover:bg-accent text-muted-foreground hover:text-foreground',
          copied && 'text-green-500 hover:text-green-500 rotate-0',
        )}
        aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
      >
        <span
          className={cn(
            'block transition-all duration-300',
            copied ? 'scale-110 rotate-0' : 'scale-100 group-hover:scale-110',
          )}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </span>
      </button>

      {/* Tooltip with slide-in animation */}
      <span
        className={cn(
          'absolute -top-9 right-0 text-xs px-3 py-1.5 rounded-lg',
          'bg-green-500 text-white font-medium shadow-lg',
          'transition-all duration-300 ease-out',
          copied
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-2 scale-95 pointer-events-none',
        )}
      >
        <span className="flex items-center gap-1">
          <Check className="h-3 w-3" />
          Copied!
        </span>
        {/* Tooltip arrow */}
        <span className="absolute -bottom-1 right-4 w-2 h-2 bg-green-500 rotate-45" />
      </span>
    </div>
  )
}
