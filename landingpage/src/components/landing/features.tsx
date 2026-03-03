'use client'

import { useRef, useEffect, useState } from 'react'
import { Plug, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

type FeatureTheme = 'sparkles' | 'plug'

interface Feature {
  title: string
  description: string
  Icon: typeof Sparkles
  theme: FeatureTheme
}

const FEATURES: Feature[] = [
  {
    title: 'Skill Memory',
    description:
      'Learns from task outcomes → writes Markdown files (SKILL.md schema) → agent recalls via get_skill / get_skill_file. Human-readable, portable, no embeddings. Export as ZIP, use in any framework.',
    Icon: Sparkles,
    theme: 'sparkles',
  },
  {
    title: 'SDKs & Integrations',
    description:
      'Ready to use with OpenAI, Anthropic, LangGraph, Agno, and other popular agent frameworks.',
    Icon: Plug,
    theme: 'plug',
  },
]

// Canvas animation component for each feature theme
function FeatureCanvas({ theme, isHovered }: { theme: FeatureTheme; isHovered: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const particlesRef = useRef<unknown[]>([])
  const colorRef = useRef<string>('62, 207, 142')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Get theme primary RGB color from CSS variable (format: "62, 207, 142")
    const updateColor = () => {
      const primaryRGB = getComputedStyle(document.documentElement)
        .getPropertyValue('--primary-rgb')
        .trim()
      if (primaryRGB) {
        colorRef.current = primaryRGB
      }
    }
    updateColor()

    // Watch for theme changes (dark/light mode)
    const observer = new MutationObserver(() => {
      updateColor()
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const initParticles = () => {
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height

      switch (theme) {
        case 'plug':
          particlesRef.current = Array.from({ length: 6 }, (_, i) => ({
            x: w * 0.2 + (i % 3) * (w * 0.3),
            y: h * 0.3 + Math.floor(i / 3) * (h * 0.4),
            targetX: w * 0.2 + ((i + 1) % 3) * (w * 0.3),
            targetY: h * 0.3 + Math.floor((i + 1) / 3) * (h * 0.4),
            progress: Math.random(),
            speed: 0.005 + Math.random() * 0.005,
          }))
          break

        case 'sparkles':
          particlesRef.current = Array.from({ length: 20 }, () => ({
            x: Math.random() * w,
            y: Math.random() * h,
            size: 1 + Math.random() * 3,
            phase: Math.random() * Math.PI * 2,
            speed: 0.02 + Math.random() * 0.03,
            vy: -0.2 - Math.random() * 0.3,
          }))
          break
      }
    }

    initParticles()
    const animate = () => {
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height

      ctx.clearRect(0, 0, w, h)

      const baseAlpha = isHovered ? 0.6 : 0.25
      const speedMultiplier = isHovered ? 2 : 1
      const rgb = colorRef.current
      const color = (alpha: number) => `rgba(${rgb}, ${alpha})`

      switch (theme) {
        case 'plug': {
          const plugs = particlesRef.current as {
            x: number
            y: number
            targetX: number
            targetY: number
            progress: number
            speed: number
          }[]

          // Draw static nodes
          const nodePositions = [
            { x: w * 0.2, y: h * 0.35 },
            { x: w * 0.5, y: h * 0.35 },
            { x: w * 0.8, y: h * 0.35 },
            { x: w * 0.2, y: h * 0.65 },
            { x: w * 0.5, y: h * 0.65 },
            { x: w * 0.8, y: h * 0.65 },
          ]

          // Draw connection lines
          ctx.strokeStyle = color(baseAlpha * 0.3)
          ctx.lineWidth = 1
          ctx.setLineDash([4, 4])
          nodePositions.forEach((n1, i) => {
            nodePositions.slice(i + 1).forEach((n2) => {
              if (Math.abs(n1.x - n2.x) < w * 0.35 || Math.abs(n1.y - n2.y) < h * 0.35) {
                ctx.beginPath()
                ctx.moveTo(n1.x, n1.y)
                ctx.lineTo(n2.x, n2.y)
                ctx.stroke()
              }
            })
          })
          ctx.setLineDash([])

          // Draw nodes
          nodePositions.forEach((n) => {
            ctx.beginPath()
            ctx.arc(n.x, n.y, 6, 0, Math.PI * 2)
            ctx.fillStyle = color(baseAlpha)
            ctx.fill()
            ctx.strokeStyle = color(baseAlpha * 1.5)
            ctx.lineWidth = 2
            ctx.stroke()
          })

          // Animated data packets
          plugs.forEach((p) => {
            p.progress += p.speed * speedMultiplier
            if (p.progress > 1) {
              p.progress = 0
              const fromIdx = Math.floor(Math.random() * nodePositions.length)
              const toIdx = (fromIdx + 1 + Math.floor(Math.random() * 3)) % nodePositions.length
              p.x = nodePositions[fromIdx].x
              p.y = nodePositions[fromIdx].y
              p.targetX = nodePositions[toIdx].x
              p.targetY = nodePositions[toIdx].y
            }

            const currentX = p.x + (p.targetX - p.x) * p.progress
            const currentY = p.y + (p.targetY - p.y) * p.progress
            ctx.beginPath()
            ctx.arc(currentX, currentY, 3, 0, Math.PI * 2)
            ctx.fillStyle = color(baseAlpha * 1.5)
            ctx.fill()
          })
          break
        }

        case 'sparkles': {
          const stars = particlesRef.current as {
            x: number
            y: number
            size: number
            phase: number
            speed: number
            vy: number
          }[]
          stars.forEach((s) => {
            s.phase += s.speed * speedMultiplier
            s.y += s.vy * speedMultiplier
            if (s.y < -10) {
              s.y = h + 10
              s.x = Math.random() * w
            }
            const alpha = ((Math.sin(s.phase) + 1) / 2) * baseAlpha
            ctx.beginPath()
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
            ctx.fillStyle = color(alpha)
            ctx.fill()
          })
          break
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      observer.disconnect()
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [theme, isHovered])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        maskImage: 'radial-gradient(80% 60% at 70% 40%, black 0%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(80% 60% at 70% 40%, black 0%, transparent 100%)',
      }}
    />
  )
}

function BentoCard({ feature, className }: { feature: Feature; className?: string }) {
  const { title, description, Icon, theme } = feature
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl',
        'bg-card/50 backdrop-blur border border-border/50',
        'hover:border-border/80 hover:-translate-y-1 transition-all duration-300',
        'shadow-[0_4px_12px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.06)]',
        'hover:shadow-[0_8px_24px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]',
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Canvas animation background */}
      <FeatureCanvas theme={theme} isHovered={isHovered} />

      {/* Content */}
      <div className="relative z-10 p-6">
        <div className="flex items-start gap-4 mb-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110">
            <Icon className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2 transition-transform duration-300 group-hover:translate-x-1">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed transition-colors duration-300 group-hover:text-foreground/70">
          {description}
        </p>
      </div>

      {/* Bottom gradient glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-linear-to-t from-primary/10 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>
  )
}

export function Features() {
  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[768px] lg:max-w-[1200px] mx-auto">
        {/* Section header */}
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">
            Supporting Skill Memory
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            What we offer: skill memory — and the SDKs to use it.
          </p>
        </div>

        {/* Two cards side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {FEATURES.map((feature) => (
            <BentoCard key={feature.title} feature={feature} className="min-h-[180px]" />
          ))}
        </div>

        {/* Closing statement */}
        <p className="text-center text-muted-foreground mt-12 max-w-2xl mx-auto">
          All of this exists to feed one thing: a skill memory layer you can read, edit, and move.
        </p>
      </div>
    </section>
  )
}
