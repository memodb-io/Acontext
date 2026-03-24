'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowDown, Github, Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MagneticButton } from '@/components/ui/magnetic-button'
import { ParticleCanvas } from './particle-canvas'
import { CopyCommand } from './copy-command'
import RotatingText from '@/components/RotatingText'
import gsap from 'gsap'

const ROTATING_WORDS = ['Claude Code', 'OpenClaw']
const ROTATING_COPY_TEXT = [
  'Read https://acontext.io/SKILL.md and follow the instructions to install and configure Acontext for Claude Code',
  'Read https://acontext.io/SKILL.md and follow the instructions to install and configure Acontext for OpenClaw',
]
const ROTATING_COLORS: Record<string, string> = {
  'Claude Code': 'text-[#D97706]',
  'OpenClaw': 'text-primary',
}

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const taglineRef = useRef<HTMLDivElement>(null)
  const spotlightRef = useRef<HTMLDivElement>(null)
  const descRef = useRef<HTMLDivElement>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const section = sectionRef.current
    const title = titleRef.current
    const tagline = taglineRef.current
    const spotlight = spotlightRef.current
    const desc = descRef.current

    if (!section || !title || !tagline || !spotlight) return

    // Set initial 3D perspective
    gsap.set(tagline, { transformPerspective: 1000 })

    // Set initial spotlight position (center of section)
    const initialX = section.offsetWidth / 2 - 250
    const initialY = section.offsetHeight / 2 - 250
    gsap.set(spotlight, {
      left: initialX,
      top: initialY,
      opacity: 0.75,
    })

    const handleMouseMove = (e: MouseEvent) => {
      const rect = section.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      // Calculate normalized position (-1 to 1)
      const normalizedX = (e.clientX - centerX) / (rect.width / 2)
      const normalizedY = (e.clientY - centerY) / (rect.height / 2)

      // 3D Tilt for title (subtle rotation)
      gsap.to(tagline, {
        rotateX: -normalizedY * 5,
        rotateY: normalizedX * 5,
        duration: 0.5,
        ease: 'power2.out',
      })

      // Spotlight follows mouse
      gsap.to(spotlight, {
        left: e.clientX - rect.left - 250,
        top: e.clientY - rect.top - 250,
        opacity: 0.9,
        duration: 0.8,
        ease: 'power2.out',
      })

      // Parallax for description (follows, subtle)
      if (desc) {
        gsap.to(desc, {
          x: normalizedX * 8,
          y: normalizedY * 4,
          duration: 0.7,
          ease: 'power2.out',
        })
      }

      // Text shadow shift for depth effect
      const shadowX = normalizedX * 10
      const shadowY = normalizedY * 10
      gsap.to(title, {
        textShadow: `${shadowX}px ${shadowY}px 30px rgba(62, 207, 142, 0.15)`,
        duration: 0.5,
        ease: 'power2.out',
      })
    }

    const handleMouseLeave = () => {
      // Reset all transforms smoothly
      gsap.to(tagline, {
        rotateX: 0,
        rotateY: 0,
        duration: 0.8,
        ease: 'elastic.out(1, 0.5)',
      })

      gsap.to(spotlight, {
        left: section.offsetWidth / 2 - 250,
        top: section.offsetHeight / 2 - 250,
        opacity: 0.75,
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
        textShadow: '0px 0px 30px rgba(62, 207, 142, 0.15)',
        duration: 0.5,
        ease: 'power2.out',
      })
    }

    section.addEventListener('mousemove', handleMouseMove)
    section.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      section.removeEventListener('mousemove', handleMouseMove)
      section.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-24 overflow-hidden"
    >
      {/* Canvas particle animation background */}
      <div className="absolute inset-0 -z-10">
        <ParticleCanvas className="absolute inset-0 pointer-events-none" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      {/* Mouse-following spotlight */}
      <div
        ref={spotlightRef}
        className="absolute w-[500px] h-[500px] rounded-full pointer-events-none -z-5 opacity-85 transition-opacity"
        style={{
          background:
            'radial-gradient(circle, rgba(62, 207, 142, 0.18) 0%, rgba(62, 207, 142, 0.08) 30%, rgba(62, 207, 142, 0.03) 50%, transparent 75%)',
        }}
      />

      {/* Main content */}
      <div className="w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] mx-auto text-center space-y-8 md:pt-16 md:pb-24">
        {/* Tagline with 3D tilt */}
        <div
          ref={taglineRef}
          className="space-y-4 hero-tagline-container will-change-transform"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="flex justify-center hero-tagline">
            <span className="inline-flex items-center px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium bg-primary/10 text-primary border border-primary/20">
              Agent Skills as Memory Layer
            </span>
          </div>
          <h1
            ref={titleRef}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight sm:leading-[1.3] hero-title will-change-transform"
          >
            <span className="cursor-default">Skill Memory for</span>
            <br />
            <RotatingText
              texts={ROTATING_WORDS}
              rotationInterval={3000}
              onNext={setCurrentIndex}
              mainClassName={`justify-center cursor-default overflow-hidden transition-colors duration-500 ${ROTATING_COLORS[ROTATING_WORDS[currentIndex]]}`}
              staggerFrom="last"
              staggerDuration={0.025}
              splitBy="characters"
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '-120%', opacity: 0 }}
            />
          </h1>
          <div className="mt-6 flex justify-center">
            <CopyCommand
              command={ROTATING_COPY_TEXT[currentIndex]}
              copyText={ROTATING_COPY_TEXT[currentIndex]}
              className="max-w-xl"
              label="Copy and Paste Into Your Agent's Chat to Get Started"
            >
              Read{' '}
              <a
                href="https://acontext.io/SKILL.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                SKILL.md
              </a>
              {' '}to set up Acontext for {ROTATING_WORDS[currentIndex]}
            </CopyCommand>
          </div>
        </div>

        {/* Description with parallax */}
        <div
          ref={descRef}
          className="max-w-3xl mx-auto space-y-3 sm:space-y-4 animate-fade-in animation-delay-600 px-2 sm:px-0 will-change-transform"
        >
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed">
            With Acontext, your agents can improve themselves via dynamic skill.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-2 sm:gap-x-3 gap-y-2 text-xs sm:text-sm md:text-base text-muted-foreground/80">
            <span className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-md bg-muted/50 border border-border/50">
              Session Backup
            </span>
            <span className="text-muted-foreground/40 hidden sm:inline">·</span>
            <span className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-md bg-muted/50 border border-border/50">
              Improve Your Agents over Time
            </span>
            <span className="text-muted-foreground/40 hidden sm:inline">·</span>
            <span className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-md bg-muted/50 border border-border/50">
              Sync Skills to Local
            </span>
          </div>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground/70 leading-relaxed max-w-2xl mx-auto">
            Captures what works, distills it into skills, and sync them to local.
          </p>
        </div>

        {/* CTA Buttons with magnetic effect */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in animation-delay-800">
          <MagneticButton strength={0.1}>
            <Button size="lg" className="min-w-48 h-12 text-base font-semibold" asChild>
              <a
                href="https://dash.acontext.io"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Go to Cloud Platform dashboard (opens in new tab)"
              >
                <Rocket className="h-5 w-5 mr-2" />
                Cloud Platform
              </a>
            </Button>
          </MagneticButton>
          <MagneticButton strength={0.1}>
            <Button variant="outline" size="lg" className="min-w-48 h-12 text-base" asChild>
              <a
                href="https://github.com/memodb-io/acontext"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View on GitHub (opens in new tab)"
              >
                <Github className="h-5 w-5 mr-2" />
                Open source
              </a>
            </Button>
          </MagneticButton>
        </div>

      </div>

      {/* Scroll indicator - bottom only */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground/50 animate-bounce-slow">
        <ArrowDown className="h-5 w-5" />
      </div>
    </section>
  )
}
