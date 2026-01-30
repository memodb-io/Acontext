'use client'

import { useRef, useEffect, useState } from 'react'
import { Sparkles, Layers, HardDrive, Github, Database, Activity, Plug } from 'lucide-react'
import { cn } from '@/lib/utils'

type FeatureTheme = 'sparkles' | 'layers' | 'disk' | 'github' | 'database' | 'activity' | 'plug'

interface Feature {
  title: string
  description: string
  Icon: typeof Sparkles
  theme: FeatureTheme
}

const leftFeatures: Feature[] = [
  {
    title: 'Sandbox Skills',
    description:
      'Enable agents to practice and learn in isolated environments. Capture successful tool-calling patterns and transform them into reusable skills.',
    Icon: Sparkles,
    theme: 'sparkles',
  },
  {
    title: 'Context Engineering',
    description: 'Reduction, Compression, Offloading, Claude skills …… all in one backend',
    Icon: Layers,
    theme: 'layers',
  },
  {
    title: 'Artifact Disk',
    description:
      'Filesystem-like workspace to store and share multi-modal outputs (.md, code, reports), ready for multiple agents collaboration.',
    Icon: HardDrive,
    theme: 'disk',
  },
  {
    title: 'Open Source',
    description:
      'Architecture built on community standards. Every major dependency has a direct open-source alternative to ensure stack portability.',
    Icon: Github,
    theme: 'github',
  },
]

const rightFeatures: Feature[] = [
  {
    title: 'Multimodal Context Storage',
    description:
      'Unified, persistent storage for all agent data, eliminating fragmented backends (DB, S3, Redis).',
    Icon: Database,
    theme: 'database',
  },
  {
    title: 'Background Observer',
    description:
      'An intelligent scratchpad for long-running tasks, trace agent status and success rates in real-time.',
    Icon: Activity,
    theme: 'activity',
  },
  {
    title: 'SDKs & Integrations',
    description:
      'Ready to use with OpenAI, Anthropic, LangGraph, Agno, and other popular agent frameworks',
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
        case 'sparkles':
          particlesRef.current = Array.from({ length: 20 }, () => ({
            x: Math.random() * w,
            y: Math.random() * h,
            size: Math.random() * 3 + 1,
            alpha: Math.random(),
            speed: Math.random() * 0.02 + 0.01,
            phase: Math.random() * Math.PI * 2,
          }))
          break

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

        case 'github':
          particlesRef.current = Array.from({ length: 12 }, () => ({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            size: 3 + Math.random() * 2,
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
        case 'sparkles': {
          const particles = particlesRef.current as {
            x: number
            y: number
            size: number
            alpha: number
            speed: number
            phase: number
          }[]
          particles.forEach((p) => {
            p.phase += p.speed * speedMultiplier
            const twinkle = (Math.sin(p.phase) + 1) / 2
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.size * (0.5 + twinkle * 0.5), 0, Math.PI * 2)
            ctx.fillStyle = color(twinkle * baseAlpha)
            ctx.fill()

            // Draw sparkle rays
            if (twinkle > 0.7) {
              ctx.strokeStyle = color((twinkle - 0.7) * baseAlpha * 2)
              ctx.lineWidth = 0.5
              const rayLen = p.size * 2
              for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2 + time * 0.5
                ctx.beginPath()
                ctx.moveTo(p.x, p.y)
                ctx.lineTo(p.x + Math.cos(angle) * rayLen, p.y + Math.sin(angle) * rayLen)
                ctx.stroke()
              }
            }
          })
          break
        }

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

        case 'github': {
          const nodes = particlesRef.current as {
            x: number
            y: number
            vx: number
            vy: number
            size: number
          }[]
          // Move nodes
          nodes.forEach((n) => {
            n.x += n.vx * speedMultiplier
            n.y += n.vy * speedMultiplier
            if (n.x < 0 || n.x > w) n.vx *= -1
            if (n.y < 0 || n.y > h) n.vy *= -1
          })

          // Draw connections
          ctx.strokeStyle = color(baseAlpha * 0.4)
          ctx.lineWidth = 0.5
          nodes.forEach((n1, i) => {
            nodes.slice(i + 1).forEach((n2) => {
              const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y)
              if (dist < 80) {
                ctx.beginPath()
                ctx.moveTo(n1.x, n1.y)
                ctx.lineTo(n2.x, n2.y)
                ctx.stroke()
              }
            })
          })

          // Draw nodes
          nodes.forEach((n) => {
            ctx.beginPath()
            ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2)
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
            Context Data Platform for Self-learning Agents
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Everything you need to build, deploy, and scale production-ready AI agents
          </p>
        </div>

        {/* Bento grid - two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left column - 4 cards */}
          <div className="flex flex-col gap-4">
            <BentoCard feature={leftFeatures[0]} className="min-h-[180px]" />
            <BentoCard feature={leftFeatures[1]} className="min-h-[160px]" />
            <BentoCard feature={leftFeatures[2]} className="min-h-[160px]" />
            <BentoCard feature={leftFeatures[3]} className="min-h-[160px]" />
          </div>

          {/* Right column - 3 cards */}
          <div className="flex flex-col gap-4">
            <BentoCard feature={rightFeatures[0]} className="min-h-[180px]" />
            <BentoCard feature={rightFeatures[1]} className="min-h-[200px]" />
            <BentoCard feature={rightFeatures[2]} className="flex-1 min-h-[200px]" />
          </div>
        </div>
      </div>
    </section>
  )
}
