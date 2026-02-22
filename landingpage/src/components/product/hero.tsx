'use client'

import React, { useEffect, useRef } from 'react'
import {
  Database,
  Sparkles,
  Layers,
  Activity,
  HardDrive,
  Zap,
  Brain,
  Search,
  Code,
  Cloud,
  Shield,
  GitBranch,
  BarChart3,
  FileText,
  MessageSquare,
  FolderTree,
  BookOpen,
  Globe,
  Settings,
} from 'lucide-react'

// Inner circle icons (closer to title) - 10 icons
// Removed angleOffset for uniform distribution
const innerIcons = [
  { Icon: Database, color: 'rgba(62, 207, 142, 0.7)' },
  { Icon: Sparkles, color: 'rgba(139, 92, 246, 0.7)' },
  { Icon: Layers, color: 'rgba(59, 130, 246, 0.7)' },
  { Icon: Activity, color: 'rgba(236, 72, 153, 0.7)' },
  { Icon: Code, color: 'rgba(34, 197, 94, 0.7)' },
  { Icon: Cloud, color: 'rgba(245, 158, 11, 0.7)' },
  { Icon: MessageSquare, color: 'rgba(14, 165, 233, 0.7)' },
  { Icon: FolderTree, color: 'rgba(168, 85, 247, 0.7)' },
  { Icon: Brain, color: 'rgba(251, 146, 60, 0.7)' },
  { Icon: BarChart3, color: 'rgba(20, 184, 166, 0.7)' },
]

// Outer circle icons (farther from title) - 12 icons
// Removed angleOffset for uniform distribution
const outerIcons = [
  { Icon: HardDrive, color: 'rgba(245, 158, 11, 0.6)' },
  { Icon: Zap, color: 'rgba(34, 197, 94, 0.6)' },
  { Icon: Search, color: 'rgba(14, 165, 233, 0.6)' },
  { Icon: Shield, color: 'rgba(239, 68, 68, 0.6)' },
  { Icon: GitBranch, color: 'rgba(99, 102, 241, 0.6)' },
  { Icon: FileText, color: 'rgba(251, 146, 60, 0.6)' },
  { Icon: BookOpen, color: 'rgba(139, 92, 246, 0.6)' },
  { Icon: Globe, color: 'rgba(59, 130, 246, 0.6)' },
  { Icon: Settings, color: 'rgba(168, 85, 247, 0.6)' },
  { Icon: Database, color: 'rgba(62, 207, 142, 0.6)' },
  { Icon: Layers, color: 'rgba(236, 72, 153, 0.6)' },
  { Icon: Activity, color: 'rgba(20, 184, 166, 0.6)' },
]

// Orbital radius constants - used for both animation and SVG trajectory
// Base radius values, will be scaled responsively
const BASE_INNER_RADIUS = 300
const BASE_OUTER_RADIUS = 480

// Helper function to reduce color opacity for borders
const reduceOpacity = (color: string, opacity: number): string => {
  // Extract rgba values
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (match) {
    const r = match[1]
    const g = match[2]
    const b = match[3]
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }
  return color
}

// Trajectory circles component using theme colors
function TrajectoryCircles({
  innerRadius,
  outerRadius,
}: {
  innerRadius: number
  outerRadius: number
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [strokeColor, setStrokeColor] = React.useState('rgba(62, 207, 142, 0.2)')

  useEffect(() => {
    // Get computed primary color from CSS variable and convert to rgba with opacity
    const updateColor = () => {
      if (svgRef.current) {
        // Check if dark mode is active
        const isDark = document.documentElement.classList.contains('dark')
        
        // Create a temporary element to get computed color
        const tempEl = document.createElement('div')
        tempEl.style.color = 'hsl(var(--primary))'
        document.body.appendChild(tempEl)
        const computedColor = getComputedStyle(tempEl).color
        document.body.removeChild(tempEl)

        // Extract RGB values and add opacity
        // Use higher opacity in dark mode for better visibility
        const rgbMatch = computedColor.match(/\d+/g)
        if (rgbMatch && rgbMatch.length >= 3) {
          const r = rgbMatch[0]
          const g = rgbMatch[1]
          const b = rgbMatch[2]
          const opacity = isDark ? 0.5 : 0.2 // Higher opacity in dark mode
          setStrokeColor(`rgba(${r}, ${g}, ${b}, ${opacity})`)
        }
      }
    }

    updateColor()

    // Listen for theme changes
    const observer = new MutationObserver(updateColor)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [])

  // Calculate SVG size to accommodate both circles
  const svgSize = Math.max(outerRadius * 2 + 100, 800)
  const center = svgSize / 2

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <svg
        ref={svgRef}
        className="absolute"
        style={{
          width: `${svgSize}px`,
          height: `${svgSize}px`,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
      >
        {/* Inner circle trajectory */}
        <circle
          cx={center}
          cy={center}
          r={innerRadius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        {/* Outer circle trajectory */}
        <circle
          cx={center}
          cy={center}
          r={outerRadius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
      </svg>
    </div>
  )
}

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const innerIconsRef = useRef<HTMLDivElement>(null)
  const outerIconsRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number | null>(null)
  const [scale, setScale] = React.useState(1)

  // Calculate responsive scale based on container width
  useEffect(() => {
    const calculateScale = () => {
      const container = sectionRef.current
      if (!container) return

      const containerWidth = container.offsetWidth
      // Scale down on smaller screens to fit within container
      // Use 90% of available width to ensure icons don't get clipped
      const maxRadius = Math.min(containerWidth * 0.45, BASE_OUTER_RADIUS)
      const newScale = maxRadius / BASE_OUTER_RADIUS
      setScale(Math.max(0.5, Math.min(1, newScale))) // Clamp between 0.5 and 1
    }

    calculateScale()
    window.addEventListener('resize', calculateScale)
    return () => window.removeEventListener('resize', calculateScale)
  }, [])

  useEffect(() => {
    const title = titleRef.current
    const innerContainer = innerIconsRef.current
    const outerContainer = outerIconsRef.current

    if (!title || !innerContainer || !outerContainer) return

    // Animate title on mount
    title.style.opacity = '0'
    title.style.transform = 'translateY(30px)'

    const animateTitle = () => {
      const start = performance.now()
      const duration = 800

      const animate = (currentTime: number) => {
        const elapsed = currentTime - start
        const progress = Math.min(elapsed / duration, 1)
        const ease = 1 - Math.pow(1 - progress, 3) // ease-out cubic

        title.style.opacity = String(ease)
        title.style.transform = `translateY(${30 * (1 - ease)}px)`

        if (progress < 1) {
          requestAnimationFrame(animate)
        }
      }
      requestAnimationFrame(animate)
    }
    animateTitle()

    // Orbital rotation animation with uniform distribution
    let angle = 0
    const innerSpeed = (2 * Math.PI) / 60 // 60 seconds per rotation (clockwise) - half speed
    const outerSpeed = (2 * Math.PI) / 90 // 90 seconds per rotation (counter-clockwise) - half speed

    // Phase offset to stagger inner and outer circles, preventing overlap
    // Offset by half the spacing between outer icons
    const outerPhaseOffset = (Math.PI * 2) / outerIcons.length / 2

    const animate = () => {
      angle += 0.005 // Half speed

      // Calculate responsive radii
      const innerRadius = BASE_INNER_RADIUS * scale
      const outerRadius = BASE_OUTER_RADIUS * scale

      // Inner circle (clockwise) with uniform distribution
      const innerElements = innerContainer.querySelectorAll('.orbital-icon')
      innerElements.forEach((icon, index) => {
        // Uniform distribution: each icon gets equal angle spacing
        const baseAngle = (index / innerIcons.length) * Math.PI * 2
        const iconAngle = baseAngle + angle * innerSpeed
        const x = Math.cos(iconAngle) * innerRadius
        const y = Math.sin(iconAngle) * innerRadius
        ;(icon as HTMLElement).style.transform = `translate(${x}px, ${y}px)`
      })

      // Outer circle (counter-clockwise) with uniform distribution and phase offset
      const outerElements = outerContainer.querySelectorAll('.orbital-icon')
      outerElements.forEach((icon, index) => {
        // Uniform distribution with phase offset to avoid overlap with inner circle
        const baseAngle = (index / outerIcons.length) * Math.PI * 2 + outerPhaseOffset
        const iconAngle = baseAngle - angle * outerSpeed
        const x = Math.cos(iconAngle) * outerRadius
        const y = Math.sin(iconAngle) * outerRadius
        ;(icon as HTMLElement).style.transform = `translate(${x}px, ${y}px)`
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    // Fade in icons
    const allIcons = [
      ...innerContainer.querySelectorAll('.orbital-icon'),
      ...outerContainer.querySelectorAll('.orbital-icon'),
    ]
    allIcons.forEach((icon, index) => {
      ;(icon as HTMLElement).style.opacity = '0'
      setTimeout(() => {
        ;(icon as HTMLElement).style.transition = 'opacity 0.6s ease-out'
        ;(icon as HTMLElement).style.opacity = '1'
      }, index * 30)
    })

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [scale])

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[calc(35vh*4/3)] flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 overflow-hidden"
    >
      {/* Background container with max-width */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center">
        <div className="relative w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] h-full">
          {/* Background gradient */}
          <div className="absolute inset-0">
            <div className="absolute top-1/4 left-1/4 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-accent/5 rounded-full blur-3xl" />
          </div>

          {/* Orbital trajectory circles */}
          <TrajectoryCircles 
            innerRadius={BASE_INNER_RADIUS * scale} 
            outerRadius={BASE_OUTER_RADIUS * scale} 
          />

          {/* Orbital icons - Inner circle */}
          <div
            ref={innerIconsRef}
            className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden"
          >
            {innerIcons.map(({ Icon, color }, index) => (
              <div
                key={`inner-${index}`}
                className="orbital-icon absolute will-change-transform flex items-center justify-center"
                style={{
                  filter: `drop-shadow(0 0 8px ${color})`,
                }}
              >
                <div
                  className="rounded-full border flex items-center justify-center"
                  style={{
                    borderColor: reduceOpacity(color, 0.2),
                    backgroundColor: `${color}10`,
                    padding: '10px',
                    borderWidth: '1.5px',
                  }}
                >
                  <Icon
                    className="w-6 h-6 sm:w-8 sm:h-8"
                    style={{
                      color: color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Orbital icons - Outer circle with blur */}
          <div
            ref={outerIconsRef}
            className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden"
            style={{
              filter: 'blur(1px)',
            }}
          >
            {outerIcons.map(({ Icon, color }, index) => (
              <div
                key={`outer-${index}`}
                className="orbital-icon absolute will-change-transform flex items-center justify-center"
                style={{
                  filter: `drop-shadow(0 0 8px ${color})`,
                }}
              >
                <div
                  className="rounded-full border flex items-center justify-center"
                  style={{
                    borderColor: reduceOpacity(color, 0.2),
                    backgroundColor: `${color}10`,
                    padding: '12px',
                    borderWidth: '1.5px',
                  }}
                >
                  <Icon
                    className="w-7 h-7 sm:w-9 sm:h-9"
                    style={{
                      color: color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] mx-auto text-center space-y-6 pt-16 pb-24 relative z-10">
        <h1
          ref={titleRef}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight"
        >
          <span className="hero-text-gradient">Context Data Platform</span>
        </h1>
        <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          Store, observe, and let your agents learn and grow from every run
        </p>
      </div>
    </section>
  )
}
