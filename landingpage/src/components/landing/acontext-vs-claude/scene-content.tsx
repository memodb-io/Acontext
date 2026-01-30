'use client'

import { useEffect, useState, useRef } from 'react'
import TextType from '@/components/TextType'
import { ComparisonCard } from './comparison-card'
import type { Scene } from './scene-data'

interface SceneContentProps {
  scenes: Scene[]
  currentIndex: number
  onSceneChange?: (index: number) => void
}

// Transition phases for delete-then-type effect
type TransitionPhase = 'idle' | 'deleting' | 'typing'

export function SceneContent({ scenes, currentIndex }: SceneContentProps) {
  const currentScene = scenes[currentIndex]
  const prevIndexRef = useRef(currentIndex)
  const isFirstRender = useRef(true)
  
  // Current displayed text (for delete animation)
  const [displayedBadge, setDisplayedBadge] = useState(currentScene.badge)
  const [displayedTitle, setDisplayedTitle] = useState(currentScene.title)
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>('idle')
  const [key, setKey] = useState(0)

  // Handle scene transition with delete-then-type effect
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    
    if (prevIndexRef.current !== currentIndex) {
      // Start delete phase
      setTransitionPhase('deleting')
      
      // After delete animation completes, update text and start typing
      const deleteTimer = setTimeout(() => {
        setDisplayedBadge(currentScene.badge)
        setDisplayedTitle(currentScene.title)
        setTransitionPhase('typing')
        setKey((k) => k + 1)
        
        // Reset to idle after typing would complete
        const typeTimer = setTimeout(() => {
          setTransitionPhase('idle')
        }, Math.max(currentScene.badge.length * 40, currentScene.title.length * 25) + 500)
        
        return () => clearTimeout(typeTimer)
      }, 300) // Delete animation duration
      
      prevIndexRef.current = currentIndex
      
      return () => clearTimeout(deleteTimer)
    }
  }, [currentIndex, currentScene.badge, currentScene.title])

  return (
    <div className="relative z-10 flex flex-col p-2 sm:p-3 lg:p-[1.5%] min-h-[calc(100vh-14rem)]">
      {/* Header */}
      <div className="text-center mb-2 sm:mb-3 lg:mb-[2%] shrink-0">
        {/* Badge */}
        <div className="inline-flex items-center justify-center mb-2">
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-lg min-w-[120px] overflow-hidden">
            <div
              className="transition-all duration-300 ease-out"
              style={{
                opacity: transitionPhase === 'deleting' ? 0 : 1,
                transform: transitionPhase === 'deleting' ? 'translateY(-10px)' : 'translateY(0)',
              }}
            >
              {transitionPhase === 'deleting' ? (
                <span className="text-xs sm:text-sm text-zinc-200 uppercase tracking-widest font-semibold">
                  {displayedBadge}
                </span>
              ) : (
                <TextType
                  key={`badge-${key}`}
                  text={displayedBadge}
                  className="text-xs sm:text-sm text-zinc-200 uppercase tracking-widest font-semibold"
                  typingSpeed={40}
                  showCursor={false}
                  loop={false}
                />
              )}
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="flex items-center justify-center min-h-[2em] overflow-hidden">
          <div
            className="transition-all duration-300 ease-out"
            style={{
              opacity: transitionPhase === 'deleting' ? 0 : 1,
              transform: transitionPhase === 'deleting' ? 'translateY(-10px)' : 'translateY(0)',
            }}
          >
            {transitionPhase === 'deleting' ? (
              <span className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">
                {displayedTitle}
              </span>
            ) : (
              <TextType
                key={`title-${key}`}
                text={displayedTitle}
                className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white"
                typingSpeed={25}
                showCursor={true}
                cursorCharacter="_"
                cursorClassName="text-emerald-400 font-normal"
                loop={false}
              />
            )}
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 lg:gap-[1.5%] items-stretch flex-1">
        <ComparisonCard
          data={currentScene.acontext}
          type="acontext"
          isActive={true}
          sceneKey={`acontext-${currentIndex}`}
        />
        <ComparisonCard
          data={currentScene.claude}
          type="claude"
          isActive={true}
          sceneKey={`claude-${currentIndex}`}
        />
      </div>
    </div>
  )
}

export default SceneContent
