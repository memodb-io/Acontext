'use client'

import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import Image from 'next/image'
import { gsap } from 'gsap'
import type { CardData } from './scene-data'
import { TypewriterCodeBlock } from './code-block'

export interface ComparisonCardRef {
  animateOut: () => Promise<void>
  animateIn: () => Promise<void>
}

interface ComparisonCardProps {
  data: CardData
  type: 'acontext' | 'claude'
  isActive: boolean
  sceneKey: string // Key to trigger re-animation when scene changes
}

export const ComparisonCard = forwardRef<ComparisonCardRef, ComparisonCardProps>(
  function ComparisonCard({ data, type, isActive, sceneKey }, ref) {
    const cardRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      animateOut: () => {
        return new Promise<void>((resolve) => {
          if (!cardRef.current) {
            resolve()
            return
          }
          gsap.to(cardRef.current, {
            y: -12,
            opacity: 0,
            duration: 0.4,
            ease: 'power2.in',
            onComplete: resolve,
          })
        })
      },
      animateIn: () => {
        return new Promise<void>((resolve) => {
          if (!cardRef.current) {
            resolve()
            return
          }
          gsap.fromTo(
            cardRef.current,
            { y: 12, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.5,
              ease: 'power2.out',
              onComplete: resolve,
            }
          )
        })
      },
    }))

    // Animate in when becoming active
    useEffect(() => {
      if (isActive && cardRef.current) {
        gsap.fromTo(
          cardRef.current,
          { y: 12, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            ease: 'power2.out',
            delay: 0.15,
          }
        )
      }
    }, [isActive, sceneKey])

    const isHighlighted = data.isHighlighted
    const isPlaceholder = data.isPlaceholder

    // Placeholder card for the last scene's Claude side
    if (isPlaceholder) {
      return (
        <div
          ref={cardRef}
          className={`
            relative flex flex-col h-full overflow-hidden rounded-2xl
            bg-[rgba(10,10,15,0.7)] backdrop-blur-xl
            border border-white/10
            p-2 sm:p-3 lg:p-4
            opacity-70
          `}
        >
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-4 text-5xl sm:text-6xl lg:text-7xl opacity-70 text-zinc-200">
              {data.placeholderIcon}
            </div>
            <div className="mb-2 text-base sm:text-lg lg:text-xl font-semibold text-zinc-200">
              {data.placeholderTitle}
            </div>
            <div className="text-xs sm:text-sm text-zinc-400">
              {data.placeholderSubtitle}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div
        ref={cardRef}
        className={`
          relative flex flex-col h-full overflow-hidden rounded-2xl
          backdrop-blur-xl
          ${isHighlighted
            ? 'bg-[rgba(10,10,15,0.8)] border border-emerald-500/40 shadow-[0_0_30px_rgba(34,197,94,0.1)]'
            : 'bg-[rgba(10,10,15,0.5)] border border-white/10 opacity-70'
          }
          p-2 sm:p-3 lg:p-4
        `}
      >
        {/* Card Header */}
        <div ref={contentRef} className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3 shrink-0">
          {/* Logo */}
          <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-11 lg:h-11 rounded-lg overflow-hidden shrink-0">
            <Image
              src={type === 'acontext' ? '/ico_black.svg' : '/claude-logo-square.svg'}
              alt={type === 'acontext' ? 'Acontext' : 'Claude'}
              width={44}
              height={44}
              className="w-full h-full object-cover"
            />
          </div>
          {/* Title & Subtitle */}
          <div className="flex-1 min-w-0">
            <div className="text-sm sm:text-base lg:text-lg font-bold text-white truncate">
              {data.title}
            </div>
            <div
              className={`
                text-[10px] sm:text-xs lg:text-sm mt-0.5 truncate
                ${isHighlighted
                  ? 'text-emerald-400 font-medium tracking-wide'
                  : 'text-zinc-500'
                }
              `}
            >
              {data.subtitle}
            </div>
          </div>
        </div>

        {/* Description */}
        <div
          className={`
            text-xs sm:text-sm lg:text-base leading-relaxed mb-2 sm:mb-3 shrink-0
            ${isHighlighted ? 'text-zinc-200 font-medium' : 'text-zinc-400'}
          `}
        >
          {data.description}
        </div>

        {/* Code Block(s) */}
        {data.code.length > 0 && (
          <div className={`flex flex-col ${data.code.length > 1 ? 'gap-2 sm:gap-3' : ''} flex-1 min-h-0`}>
            {data.code.map((codeBlock, index) => (
              <TypewriterCodeBlock
                key={index}
                code={codeBlock}
                isActive={isActive}
                sceneKey={`${sceneKey}-${index}`}
                opacity={type === 'claude' ? 70 : 100}
              />
            ))}
          </div>
        )}
      </div>
    )
  }
)

export default ComparisonCard
