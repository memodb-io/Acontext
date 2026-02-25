'use client'

import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

interface RopeProps {
  height?: number
  pullThreshold?: number
  onPull?: () => void
  isHovered?: boolean
  className?: string
}

function SimpleRope({ height = 160, pullThreshold = 50, onPull }: RopeProps) {
  const pathRef = useRef<SVGPathElement>(null)
  const handleRef = useRef<SVGCircleElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const GRAVITY = 0.6
  const FRICTION = 0.995
  const SEGMENTS = 14
  const SEGMENT_LENGTH = height / SEGMENTS
  const CONSTRAINT_ITERATIONS = 6
  const SWAY_STRENGTH = 0.08

  const isHovering = useRef(false)
  const pulled = useRef(false)
  const initialHandleY = useRef<number | null>(null)

  const points = useRef<
    {
      x: number
      y: number
      oldX: number
      oldY: number
      pinned?: boolean
    }[]
  >([])

  useEffect(() => {
    const arr = []
    for (let i = 0; i <= SEGMENTS; i++) {
      arr.push({
        x: 50,
        y: i * SEGMENT_LENGTH,
        oldX: 50,
        oldY: i * SEGMENT_LENGTH,
        pinned: i === 0,
      })
    }
    points.current = arr
    initialHandleY.current = arr[arr.length - 1].y
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Verlet integration update */
  const update = () => {
    if (isHovering.current) {
      // Skip handle point when hovering (it follows mouse)
      for (let i = 0; i < points.current.length - 1; i++) {
        const p = points.current[i]
        if (p.pinned) continue

        const vx = (p.x - p.oldX) * FRICTION
        const vy = (p.y - p.oldY) * FRICTION

        const sway = (Math.random() - 0.5) * SWAY_STRENGTH

        p.oldX = p.x
        p.oldY = p.y

        p.x += vx + sway
        p.y += vy + GRAVITY
      }
    } else {
      for (const p of points.current) {
        if (p.pinned) continue

        const vx = (p.x - p.oldX) * FRICTION
        const vy = (p.y - p.oldY) * FRICTION

        const sway = (Math.random() - 0.5) * SWAY_STRENGTH

        p.oldX = p.x
        p.oldY = p.y

        p.x += vx + sway
        p.y += vy + GRAVITY
      }
    }
  }

  /** Constraint solver */
  const constrain = () => {
    for (let i = 0; i < points.current.length - 1; i++) {
      const p1 = points.current[i]
      const p2 = points.current[i + 1]

      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const diff = (dist - SEGMENT_LENGTH) / dist

      if (!p1.pinned) {
        p1.x += dx * diff * 0.5
        p1.y += dy * diff * 0.5
      }

      p2.x -= dx * diff * 0.5
      p2.y -= dy * diff * 0.5
    }
  }

  const render = () => {
    const pts = points.current
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i].y}`
    }

    pathRef.current?.setAttribute('d', d)

    const end = pts[pts.length - 1]
    handleRef.current?.setAttribute('cx', String(end.x))
    handleRef.current?.setAttribute('cy', String(end.y))
  }

  useEffect(() => {
    let raf = 0

    const loop = () => {
      update()
      for (let i = 0; i < CONSTRAINT_ITERATIONS; i++) constrain()
      render()
      raf = requestAnimationFrame(loop)
    }

    loop()
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const HANDLE_RADIUS = 20

    const move = (e: MouseEvent) => {
      if (!svgRef.current) return

      const rect = svgRef.current.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      if (points.current.length === 0) return

      const end = points.current.at(-1)!

      const dx = mouseX - end.x
      const dy = mouseY - end.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      const wasHovering = isHovering.current
      isHovering.current = distance < HANDLE_RADIUS

      if (isHovering.current) {
        end.x = Math.max(10, Math.min(90, mouseX))
        end.y = Math.max(30, mouseY)

        // Sync old position to prevent sudden jumps
        end.oldX = end.x
        end.oldY = end.y

        if (initialHandleY.current !== null) {
          const pulledDistance = end.y - initialHandleY.current

          if (pulledDistance > pullThreshold && !pulled.current) {
            pulled.current = true

            // Apply impulse and trigger callback
            const prev = points.current.at(-2)!
            end.y += 8
            end.x += (Math.random() - 0.5) * 6
            prev.oldY -= 6

            if (onPull) onPull()
          } else if (pulledDistance <= pullThreshold) {
            pulled.current = false
          }
        }
      } else if (wasHovering && !isHovering.current) {
        pulled.current = false
      }
    }

    window.addEventListener('mousemove', move)

    return () => {
      window.removeEventListener('mousemove', move)
    }
  }, [pullThreshold, onPull])

  return (
    <svg ref={svgRef} width="100" height={height + 60} style={{ pointerEvents: 'auto' }}>
      <circle cx="50" cy="0" r="3" fill="currentColor" pointerEvents="none" />

      <path
        ref={pathRef}
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        pointerEvents="none"
      />

      <circle
        ref={handleRef}
        r="6"
        fill="currentColor"
        style={{ cursor: 'grab', pointerEvents: 'auto' }}
      />
    </svg>
  )
}

// Wrapper component with hover effects
export function PullCordAnimation({
  height = 160,
  pullThreshold = 50,
  onPull,
  isHovered = false,
  className: _className,
}: RopeProps) {
  const [isVisible, setIsVisible] = useState(false)
  const hasShownRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handlePull = () => {
    window.dispatchEvent(new CustomEvent('particle-canvas-reset'))

    if (onPull) {
      onPull()
    }
  }

  useEffect(() => {
    if (isHovered && !isVisible && !hasShownRef.current) {
      setIsVisible(true)
      hasShownRef.current = true

      if (containerRef.current) {
        gsap.fromTo(
          containerRef.current,
          {
            opacity: 0,
            scale: 0.8,
          },
          {
            opacity: 1,
            scale: 1,
            duration: 0.4,
            ease: 'power2.out',
          },
        )
      }
    }
  }, [isHovered, isVisible])

  if (!isVisible) return null

  return (
    <div
      ref={containerRef}
      className="absolute left-1/2 text-primary"
      style={{
        transform: 'translateX(-50%)',
        top: 64, // Align with light beam (headerOffset = 64px)
        left: '50%',
        pointerEvents: 'auto',
        zIndex: 50,
      }}
      onMouseDown={(e) => {
        // Prevent canvas from receiving the event only if clicking on the container itself
        // Don't stop propagation for SVG elements
        if (e.target === containerRef.current) {
          e.stopPropagation()
        }
      }}
    >
      <SimpleRope height={height} pullThreshold={pullThreshold} onPull={handlePull} />
    </div>
  )
}

export default SimpleRope
