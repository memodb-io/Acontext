'use client'

import { useRef, useEffect, useState } from 'react'
import { Layers, HardDrive, Database, Activity, Plug, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

type FeatureTheme = 'layers' | 'disk' | 'database' | 'activity' | 'plug' | 'sparkles'

interface Feature {
  title: string
  description: string
  Icon: typeof Layers
  theme: FeatureTheme
}

const leftFeatures: Feature[] = [
  {
    title: 'Context Engineering',
    description: 'Edit, compress, and summarize context on-the-fly — token_limit, middle_out, and session summary strategies keep your agents efficient without modifying stored messages.',
    Icon: Layers,
    theme: 'layers',
  },
  {
    title: 'Multimodal Short-term Memory',
    description:
      'Unified, persistent storage for all agent data — messages, files, and skills — eliminating fragmented backends (DB, S3, Redis).',
    Icon: Database,
    theme: 'database',
  },
  {
    title: 'Artifact Disk',
    description:
      'Filesystem-like workspace to store and share multi-modal outputs (.md, code, reports), ready for multi-agent collaboration.',
    Icon: HardDrive,
    theme: 'disk',
  },
]

const rightFeatures: Feature[] = [
  {
    title: 'Background Observer',
    description:
      'Automatically extracts tasks from agent conversations and tracks their status in real-time — from pending to running to success or failure.',
    Icon: Activity,
    theme: 'activity',
  },
  {
    title: 'Self-Learning',
    description:
      'Attach sessions to a Learning Space and Acontext automatically distills successful task outcomes into skills — agents improve with every run without manual curation.',
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

    // Initialize particles based on theme
    const initParticles = () => {
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height

      switch (theme) {
        case 'layers':
          particlesRef.current = Array.from({ length: 5 }, (_, i) => ({
            y: h * 0.3 + i * (h * 0.12),
            width: w * (0.3 + Math.random() * 0.4),
            x: Math.random() * w * 0.3,
            speed: (Math.random() - 0.5) * 0.3,
            alpha: 0.3 + i * 0.1,
          }))
          break

        case 'disk':
          particlesRef.current = Array.from({ length: 8 }, (_, i) => ({
            angle: (i / 8) * Math.PI * 2,
            radius: 30 + Math.random() * 20,
            speed: 0.005 + Math.random() * 0.005,
            size: 2 + Math.random() * 2,
          }))
          break

        case 'database':
          particlesRef.current = Array.from({ length: 15 }, () => ({
            x: w * 0.3 + Math.random() * w * 0.4,
            y: Math.random() * h,
            speed: 0.3 + Math.random() * 0.5,
            size: 2 + Math.random() * 3,
            alpha: Math.random(),
          }))
          break

        case 'activity':
          particlesRef.current = [
            { offset: 0, amplitude: 15, frequency: 0.02 },
            { offset: Math.PI, amplitude: 10, frequency: 0.025 },
          ]
          break

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
    let time = 0

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
        case 'layers': {
          const layers = particlesRef.current as {
            y: number
            width: number
            x: number
            speed: number
            alpha: number
          }[]
          layers.forEach((l) => {
            l.x += l.speed * speedMultiplier
            if (l.x > w * 0.3) l.speed = -Math.abs(l.speed)
            if (l.x < 0) l.speed = Math.abs(l.speed)

            ctx.fillStyle = color(l.alpha * baseAlpha)
            // Draw rounded rectangle manually for better compatibility
            const radius = 2
            const height = 4
            ctx.beginPath()
            ctx.moveTo(l.x + radius, l.y)
            ctx.lineTo(l.x + l.width - radius, l.y)
            ctx.arc(l.x + l.width - radius, l.y + radius, radius, -Math.PI / 2, 0)
            ctx.lineTo(l.x + l.width, l.y + height - radius)
            ctx.arc(l.x + l.width - radius, l.y + height - radius, radius, 0, Math.PI / 2)
            ctx.lineTo(l.x + radius, l.y + height)
            ctx.arc(l.x + radius, l.y + height - radius, radius, Math.PI / 2, Math.PI)
            ctx.lineTo(l.x, l.y + radius)
            ctx.arc(l.x + radius, l.y + radius, radius, Math.PI, -Math.PI / 2)
            ctx.closePath()
            ctx.fill()
          })
          break
        }

        case 'disk': {
          const centerX = w * 0.7
          const centerY = h * 0.5

          // Draw disk circles
          ctx.strokeStyle = color(baseAlpha * 0.5)
          ctx.lineWidth = 1
          ;[30, 50, 70].forEach((radius) => {
            ctx.beginPath()
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
            ctx.stroke()
          })

          // Orbiting dots
          const dots = particlesRef.current as {
            angle: number
            radius: number
            speed: number
            size: number
          }[]
          dots.forEach((d) => {
            d.angle += d.speed * speedMultiplier
            const x = centerX + Math.cos(d.angle) * d.radius
            const y = centerY + Math.sin(d.angle) * d.radius
            ctx.beginPath()
            ctx.arc(x, y, d.size, 0, Math.PI * 2)
            ctx.fillStyle = color(baseAlpha)
            ctx.fill()
          })
          break
        }

        case 'database': {
          const data = particlesRef.current as {
            x: number
            y: number
            speed: number
            size: number
            alpha: number
          }[]
          data.forEach((d) => {
            d.y -= d.speed * speedMultiplier
            if (d.y < -10) {
              d.y = h + 10
              d.x = w * 0.3 + Math.random() * w * 0.4
            }
            ctx.fillStyle = color(d.alpha * baseAlpha)
            ctx.fillRect(d.x - d.size / 2, d.y - d.size / 2, d.size, d.size)
          })

          // Draw database outline
          ctx.strokeStyle = color(baseAlpha * 0.5)
          ctx.lineWidth = 1
          const dbX = w * 0.35
          const dbW = w * 0.3
          ctx.beginPath()
          ctx.ellipse(dbX + dbW / 2, h * 0.25, dbW / 2, 10, 0, 0, Math.PI * 2)
          ctx.stroke()
          ctx.beginPath()
          ctx.ellipse(dbX + dbW / 2, h * 0.75, dbW / 2, 10, 0, 0, Math.PI * 2)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(dbX, h * 0.25)
          ctx.lineTo(dbX, h * 0.75)
          ctx.moveTo(dbX + dbW, h * 0.25)
          ctx.lineTo(dbX + dbW, h * 0.75)
          ctx.stroke()
          break
        }

        case 'activity': {
          const waves = particlesRef.current as {
            offset: number
            amplitude: number
            frequency: number
          }[]
          waves.forEach((wave, idx) => {
            ctx.beginPath()
            ctx.strokeStyle = color(baseAlpha * (1 - idx * 0.3))
            ctx.lineWidth = 2 - idx * 0.5

            for (let x = 0; x < w; x += 2) {
              const y =
                h / 2 +
                Math.sin(x * wave.frequency + time * speedMultiplier * 0.05 + wave.offset) *
                  wave.amplitude
              if (x === 0) {
                ctx.moveTo(x, y)
              } else {
                ctx.lineTo(x, y)
              }
            }
            ctx.stroke()
          })
          break
        }

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

      time++
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
            Platform Capabilities
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            The production-grade infrastructure your agents need — short-term memory, mid-term state, long-term skill, and more.
          </p>
        </div>

        {/* Bento grid - two columns, 3+3 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left column - 3 cards */}
          <div className="flex flex-col gap-4">
            <BentoCard feature={leftFeatures[0]} className="min-h-[180px]" />
            <BentoCard feature={leftFeatures[1]} className="min-h-[180px]" />
            <BentoCard feature={leftFeatures[2]} className="min-h-[180px]" />
          </div>

          {/* Right column - 3 cards */}
          <div className="flex flex-col gap-4">
            <BentoCard feature={rightFeatures[0]} className="min-h-[180px]" />
            <BentoCard feature={rightFeatures[1]} className="min-h-[180px]" />
            <BentoCard feature={rightFeatures[2]} className="flex-1 min-h-[180px]" />
          </div>
        </div>
      </div>
    </section>
  )
}
