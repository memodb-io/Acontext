'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { PullCordAnimation } from '@/components/animation/pull-cord-animation'

/**
 * Single particle state definition.
 * Each particle behaves independently and is updated per frame.
 */
interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  pulsePhase: number
  rotation: number
  rotationSpeed: number
}

interface ParticleCanvasProps {
  className?: string
}

/**
 * ParticleCanvas
 *
 * A full-area canvas background with:
 * - DPR-aware rendering
 * - Particle swarm with mouse interaction
 * - Theme-aware logo rendering
 * - Radial light beam effect
 *
 * IMPORTANT DESIGN RULE:
 * The canvas NEVER decides its own size.
 * Its size is always derived from the DOM layout.
 */
export function ParticleCanvas({ className }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Mutable refs for animation state (no React re-renders)
  const particlesRef = useRef<Particle[]>([])
  const animationRef = useRef<number>(0)

  // Mouse position in canvas coordinate space
  const mouseRef = useRef({ x: -1000, y: -1000 })

  // Theme-aware logos
  const logoBlackRef = useRef<HTMLImageElement | null>(null)
  const logoWhiteRef = useRef<HTMLImageElement | null>(null)
  const isDarkRef = useRef(false)

  // Animation timing
  const startTimeRef = useRef<number | null>(null)

  // Pull cord hover state
  const [isCordHovered, setIsCordHovered] = useState(false)
  const cordHoveredRef = useRef(false)

  /**
   * The single source of truth for canvas size.
   * All drawing and interaction logic relies on this.
   */
  const dimensionsRef = useRef({
    width: 0,
    height: 0,
    dpr: 1,
  })

  /**
   * Initialize particles based on canvas area.
   * Particle count scales with visible area but is capped.
   */
  const initParticles = useCallback((width: number, height: number) => {
    const particleCount = Math.min(Math.floor((width * height) / 25000), 50)
    const particles: Particle[] = []

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 8 + 6,
        opacity: Math.random() * 0.25 + 0.1,
        pulsePhase: Math.random() * Math.PI * 2,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.005,
      })
    }

    particlesRef.current = particles
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    /* ------------------------------------------------------------------ */
    /* Asset loading                                                        */
    /* ------------------------------------------------------------------ */

    const logoBlack = new Image()
    logoBlack.src = '/nav-logo-black.svg'
    logoBlackRef.current = logoBlack

    const logoWhite = new Image()
    logoWhite.src = '/nav-logo-white.svg'
    logoWhiteRef.current = logoWhite

    /* ------------------------------------------------------------------ */
    /* Theme detection (DOM-based, framework-agnostic)                      */
    /* ------------------------------------------------------------------ */

    const checkTheme = () => {
      isDarkRef.current = document.documentElement.classList.contains('dark')
    }

    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { attributes: true })
    checkTheme()

    /* ------------------------------------------------------------------ */
    /* Canvas resize logic (CRITICAL PART)                                  */
    /* ------------------------------------------------------------------ */

    /**
     * Synchronizes:
     * - CSS size (layout)
     * - Drawing buffer size (canvas.width / height)
     * - DPR scaling
     *
     * If any of these steps are skipped,
     * the canvas will appear "small" or blurry.
     */
    const resizeCanvas = () => {
      // Get parent container size instead of canvas itself
      // This ensures we get the correct size even if canvas hasn't rendered yet
      const parent = canvas.parentElement
      if (!parent) return

      const rect = parent.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1

      let width = rect.width || window.innerWidth
      let height = rect.height || window.innerHeight

      // Ensure valid dimensions
      if (!width || !height || width <= 0 || height <= 0) {
        width = window.innerWidth || 1920
        height = window.innerHeight || 1080
      }

      // Only update if size actually changed
      if (dimensionsRef.current.width === width && dimensionsRef.current.height === height) {
        return
      }

      dimensionsRef.current = { width, height, dpr }

      // Set actual drawing buffer size
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)

      // Match CSS size exactly
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      // Reset transform before scaling (important)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)

      // Recreate particles for the new area
      initParticles(width, height)

      // Reset mouse so particles do not "jump"
      mouseRef.current = { x: -1000, y: -1000 }
    }

    let resizeRaf: number | null = null
    const handleResize = () => {
      if (resizeRaf) return
      resizeRaf = requestAnimationFrame(() => {
        resizeCanvas()
        resizeRaf = null
      })
    }

    // Use ResizeObserver to watch parent container size changes
    const resizeObserver = new ResizeObserver(() => {
      handleResize()
    })

    const parent = canvas.parentElement
    if (parent) {
      resizeObserver.observe(parent)
    }

    /* ------------------------------------------------------------------ */
    /* Mouse mapping (CSS → canvas coordinate space)                        */
    /* ------------------------------------------------------------------ */

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const { width, height } = dimensionsRef.current

      // Correct mapping even if canvas is scaled
      const x = ((e.clientX - rect.left) / rect.width) * width
      const y = ((e.clientY - rect.top) / rect.height) * height

      if (x >= 0 && x <= width && y >= 0 && y <= height) {
        mouseRef.current = { x, y }
      } else {
        mouseRef.current = { x: -1000, y: -1000 }
      }

      // Check if mouse is in the top center area (where cord should appear)
      const sectionCenterX = rect.left + rect.width / 2
      const topCenterArea = {
        left: sectionCenterX - 50, // Narrower area
        right: sectionCenterX + 50,
        top: rect.top,
        bottom: rect.top + 150, // Smaller area
      }

      const isInCordArea =
        e.clientX >= topCenterArea.left &&
        e.clientX <= topCenterArea.right &&
        e.clientY >= topCenterArea.top &&
        e.clientY <= topCenterArea.bottom

      // Only update state if value actually changed
      if (isInCordArea !== cordHoveredRef.current) {
        cordHoveredRef.current = isInCordArea
        setIsCordHovered(isInCordArea)
      }
    }

    // Delay initial resize to ensure DOM is fully laid out
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resizeCanvas()
      })
    })

    window.addEventListener('resize', handleResize)
    window.addEventListener('mousemove', handleMouseMove, { passive: true })

    // Handle mouse leave to reset cord hover
    const handleMouseLeave = () => {
      if (cordHoveredRef.current) {
        cordHoveredRef.current = false
        setIsCordHovered(false)
      }
      mouseRef.current = { x: -1000, y: -1000 }
    }

    // Listen for reset event from pull cord
    const handleReset = () => {
      startTimeRef.current = null
    }

    window.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('particle-canvas-reset', handleReset)

    /* ------------------------------------------------------------------ */
    /* Animation loop                                                       */
    /* ------------------------------------------------------------------ */

    let time = 0

    const animate = () => {
      const { width, height } = dimensionsRef.current

      // Guard: Skip animation if dimensions are invalid
      if (!width || !height || !isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      ctx.clearRect(0, 0, width, height)

      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now()
      }

      /* ---------- Light beam ---------- */

      const elapsed = (Date.now() - startTimeRef.current) / 1000

      // Initial flicker effect: dark-bright-dark-bright (like turning on a light)
      let beamOpacity: number
      if (elapsed < 0.2) {
        // 0-0.2s: dark
        beamOpacity = 0.05
      } else if (elapsed < 0.4) {
        // 0.2-0.4s: bright
        beamOpacity = 0.15
      } else if (elapsed < 0.6) {
        // 0.4-0.6s: dark
        beamOpacity = 0.05
      } else if (elapsed < 0.8) {
        // 0.6-0.8s: bright
        beamOpacity = 0.15
      } else {
        // After 0.8s: stable at visible state (not disappearing)
        beamOpacity = 0.3
      }

      // Offset to start below header (header is h-16 = 64px, add some margin)
      const headerOffset = 64

      const aspectRatio = height > 0 ? width / height : 1
      const topWidth = Math.max(
        180, // Minimum width 180px (reduced from 250)
        width * Math.min(0.4, Math.max(0.25, 0.25 + (aspectRatio - 1) * 0.04)),
      )
      const bottomWidth = Math.max(
        280, // Minimum width 280px (reduced from 350)
        width * Math.min(0.85, aspectRatio > 1.5 ? 0.85 : 0.7 + (aspectRatio - 0.75) * 0.15),
      )
      let beamHeight = height * (aspectRatio < 1 ? 0.95 : 0.85) // Reduced from 0.99/0.9
      // Ensure beam doesn't exceed canvas height
      beamHeight = Math.min(beamHeight, height - headerOffset)

      // Guard: Ensure all calculated values are finite
      if (
        !isFinite(aspectRatio) ||
        !isFinite(topWidth) ||
        !isFinite(bottomWidth) ||
        !isFinite(beamHeight)
      ) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      let centerX = width / 2
      const mouse = mouseRef.current
      if (mouse.x >= 0 && mouse.x <= width) {
        centerX += (mouse.x - width / 2) * 0.02
      }

      // Guard: Ensure centerX is finite
      if (!isFinite(centerX)) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      // Apply blur filter for diffusion effect
      ctx.filter = 'blur(25px)'

      // Use linear gradient (like the SVG reference) with theme-aware colors
      const g = ctx.createLinearGradient(centerX, headerOffset, centerX, headerOffset + beamHeight)
      if (isDarkRef.current) {
        // Dark mode: white gradient
        g.addColorStop(0, `rgba(255,255,255,${0.2 * beamOpacity})`)
        g.addColorStop(1, 'rgba(255,255,255,0)')
      } else {
        // Light mode: green theme color
        g.addColorStop(0, `rgba(62,207,142,${1 * beamOpacity})`)
        g.addColorStop(1, 'rgba(62,207,142,0)')
      }

      ctx.beginPath()
      ctx.moveTo(centerX - topWidth / 2, headerOffset)
      ctx.lineTo(centerX + topWidth / 2, headerOffset)
      ctx.lineTo(centerX + bottomWidth / 2, headerOffset + beamHeight)
      ctx.lineTo(centerX - bottomWidth / 2, headerOffset + beamHeight)
      ctx.closePath()

      ctx.fillStyle = g
      ctx.fill()

      // Add bright highlight bar at the top edge (fully opaque, no blur, theme color)
      // Center bright, fade to sides, opacity follows beamOpacity
      ctx.filter = 'none' // No blur for sharp highlight
      const highlightHeight = 4 // Reduced height
      const highlightG = ctx.createLinearGradient(
        centerX - topWidth / 2,
        headerOffset,
        centerX + topWidth / 2,
        headerOffset,
      )
      // Use theme color (green) - bright in center, fade to sides
      // Center opacity follows beamOpacity (multiply by 2 for better visibility)
      const highlightOpacity = beamOpacity * 2
      highlightG.addColorStop(0, 'rgba(62,207,142,0)') // Left edge: transparent
      highlightG.addColorStop(0.5, `rgba(62,207,142,${highlightOpacity})`) // Center: follows beamOpacity
      highlightG.addColorStop(1, 'rgba(62,207,142,0)') // Right edge: transparent

      ctx.beginPath()
      ctx.moveTo(centerX - topWidth / 2, headerOffset)
      ctx.lineTo(centerX + topWidth / 2, headerOffset)
      ctx.lineTo(centerX + topWidth / 2, headerOffset + highlightHeight)
      ctx.lineTo(centerX - topWidth / 2, headerOffset + highlightHeight)
      ctx.closePath()

      ctx.fillStyle = highlightG
      ctx.fill()

      // Reset filter to avoid affecting particles
      ctx.filter = 'none'

      /* ---------- Particles ---------- */

      const logo = isDarkRef.current ? logoWhiteRef.current : logoBlackRef.current
      const particles = particlesRef.current
      time += 0.01

      particles.forEach((p, _i) => {
        // Physics update
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.rotationSpeed

        if (p.x < 0 || p.x > width) p.vx *= -1
        if (p.y < 0 || p.y > height) p.vy *= -1

        // Mouse attraction
        const dx = mouse.x - p.x
        const dy = mouse.y - p.y
        const dist = Math.hypot(dx, dy)

        if (dist < 250 && dist > 0 && isFinite(dist)) {
          const f = ((250 - dist) / 250) * 0.03
          if (isFinite(f)) {
            p.vx += (dx / dist) * f
            p.vy += (dy / dist) * f
          }
        }

        // Velocity clamp
        const speed = Math.hypot(p.vx, p.vy)
        if (speed > 1) {
          p.vx /= speed
          p.vy /= speed
        }

        // Render particle
        const pulse = Math.sin(time * 2 + p.pulsePhase) * 0.15 + 0.85
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.globalAlpha = p.opacity * pulse

        if (logo && logo.complete && logo.width > 0 && logo.height > 0) {
          const w = p.size
          const h = (p.size * logo.height) / logo.width
          if (isFinite(w) && isFinite(h) && w > 0 && h > 0) {
            ctx.drawImage(logo, -w / 2, -h / 2, w, h)
          }
        }

        ctx.restore()
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    /* ---------- Start after assets loaded and dimensions ready ---------- */

    let loaded = 0
    let dimensionsReady = false

    const checkAndStart = () => {
      if (loaded === 2 && dimensionsReady) {
        const { width, height } = dimensionsRef.current
        if (width > 0 && height > 0 && isFinite(width) && isFinite(height)) {
          animate()
        }
      }
    }

    const onLoad = () => {
      loaded++
      checkAndStart()
    }

    const onResizeReady = () => {
      dimensionsReady = true
      checkAndStart()
    }

    logoBlack.onload = onLoad
    logoWhite.onload = onLoad
    if (logoBlack.complete) loaded++
    if (logoWhite.complete) loaded++

    // Wait for initial resize to complete
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        onResizeReady()
      })
    })

    return () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf)
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('particle-canvas-reset', handleReset)
      observer.disconnect()
      cancelAnimationFrame(animationRef.current)
    }
  }, [initParticles])

  return (
    <>
      <canvas
        ref={canvasRef}
        className={className}
        style={{
          position: 'absolute',
          inset: 0,
          // Disable pointer events in the top center area when cord is visible
          pointerEvents: isCordHovered ? 'none' : 'auto',
        }}
      />
      {/* Pull cord easter egg - appears on hover at top center */}
      <PullCordAnimation isHovered={isCordHovered} />
    </>
  )
}
