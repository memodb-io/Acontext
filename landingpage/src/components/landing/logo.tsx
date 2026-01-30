'use client'

import Image from 'next/image'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

interface LogoProps {
  variant?: 'nav' | 'icon'
  className?: string
  width?: number
  height?: number
}

export function Logo({ variant = 'nav', className = '', width, height }: LogoProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === 'dark' : false

  if (variant === 'icon') {
    return (
      <Image
        src={isDark ? '/ico_white.svg' : '/ico_black.svg'}
        alt="Acontext"
        width={width || 40}
        height={height || 40}
        className={className}
        priority
      />
    )
  }

  return (
    <Image
      src={isDark ? '/nav-logo-white.svg' : '/nav-logo-black.svg'}
      alt="Acontext"
      width={width || 32}
      height={height || 26}
      className={className}
    />
  )
}
