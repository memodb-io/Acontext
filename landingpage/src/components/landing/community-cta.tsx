'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { MagneticButton } from '@/components/ui/magnetic-button'
import gsap from 'gsap'

export function CommunityCTA() {
  const sectionRef = useRef<HTMLElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleContainerRef = useRef<HTMLDivElement>(null)
  const descRef = useRef<HTMLParagraphElement>(null)
  const spotlightRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const container = containerRef.current
    const title = titleRef.current
    const titleContainer = titleContainerRef.current
    const desc = descRef.current
    const spotlight = spotlightRef.current

    if (!section || !container || !title || !titleContainer || !spotlight) return

    // Set initial 3D perspective for container and title
    gsap.set(container, { transformPerspective: 1000 })
    gsap.set(titleContainer, { transformPerspective: 1000 })

    // Set initial spotlight position (center of container)
    const initialX = container.offsetWidth / 2 - 250
    const initialY = container.offsetHeight / 2 - 250
    gsap.set(spotlight, {
      left: initialX,
      top: initialY,
      opacity: 0.6,
    })

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      // Calculate normalized position (-1 to 1)
      const normalizedX = (e.clientX - centerX) / (rect.width / 2)
      const normalizedY = (e.clientY - centerY) / (rect.height / 2)

      // 3D Tilt for entire container
      gsap.to(container, {
        rotateX: -normalizedY * 3,
        rotateY: normalizedX * 3,
        duration: 0.5,
        ease: 'power2.out',
      })

      // 3D Tilt for title (subtle additional rotation)
      gsap.to(titleContainer, {
        rotateX: -normalizedY * 2,
        rotateY: normalizedX * 2,
        duration: 0.5,
        ease: 'power2.out',
      })

      // Spotlight follows mouse
      gsap.to(spotlight, {
        left: e.clientX - rect.left - 250,
        top: e.clientY - rect.top - 250,
        opacity: 0.8,
        duration: 0.8,
        ease: 'power2.out',
      })

      // Parallax for description (follows, subtle)
      if (desc) {
        gsap.to(desc, {
          x: normalizedX * 6,
          y: normalizedY * 3,
          duration: 0.7,
          ease: 'power2.out',
        })
      }

      // Text shadow shift for depth effect
      const shadowX = normalizedX * 8
      const shadowY = normalizedY * 8
      gsap.to(title, {
        textShadow: `${shadowX}px ${shadowY}px 25px rgba(62, 207, 142, 0.12)`,
        duration: 0.5,
        ease: 'power2.out',
      })
    }

    const handleMouseLeave = () => {
      // Reset all transforms smoothly
      gsap.to(container, {
        rotateX: 0,
        rotateY: 0,
        duration: 0.8,
        ease: 'elastic.out(1, 0.5)',
      })

      gsap.to(titleContainer, {
        rotateX: 0,
        rotateY: 0,
        duration: 0.8,
        ease: 'elastic.out(1, 0.5)',
      })

      gsap.to(spotlight, {
        left: container.offsetWidth / 2 - 250,
        top: container.offsetHeight / 2 - 250,
        opacity: 0.6,
        duration: 0.8,
        ease: 'power2.out',
      })

      if (desc) {
        gsap.to(desc, {
          x: 0,
          y: 0,
          duration: 0.6,
          ease: 'elastic.out(1, 0.5)',
        })
      }

      gsap.to(title, {
        textShadow: '0px 0px 25px rgba(62, 207, 142, 0.12)',
        duration: 0.5,
        ease: 'power2.out',
      })
    }

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return (
    <section ref={sectionRef} className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] mx-auto">
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-3xl bg-linear-to-br from-primary/10 via-card to-accent/10 border border-border/50 p-12 sm:p-16 text-center will-change-transform"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Background decoration */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/20 rounded-full blur-3xl -z-10" />

          {/* Mouse-following spotlight */}
          <div
            ref={spotlightRef}
            className="absolute w-[500px] h-[500px] rounded-full pointer-events-none -z-5 opacity-60 transition-opacity"
            style={{
              background:
                'radial-gradient(circle, rgba(62, 207, 142, 0.15) 0%, rgba(62, 207, 142, 0.06) 30%, rgba(62, 207, 142, 0.02) 50%, transparent 75%)',
            }}
          />

          {/* Title with 3D tilt */}
          <div
            ref={titleContainerRef}
            className="will-change-transform"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <h2
              ref={titleRef}
              className="text-3xl sm:text-4xl font-bold mb-4 will-change-transform"
            >
              Join the Community
            </h2>
          </div>

          {/* Description with parallax */}
          <p
            ref={descRef}
            className="text-muted-foreground mb-8 max-w-lg mx-auto will-change-transform"
          >
            Connect with early builders & preview new features
          </p>

          {/* Buttons with magnetic effect */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <MagneticButton strength={0.1}>
              <Button size="lg" className="min-w-40" asChild>
                <a
                  href="https://discord.acontext.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Join Discord community (opens in new tab)"
                >
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  Join Discord
                </a>
              </Button>
            </MagneticButton>
            <MagneticButton strength={0.1}>
              <Button variant="outline" size="lg" className="min-w-40" asChild>
                <a
                  href="https://github.com/memodb-io/acontext"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Star on GitHub (opens in new tab)"
                >
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  Star on GitHub
                </a>
              </Button>
            </MagneticButton>
          </div>
        </div>
      </div>
    </section>
  )
}
