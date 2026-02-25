'use client'

import { useRef, useEffect, useState, ReactNode, useMemo } from 'react'
import { useTheme } from 'next-themes'
import gsap from 'gsap'

export type CursorStyle = 'glow' | 'dot' | 'terminal' | 'crosshair' | 'custom'

export interface CustomCursorProps {
  /**
   * Container element ref - cursor will be displayed within this container
   */
  containerRef: React.RefObject<HTMLElement>
  /**
   * Cursor style type
   */
  style?: CursorStyle
  /**
   * Custom color (primary color)
   */
  color?: string
  /**
   * Custom color RGB value (for shadows)
   */
  colorRgb?: string
  /**
   * Whether to enable the cursor
   */
  enabled?: boolean
  /**
   * Follow delay in seconds
   */
  followDelay?: number
  /**
   * Custom cursor content (DOM elements)
   * When provided, this will override the style prop and render your custom content
   */
  children?: ReactNode
  /**
   * Cursor size in pixels (only applies when using built-in styles, not custom children)
   */
  size?: number
  /**
   * Whether to hide cursor when mouse leaves the container
   */
  hideOnLeave?: boolean
}

function CustomCursor({
  containerRef,
  style = 'glow',
  color = '#00FF41',
  colorRgb = '0, 255, 65',
  enabled = true,
  followDelay = 0.3,
  children,
  size = 20,
  hideOnLeave = true,
}: CustomCursorProps) {
  const cursorRef = useRef<HTMLDivElement>(null)
  const [_isVisible, setIsVisible] = useState(false)
  const [_mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!enabled || !containerRef.current || !cursorRef.current) return

    const container = containerRef.current
    const cursor = cursorRef.current

    // Show cursor with fade-in and scale animation when mouse enters
    const handleMouseEnter = () => {
      setIsVisible(true)
      gsap.to(cursor, {
        opacity: 1,
        scale: 1,
        duration: 0.2,
      })
    }

    // Hide cursor with fade-out and scale animation when mouse leaves
    const handleMouseLeave = () => {
      if (hideOnLeave) {
        setIsVisible(false)
        gsap.to(cursor, {
          opacity: 0,
          scale: 0,
          duration: 0.2,
        })
      }
    }

    // Track mouse position and smoothly follow with GSAP animation
    const handleMouseMove = (e: MouseEvent) => {
      if (!container || !cursor) return

      // Calculate mouse position relative to container
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      setMousePos({ x, y })

      // Smooth cursor follow with GSAP
      // Use xPercent and yPercent to maintain -50% offset for centering the cursor
      gsap.set(cursor, {
        left: x,
        top: y,
        xPercent: -50,
        yPercent: -50,
      })

      // Animate to new position with configurable delay
      gsap.to(cursor, {
        left: x,
        top: y,
        duration: followDelay,
        ease: 'power2.out',
      })
    }

    // Attach event listeners
    container.addEventListener('mouseenter', handleMouseEnter)
    container.addEventListener('mouseleave', handleMouseLeave)
    container.addEventListener('mousemove', handleMouseMove)

    // Hide default system cursor on container
    const originalCursor = container.style.cursor
    container.style.cursor = 'none'

    // Cleanup: remove event listeners and restore original cursor
    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter)
      container.removeEventListener('mouseleave', handleMouseLeave)
      container.removeEventListener('mousemove', handleMouseMove)
      container.style.cursor = originalCursor
    }
  }, [enabled, followDelay, hideOnLeave, containerRef])

  if (!enabled) return null

  // When children are provided, use custom content; otherwise use built-in styles
  const hasCustomContent = Boolean(children)

  /**
   * Render cursor content based on style or custom children
   * If children are provided, they take precedence over the style prop
   */
  const renderCursor = () => {
    // Render custom children if provided
    if (hasCustomContent) {
      return children
    }

    // Render built-in style based on style prop
    switch (style) {
      case 'glow':
        return (
          <>
            <div
              className="absolute inset-0 rounded-full"
              style={{
                backgroundColor: color,
                boxShadow: `0 0 15px rgba(${colorRgb}, 0.8), 0 0 30px rgba(${colorRgb}, 0.4)`,
                transform: 'scale(0.3)',
              }}
            />
            <div
              className="absolute inset-0 rounded-full animate-pulse"
              style={{
                backgroundColor: color,
                opacity: 0.5,
                transform: 'scale(1.5)',
              }}
            />
          </>
        )

      case 'dot':
        return (
          <div
            className="absolute inset-0 rounded-full"
            style={{
              backgroundColor: color,
              boxShadow: `0 0 10px rgba(${colorRgb}, 0.6)`,
            }}
          />
        )

      case 'terminal':
        return (
          <div
            className="absolute"
            style={{
              width: '2px',
              height: '16px',
              backgroundColor: color,
              boxShadow: `0 0 8px rgba(${colorRgb}, 0.8)`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        )

      case 'crosshair':
        return (
          <>
            <div
              className="absolute"
              style={{
                width: '20px',
                height: '2px',
                backgroundColor: color,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                boxShadow: `0 0 8px rgba(${colorRgb}, 0.8)`,
              }}
            />
            <div
              className="absolute"
              style={{
                width: '2px',
                height: '20px',
                backgroundColor: color,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                boxShadow: `0 0 8px rgba(${colorRgb}, 0.8)`,
              }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                width: '6px',
                height: '6px',
                backgroundColor: color,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                boxShadow: `0 0 10px rgba(${colorRgb}, 0.8)`,
              }}
            />
          </>
        )

      default:
        return null
    }
  }

  return (
    <div
      ref={cursorRef}
      className="pointer-events-none absolute z-100"
      style={{
        // When using custom children, let the container size adapt to content
        // Otherwise, use the specified size
        ...(hasCustomContent
          ? {
              width: 'auto',
              height: 'auto',
            }
          : {
              width: `${size}px`,
              height: `${size}px`,
            }),
        opacity: 0,
        left: 0,
        top: 0,
        transform: 'scale(0)',
      }}
    >
      {renderCursor()}
    </div>
  )
}

export interface WithCustomCursorProps {
  /**
   * Content to wrap with custom cursor
   */
  children: ReactNode
  /**
   * Custom cursor style type
   */
  cursorStyle?: CustomCursorProps['style']
  /**
   * Custom cursor color
   */
  cursorColor?: string
  /**
   * Custom cursor color RGB value (for shadows)
   */
  cursorColorRgb?: string
  /**
   * Whether to enable the cursor
   */
  cursorEnabled?: boolean
  /**
   * Cursor follow delay in seconds
   */
  cursorFollowDelay?: number
  /**
   * Custom cursor content (DOM elements)
   * When provided, this will override the cursorStyle prop
   */
  cursorChildren?: ReactNode
  /**
   * Cursor size in pixels (only applies when using built-in styles)
   */
  cursorSize?: number
  /**
   * Whether to hide cursor when mouse leaves
   */
  cursorHideOnLeave?: boolean
  /**
   * Additional className for the wrapper
   */
  className?: string
  /**
   * ID for the wrapper element
   */
  id?: string
}

/**
 * Wrapper component that adds custom cursor to any content
 *
 * @example
 * ```tsx
 * <WithCustomCursor
 *   cursorStyle="glow"
 *   cursorColor="#00FF41"
 *   cursorColorRgb="0, 255, 65"
 * >
 *   <TutorialVideo />
 * </WithCustomCursor>
 * ```
 */
export function WithCustomCursor({
  children,
  cursorStyle = 'glow',
  cursorColor,
  cursorColorRgb,
  cursorEnabled = true,
  cursorFollowDelay = 0.3,
  cursorChildren,
  cursorSize = 20,
  cursorHideOnLeave = true,
  className,
  id,
}: WithCustomCursorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Ensure we only render after mount to prevent hydration mismatch
  // Also detect mobile/touch devices to disable custom cursor
  useEffect(() => {
    setMounted(true)

    const checkMobile = () => {
      const mobile = window.innerWidth < 768 // md breakpoint
      setIsMobile(mobile)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => {
      window.removeEventListener('resize', checkMobile)
    }
  }, [])

  // Auto-detect theme colors if not provided
  // Use light theme as default during SSR to match server render
  const finalColor = useMemo(() => {
    if (cursorColor) return cursorColor
    // During SSR or before mount, default to light theme color
    if (!mounted) return '#059669'
    // After mount, use resolved theme
    return resolvedTheme === 'dark' ? '#00FF41' : '#059669'
  }, [cursorColor, resolvedTheme, mounted])

  const finalColorRgb = useMemo(() => {
    if (cursorColorRgb) return cursorColorRgb
    // During SSR or before mount, default to light theme RGB
    if (!mounted) return '5, 150, 105'
    // After mount, use resolved theme
    return resolvedTheme === 'dark' ? '0, 255, 65' : '5, 150, 105'
  }, [cursorColorRgb, resolvedTheme, mounted])

  return (
    <div ref={containerRef} id={id} className={className} style={{ position: 'relative' }}>
      {children}
      <CustomCursor
        containerRef={containerRef}
        style={cursorStyle}
        color={finalColor}
        colorRgb={finalColorRgb}
        enabled={cursorEnabled && !isMobile}
        followDelay={cursorFollowDelay}
        size={cursorSize}
        hideOnLeave={cursorHideOnLeave}
      >
        {cursorChildren}
      </CustomCursor>
    </div>
  )
}
