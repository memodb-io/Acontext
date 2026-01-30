'use client'

import { SandboxAnimation } from '@/components/animation/sandbox-animation'
import { WithCustomCursor } from '@/components/with-custom-cursor'

export function SandboxOverview() {
  return (
    <WithCustomCursor
      id="how-it-works"
      cursorStyle="glow"
      cursorSize={20}
      cursorFollowDelay={0}
      className="cursor-none **:cursor-none"
    >
      <SandboxAnimation />
    </WithCustomCursor>
  )
}
