'use client'

import { SpiralCanvas } from './spiral-canvas'
import { ComparisonCard } from './comparison-card'
import type { Scene } from './scene-data'

interface StandaloneComparisonProps {
  scene: Scene
  className?: string
}

export function StandaloneComparison({ scene, className = '' }: StandaloneComparisonProps) {
  return (
    <section className={`relative py-24 px-4 sm:px-6 lg:px-8 ${className}`}>
      <div className="w-full max-w-[768px] lg:max-w-[1200px] mx-auto">
        <div
          className="
            relative w-full overflow-hidden
            rounded-2xl
            bg-[rgba(10,10,15,0.35)]
            border border-white/10
            backdrop-blur-sm
          "
        >
          <SpiralCanvas colorStops={scene.colorScheme} />

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

          <div className="relative z-2 w-full">
            <div className="relative z-10 flex flex-col p-2 sm:p-3 lg:p-[1.5%]">
              <div className="text-center mb-2 sm:mb-3 lg:mb-[2%] shrink-0">
                <div className="inline-flex items-center justify-center mb-2">
                  <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-lg">
                    <span className="text-xs sm:text-sm text-zinc-200 uppercase tracking-widest font-semibold">
                      {scene.badge}
                    </span>
                  </div>
                </div>
                <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">
                  {scene.title}
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 lg:gap-[1.5%] items-stretch">
                <ComparisonCard
                  data={scene.acontext}
                  type="acontext"
                  isActive={true}
                  sceneKey={`standalone-acontext-${scene.id}`}
                />
                <ComparisonCard
                  data={scene.claude}
                  type="claude"
                  isActive={true}
                  sceneKey={`standalone-claude-${scene.id}`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
