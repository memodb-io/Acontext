'use client'

import { useRef, useEffect, useState, useMemo, type ReactNode } from 'react'
import type { CodeLine } from './scene-data'

interface LineFadeCodeBlockProps {
  code: CodeLine[]
  isActive: boolean
  sceneKey: string
  lineDelay?: number // ms between lines appearing
  opacity?: number // 0-100, overall opacity percentage
}

// Syntax highlighting colors (matching the HTML reference)
const tokenColors = {
  comment: '#6b7280',
  keyword: '#c084fc',
  string: '#4ade80',
  function: '#60a5fa',
  number: '#f472b6',
  operator: '#94a3b8',
  normal: '#e4e4e7',
}

interface Token {
  text: string
  type: keyof typeof tokenColors
}

// Python keywords
const PYTHON_KEYWORDS = new Set([
  'from', 'import', 'as', 'def', 'class', 'return', 'if', 'else', 'elif',
  'for', 'while', 'in', 'not', 'and', 'or', 'is', 'None', 'True', 'False',
  'try', 'except', 'finally', 'with', 'lambda', 'yield', 'async', 'await',
  'pass', 'break', 'continue', 'raise', 'global', 'nonlocal', 'assert',
])

// Tokenize a line of Python code
function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < line.length) {
    // Check for comment
    if (line[i] === '#') {
      tokens.push({ text: line.slice(i), type: 'comment' })
      break
    }

    // Check for string (single or double quotes)
    if (line[i] === '"' || line[i] === "'") {
      const quote = line[i]
      let j = i + 1
      // Find closing quote (handle escaped quotes)
      while (j < line.length && (line[j] !== quote || line[j - 1] === '\\')) {
        j++
      }
      if (j < line.length) j++ // include closing quote
      tokens.push({ text: line.slice(i, j), type: 'string' })
      i = j
      continue
    }

    // Check for f-string
    if ((line[i] === 'f' || line[i] === 'r' || line[i] === 'b') && 
        (line[i + 1] === '"' || line[i + 1] === "'")) {
      const quote = line[i + 1]
      let j = i + 2
      while (j < line.length && (line[j] !== quote || line[j - 1] === '\\')) {
        j++
      }
      if (j < line.length) j++
      tokens.push({ text: line.slice(i, j), type: 'string' })
      i = j
      continue
    }

    // Check for number
    if (/\d/.test(line[i])) {
      let j = i
      while (j < line.length && /[\d.]/.test(line[j])) {
        j++
      }
      tokens.push({ text: line.slice(i, j), type: 'number' })
      i = j
      continue
    }

    // Check for identifier (word)
    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i
      while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) {
        j++
      }
      const word = line.slice(i, j)
      
      // Check if it's followed by ( which makes it a function call
      let k = j
      while (k < line.length && line[k] === ' ') k++
      const isFunction = line[k] === '('
      
      // Check if it's followed by .something( which makes the something a method
      const isDotMethod = i > 0 && line[i - 1] === '.' && isFunction
      
      if (PYTHON_KEYWORDS.has(word)) {
        tokens.push({ text: word, type: 'keyword' })
      } else if (isFunction || isDotMethod) {
        tokens.push({ text: word, type: 'function' })
      } else {
        tokens.push({ text: word, type: 'normal' })
      }
      i = j
      continue
    }

    // Check for operators
    if (/[=+\-*/<>!&|%^~]/.test(line[i])) {
      let j = i
      while (j < line.length && /[=+\-*/<>!&|%^~]/.test(line[j])) {
        j++
      }
      tokens.push({ text: line.slice(i, j), type: 'operator' })
      i = j
      continue
    }

    // Everything else (brackets, punctuation, whitespace)
    tokens.push({ text: line[i], type: 'normal' })
    i++
  }

  return tokens
}

// Pre-tokenize all lines for efficient rendering
function tokenizeCode(code: CodeLine[]): Token[][] {
  return code.map(line => tokenizeLine(line.content))
}

export function TypewriterCodeBlock({
  code,
  isActive,
  sceneKey,
  lineDelay = 50,
  opacity = 100,
}: LineFadeCodeBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visibleLines, setVisibleLines] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const prevSceneKeyRef = useRef(sceneKey)
  const isFirstRender = useRef(true)
  
  // Transition phases: visible -> collapsing -> expanding -> visible
  const [transitionPhase, setTransitionPhase] = useState<'visible' | 'collapsing' | 'expanding'>('visible')

  // Pre-tokenize all code
  const tokenizedLines = useMemo(() => tokenizeCode(code), [code])

  // Handle scene change with collapse/expand animation
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    
    if (prevSceneKeyRef.current !== sceneKey) {
      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      
      // Start collapse animation
      setTransitionPhase('collapsing')
      
      // After collapse completes, start expanding with new content
      const collapseTimer = setTimeout(() => {
        setVisibleLines(0)
        setTransitionPhase('expanding')
        
        // After expand animation starts, set to visible
        const expandTimer = setTimeout(() => {
          setTransitionPhase('visible')
        }, 300)
        
        return () => clearTimeout(expandTimer)
      }, 300)
      
      prevSceneKeyRef.current = sceneKey
      
      return () => clearTimeout(collapseTimer)
    }
  }, [sceneKey])

  // Line-by-line fade-in animation
  useEffect(() => {
    if (!isActive || code.length === 0) return
    // Don't start typing during collapse
    if (transitionPhase === 'collapsing') return

    // Start showing lines one by one
    timerRef.current = setInterval(() => {
      setVisibleLines((prev) => {
        if (prev >= code.length) {
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          return prev
        }
        return prev + 1
      })
    }, lineDelay)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isActive, code.length, lineDelay, sceneKey, transitionPhase])

  // Render tokenized line
  const renderLine = (lineIndex: number): ReactNode => {
    const tokens = tokenizedLines[lineIndex]
    if (!tokens) return null

    const lineContent = tokens.map((token, i) => (
      <span key={i} style={{ color: tokenColors[token.type] }}>
        {token.text}
      </span>
    ))

    const isVisible = lineIndex < visibleLines

    return (
      <div
        key={lineIndex}
        className="transition-all duration-300 ease-out"
        style={{
          minHeight: '1.4em',
          lineHeight: '1.5',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(4px)',
        }}
      >
        {lineContent.length > 0 ? lineContent : '\u00A0'}
      </div>
    )
  }

  // Determine clipPath based on transition phase
  const getClipPath = () => {
    switch (transitionPhase) {
      case 'collapsing':
        return 'inset(0 0 100% 0)' // Collapse from bottom to top
      case 'expanding':
        return 'inset(0 0 0 0)' // Expand from top to bottom
      default:
        return 'inset(0 0 0 0)' // Fully visible
    }
  }

  return (
    <div
      ref={containerRef}
      className="
        flex-1
        bg-[rgba(17,17,24,0.2)] rounded-lg
        border border-white/10
        p-2 sm:p-3
        font-mono
      "
      style={{ opacity: opacity / 100 }}
    >
      <div
        className="overflow-x-auto scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        style={{
          clipPath: getClipPath(),
          transition: 'clip-path 0.3s ease-in-out',
        }}
      >
        <pre
          className="m-0 whitespace-pre text-[11px] sm:text-xs lg:text-[13px]"
          style={{ lineHeight: '1.5' }}
        >
          {code.map((_, index) => renderLine(index))}
        </pre>
      </div>
    </div>
  )
}

export default TypewriterCodeBlock
