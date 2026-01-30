'use client'

import { useRef, useEffect, useCallback } from 'react'
import { gsap } from 'gsap'
import type { ColorStop } from './scene-data'

interface SpiralCanvasProps {
  colorStops: ColorStop[]
  className?: string
  rotationSpeed?: number // degrees per second, default 2
}

// Interpolate between two colors
function interpolateColor(color1: string, color2: string, factor: number): string {
  const hex1 = color1.replace('#', '')
  const hex2 = color2.replace('#', '')

  const r1 = parseInt(hex1.substring(0, 2), 16)
  const g1 = parseInt(hex1.substring(2, 4), 16)
  const b1 = parseInt(hex1.substring(4, 6), 16)

  const r2 = parseInt(hex2.substring(0, 2), 16)
  const g2 = parseInt(hex2.substring(2, 4), 16)
  const b2 = parseInt(hex2.substring(4, 6), 16)

  const r = Math.round(r1 + (r2 - r1) * factor)
  const g = Math.round(g1 + (g2 - g1) * factor)
  const b = Math.round(b1 + (b2 - b1) * factor)

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// Interpolate between two color schemes
function interpolateColorScheme(
  scheme1: ColorStop[],
  scheme2: ColorStop[],
  factor: number
): ColorStop[] {
  return scheme1.map((stop, i) => ({
    pos: stop.pos,
    color: interpolateColor(stop.color, scheme2[i]?.color || stop.color, factor),
  }))
}

export function SpiralCanvas({ colorStops, className = '', rotationSpeed = 2 }: SpiralCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const currentColorStopsRef = useRef<ColorStop[]>(colorStops)
  const targetColorStopsRef = useRef<ColorStop[]>(colorStops)
  const transitionProgressRef = useRef({ value: 1 })
  const rotationAngleRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const cx = w / 2
    const cy = h / 2
    const size = Math.max(w, h) * 2.2

    // Get interpolated colors
    const progress = transitionProgressRef.current.value
    const activeColorStops =
      progress >= 1
        ? targetColorStopsRef.current
        : interpolateColorScheme(
            currentColorStopsRef.current,
            targetColorStopsRef.current,
            progress
          )

    // Clear canvas
    ctx.fillStyle = '#080810'
    ctx.fillRect(0, 0, w, h)

    // Draw petal layers
    const numPetals = 58
    const anglePerPetal = 6 * (Math.PI / 180)
    const petalLength = size
    const petalWidth = size * 0.08

    ctx.save()
    ctx.translate(cx, cy)

    for (let i = 0; i < numPetals; i++) {
      // Calculate petal angle including rotation
      const petalAngle = i * anglePerPetal + rotationAngleRef.current * (Math.PI / 180)
      
      ctx.save()
      ctx.rotate(petalAngle)

      // Create gradient from top-left to bottom-right of the petal strip
      // (relative to each petal, matching the HTML reference)
      const gradient = ctx.createLinearGradient(
        -petalLength * 0.3,
        -petalWidth * 2,
        petalLength * 0.5,
        petalWidth * 2
      )

      activeColorStops.forEach((stop) => {
        gradient.addColorStop(stop.pos, stop.color)
      })

      ctx.fillStyle = gradient
      ctx.globalAlpha = 0.7

      // Draw petal
      ctx.beginPath()
      ctx.rect(-petalLength * 0.1, -petalWidth / 2, petalLength, petalWidth)
      ctx.fill()

      ctx.restore()
    }

    ctx.restore()
    ctx.globalAlpha = 1
  }, [])

  const resize = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
      canvas.width = rect.width
      canvas.height = rect.height
    }

    draw()
  }, [draw])

  // Handle color transition
  useEffect(() => {
    // Store current as the starting point
    currentColorStopsRef.current = interpolateColorScheme(
      currentColorStopsRef.current,
      targetColorStopsRef.current,
      transitionProgressRef.current.value
    )

    // Set new target
    targetColorStopsRef.current = colorStops

    // Reset progress
    transitionProgressRef.current.value = 0

    // Animate transition
    gsap.to(transitionProgressRef.current, {
      value: 1,
      duration: 0.8,
      ease: 'power2.inOut',
      onUpdate: draw,
    })
  }, [colorStops, draw])

  // Animation loop for continuous rotation
  useEffect(() => {
    const animate = (currentTime: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = currentTime
      }

      const deltaTime = (currentTime - lastTimeRef.current) / 1000 // convert to seconds
      lastTimeRef.current = currentTime

      // Update rotation angle
      rotationAngleRef.current += rotationSpeed * deltaTime

      // Keep angle within 0-360 to prevent overflow
      if (rotationAngleRef.current >= 360) {
        rotationAngleRef.current -= 360
      }

      draw()
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [rotationSpeed, draw])

  // Initial setup
  useEffect(() => {
    resize()

    const resizeObserver = new ResizeObserver(resize)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    window.addEventListener('resize', resize)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [resize])

  return (
    <div ref={containerRef} className={`absolute inset-0 ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0 rounded-2xl" />
    </div>
  )
}

export default SpiralCanvas
