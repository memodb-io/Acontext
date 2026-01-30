'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { SpiralCanvas } from './spiral-canvas'
import { SceneContent } from './scene-content'
import { scenes } from './scene-data'

interface AcontextVsClaudeProps {
  autoPlayInterval?: number // ms
  className?: string
  enableScrollSnap?: boolean // Enable scroll snap when entering viewport
  scrollSnapThreshold?: number // How close (0-1) before snapping (default 0.3)
}

export function AcontextVsClaude({
  autoPlayInterval = 8000,
  className = '',
  enableScrollSnap = true,
  scrollSnapThreshold = 0.3,
}: AcontextVsClaudeProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isHovered, setIsHovered] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLElement>(null)
  const hasSnappedRef = useRef(false)
  const isScrollingRef = useRef(false)

  const currentScene = scenes[currentIndex]

  // Navigate to next scene
  const nextScene = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % scenes.length)
  }, [])

  // Navigate to previous scene
  const prevScene = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + scenes.length) % scenes.length)
  }, [])

  // Jump to specific scene
  const jumpTo = useCallback((index: number) => {
    setCurrentIndex(index)
  }, [])

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev)
  }, [])

  // Auto-play timer - resets when currentIndex changes (manual or auto)
  useEffect(() => {
    if (isPlaying && !isHovered) {
      timerRef.current = setInterval(nextScene, autoPlayInterval)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isPlaying, isHovered, nextScene, autoPlayInterval, currentIndex])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if the container is in viewport
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const inViewport =
        rect.top < window.innerHeight && rect.bottom > 0

      if (!inViewport) return

      switch (e.key) {
        case 'ArrowLeft':
          prevScene()
          break
        case 'ArrowRight':
          nextScene()
          break
        case ' ':
          e.preventDefault()
          togglePlay()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nextScene, prevScene, togglePlay])

  // Scroll snap effect - snaps when section enters viewport
  useEffect(() => {
    if (!enableScrollSnap || !containerRef.current) return

    const container = containerRef.current
    let scrollTimeout: NodeJS.Timeout | null = null

    // Reset snap flag when user starts scrolling
    const handleScrollStart = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout)
      isScrollingRef.current = true
      
      scrollTimeout = setTimeout(() => {
        isScrollingRef.current = false
        // Reset snap flag when user has stopped scrolling for a while
        // This allows re-snapping if user scrolls away and comes back
        const rect = container.getBoundingClientRect()
        const isInView = rect.top < window.innerHeight && rect.bottom > 0
        if (!isInView) {
          hasSnappedRef.current = false
        }
      }, 150)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Only snap once per scroll session
          if (hasSnappedRef.current) return

          const rect = container.getBoundingClientRect()
          const viewportHeight = window.innerHeight
          
          // Calculate how much of the section is visible from top
          // We want to snap when the section's top enters the viewport
          const topVisibility = 1 - (rect.top / viewportHeight)
          
          // Snap when section top is within threshold of viewport
          // AND user is scrolling down (rect.top is decreasing)
          if (
            entry.isIntersecting &&
            topVisibility >= scrollSnapThreshold &&
            topVisibility <= 0.7 && // Don't snap if already mostly visible
            rect.top > 0 // Section is below viewport top (scrolling down)
          ) {
            hasSnappedRef.current = true
            
            // Smooth scroll to center the section
            container.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            })
          }
        })
      },
      {
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5],
        rootMargin: '0px 0px -20% 0px', // Trigger slightly before fully visible
      }
    )

    observer.observe(container)
    window.addEventListener('scroll', handleScrollStart, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', handleScrollStart)
      if (scrollTimeout) clearTimeout(scrollTimeout)
    }
  }, [enableScrollSnap, scrollSnapThreshold])

  return (
    <section
      id="comparison"
      ref={containerRef}
      className={`relative min-h-screen py-24 px-4 sm:px-6 lg:px-8 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="w-full max-w-[768px] lg:max-w-[1200px] mx-auto">
        {/* Main Frame - Adaptive height container */}
        <div
          className="
            relative w-full overflow-hidden
            rounded-2xl
            bg-[rgba(10,10,15,0.35)]
            border border-white/10
            backdrop-blur-sm
          "
        >
          {/* Canvas Background */}
          <SpiralCanvas colorStops={currentScene.colorScheme} />

          {/* Noise Texture Overlay */}
          <div
            className="
              absolute inset-0 z-1 rounded-2xl pointer-events-none
              opacity-25 backdrop-blur-sm
            "
            style={{
              backgroundImage: 'url(/noise-texture.png)',
              backgroundSize: '200px 200px',
              backgroundRepeat: 'repeat',
              backgroundColor: 'rgba(10, 10, 15, 0.15)',
            }}
          />

          {/* Scene Content */}
          <div className="relative z-2 w-full">
            <SceneContent
              scenes={scenes}
              currentIndex={currentIndex}
              onSceneChange={jumpTo}
            />
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-center gap-3 mt-4">
          {/* Previous Button */}
          <button
            onClick={prevScene}
            className="
              p-2 rounded-full
              bg-white/5 hover:bg-white/10
              border border-white/10 hover:border-white/20
              text-zinc-400 hover:text-white
              transition-all duration-200
            "
            aria-label="Previous scene"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          {/* Scene Indicators */}
          <div className="flex items-center gap-2">
            {scenes.map((scene, index) => (
              <button
                key={scene.id}
                onClick={() => jumpTo(index)}
                className={`
                  w-2.5 h-2.5 rounded-full transition-all duration-300
                  ${
                    index === currentIndex
                      ? 'bg-emerald-500 scale-125'
                      : 'bg-white/20 hover:bg-white/40'
                  }
                `}
                aria-label={`Go to scene ${index + 1}: ${scene.badge}`}
              />
            ))}
          </div>

          {/* Play/Pause Button */}
          <button
            onClick={togglePlay}
            className="
              p-2 rounded-full
              bg-white/5 hover:bg-white/10
              border border-white/10 hover:border-white/20
              text-zinc-400 hover:text-white
              transition-all duration-200
            "
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>

          {/* Next Button */}
          <button
            onClick={nextScene}
            className="
              p-2 rounded-full
              bg-white/5 hover:bg-white/10
              border border-white/10 hover:border-white/20
              text-zinc-400 hover:text-white
              transition-all duration-200
            "
            aria-label="Next scene"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* Scene Title Indicator (mobile) */}
        <div className="mt-4 text-center lg:hidden">
          <span className="text-sm text-zinc-500">
            {currentIndex + 1} / {scenes.length} · {currentScene.badge}
          </span>
        </div>
      </div>
    </section>
  )
}

export default AcontextVsClaude
