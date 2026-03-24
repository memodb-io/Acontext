'use client'

import { SkillMemoryDemo } from '../animation/demos/skill-memory-demo'

// ─── Main component ─────────────────────────────────────────────────────────

export function FeaturesOverview() {
  return (
    <section
      id="features-overview"
      className="py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
    >
      {/* Section header */}
      <div className="w-full max-w-[768px] lg:max-w-[1200px] mx-auto mb-8 sm:mb-12">
        <div className="flex flex-col items-center gap-2 lg:gap-3">
          <h2 className="max-w-xl text-3xl sm:text-4xl lg:text-5xl leading-[1.1] text-center font-semibold text-foreground">
            How Skill Memory Works
          </h2>
          <p className="max-w-xl text-sm sm:text-base lg:text-lg text-center text-muted-foreground">
            Learn from runs. Write as Markdown. Reuse anywhere. Skill memory that turns what your agents did into files they can read and use again.
          </p>
        </div>
      </div>

      {/* Demo — fills the section directly, no extra border wrapper */}
      <div className="w-full max-w-[768px] lg:max-w-[1200px] mx-auto">
        <SkillMemoryDemo />
      </div>
    </section>
  )
}
