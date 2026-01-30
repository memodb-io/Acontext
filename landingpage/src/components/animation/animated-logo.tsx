'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

interface AnimatedLogoProps {
  className?: string
  width?: number
  height?: number
  /**
   * External control for collapsed state. If provided, overrides scroll-based behavior.
   * When true, the logo shows only the "A" character.
   * When false, the logo shows the full "Acontext" text.
   */
  collapsed?: boolean
  /**
   * If true, disables scroll-based auto-collapse behavior.
   * Use this when you want full control via the `collapsed` prop.
   */
  disableAutoCollapse?: boolean
}

export function AnimatedLogo({
  className,
  width = 120,
  height = 24,
  collapsed: externalCollapsed,
  disableAutoCollapse = false,
}: AnimatedLogoProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    setMounted(true)

    if (!disableAutoCollapse) {
      const handleScroll = () => {
        const scrollY = window.scrollY
        setIsScrolled(scrollY > 50) // Collapse when scrolled more than 50px
      }

      // Initial check
      handleScroll()

      window.addEventListener('scroll', handleScroll, { passive: true })
      return () => window.removeEventListener('scroll', handleScroll)
    }
  }, [disableAutoCollapse])

  // Use external control if provided, otherwise use scroll-based state
  const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : isScrolled

  const isDark = mounted ? resolvedTheme === 'dark' : true
  const fillColor = isDark ? 'white' : 'black'

  // A character width (right boundary approximately at 140px based on SVG path analysis)
  const aWidth = 140
  const fullWidth = 854
  const clipRatio = aWidth / fullWidth

  // Container width: use user-specified width when expanded, scale down when collapsed
  const containerWidth = isCollapsed ? width * clipRatio : width

  // Starting x positions of each character (from left to right)
  const charPositions = [
    186.654, // O (first letter of context)
    237.733, // C
    354.301, // O (second letter of context)
    456.977, // N
    557.363, // T
    641, // E (X path)
    712.7, // X
    760.883, // T (last)
  ]

  // Calculate the distance each character needs to move (to move behind A)
  // When collapsing: each character moves right, disappearing behind A's right boundary (140px)
  // When expanding: each character appears from left to right
  const getCharTransform = (charIndex: number) => {
    const charPosition = charPositions[charIndex]

    // All characters move right, out of view, creating the "collapse behind A" effect
    // Move distance = character's current position to A's right boundary + extra distance to ensure complete disappearance
    const moveDistance = charPosition - aWidth + 200 // Move right far enough

    const translateX = isCollapsed ? `${moveDistance}px` : '0px'

    // Delay logic:
    // When collapsing: disappear from right to left (rightmost character disappears first)
    // When expanding: appear from left to right (leftmost character appears first)
    let delay: number
    if (isCollapsed) {
      // Collapse: right to left (larger index disappears first)
      const reversedIndex = charPositions.length - 1 - charIndex
      delay = reversedIndex * 0.05
    } else {
      // Expand: left to right (smaller index appears first)
      delay = charIndex * 0.05
    }

    return {
      transform: `translateX(${translateX})`,
      transition: `transform 0.4s cubic-bezier(0.4, 0, 0.2, 1) ${delay}s, opacity 0.3s ${delay}s`,
      opacity: isCollapsed ? 0 : 1,
    }
  }

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{
        width: `${containerWidth}px`,
        height: `${height}px`,
        transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <svg
        width={fullWidth}
        height={116}
        viewBox="0 0 854 116"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          height: `${height}px`,
          width: `${width}px`,
        }}
      >
        {/* A character - leftmost, doesn't move */}
        <g>
          <path
            d="M139.566 114.125H120.575L74.2891 22.0001H64.0303L18.9922 114.125H0L54.7285 2.18073H83.3232L139.566 114.125Z"
            fill={fillColor}
          />
          <path
            d="M96.3888 80.6869L113.203 114.125H101.572L89.8758 90.8637H49.1717L37.7995 114.125H26.1689L42.5166 80.6869H96.3888ZM75.0671 37.8958L59.1219 70.5102H47.4921L69.1702 26.1687L75.0671 37.8958Z"
            fill={fillColor}
          />
        </g>

        {/* context characters - each character grouped */}
        {/* O (first letter of context) */}
        <g style={getCharTransform(0)}>
          <path
            d="M186.654 91.8959C191.742 91.8959 196.118 90.5221 199.782 87.7744C203.446 85.0266 206.397 81.1086 208.636 76.0202L230.465 88.8429C228.837 93.7278 226.038 98.2055 222.069 102.276C218.202 106.347 213.266 109.654 207.262 112.199C201.258 114.641 194.592 115.862 187.265 115.862C177.19 115.862 167.98 113.471 159.635 108.688C151.29 103.904 144.675 97.137 139.79 88.385C134.905 79.5312 132.463 69.3545 132.463 57.8548C132.463 46.355 134.905 36.2292 139.79 27.4772C144.675 18.6234 151.29 11.8559 159.635 7.1746C167.98 2.39153 177.19 0 187.265 0C194.592 0 201.258 1.27209 207.262 3.81628C213.266 6.2587 218.202 9.51525 222.069 13.586C226.038 17.6566 228.837 22.1344 230.465 27.0192L208.636 39.8419C206.397 34.7536 203.446 30.8355 199.782 28.0878C196.118 25.3401 191.742 23.9662 186.654 23.9662C181.769 23.9662 177.241 25.3401 173.068 28.0878C168.997 30.7338 165.792 34.6518 163.451 39.8419C161.11 44.9303 159.94 50.9346 159.94 57.8548C159.94 64.7749 161.11 70.8301 163.451 76.0202C165.792 81.2104 168.997 85.1793 173.068 87.927C177.241 90.573 181.769 91.8959 186.654 91.8959Z"
            fill={fillColor}
          />
        </g>

        {/* C */}
        <g style={getCharTransform(1)}>
          <path
            d="M237.733 57.8548C237.733 46.0497 240.125 35.7712 244.908 27.0192C249.793 18.2673 256.408 11.6015 264.753 7.02195C273.098 2.34065 282.307 0 292.382 0C302.457 0 311.617 2.34065 319.86 7.02195C328.205 11.6015 334.819 18.2673 339.704 27.0192C344.589 35.7712 347.032 46.0497 347.032 57.8548C347.032 69.7615 344.589 80.0909 339.704 88.8429C334.819 97.5949 328.205 104.312 319.86 108.993C311.617 113.572 302.457 115.862 292.382 115.862C282.307 115.862 273.098 113.572 264.753 108.993C256.408 104.413 249.793 97.7476 244.908 88.9956C240.125 80.1418 237.733 69.7615 237.733 57.8548ZM265.363 57.8548C265.363 64.6732 266.483 70.6774 268.722 75.8676C270.96 81.0577 274.166 85.0775 278.339 87.927C282.511 90.6747 287.192 92.0486 292.382 92.0486C297.674 92.0486 302.356 90.6747 306.426 87.927C310.599 85.0775 313.804 81.0577 316.043 75.8676C318.384 70.6774 319.554 64.6732 319.554 57.8548C319.554 51.1381 318.384 45.2356 316.043 40.1472C313.804 34.9571 310.599 30.9882 306.426 28.2404C302.356 25.391 297.674 23.9662 292.382 23.9662C287.192 23.9662 282.511 25.3401 278.339 28.0878C274.166 30.8355 270.96 34.8044 268.722 39.9946C266.483 45.0829 265.363 51.0363 265.363 57.8548Z"
            fill={fillColor}
          />
        </g>

        {/* O (second letter of context) */}
        <g style={getCharTransform(2)}>
          <path
            d="M354.301 2.18073H375.214L425.894 69.9578V2.18073H449.708V113.921H428.794L378.114 45.9916V113.921H354.301V2.18073Z"
            fill={fillColor}
          />
        </g>

        {/* N */}
        <g style={getCharTransform(3)}>
          <path
            d="M456.977 2.18073H490.56V25.231H516.51V113.921H490.56V25.231H456.977V2.18073H550.094V25.231H516.51V113.921H490.56V25.231H456.977V2.18073Z"
            fill={fillColor}
          />
        </g>

        {/* T */}
        <g style={getCharTransform(4)}>
          <path
            d="M557.363 2.18073H632.162V24.6204H583.467V46.6022H627.125V68.8892H583.467V91.3289H633.994V113.921H557.363V2.18073Z"
            fill={fillColor}
          />
        </g>

        {/* E (X path, but actually E) */}
        <g style={getCharTransform(5)}>
          <path
            d="M641 2H671.092L696.579 38.4153L721.605 2H754L712.7 56.317L752.004 114H721.758L698.268 80.3388L675.084 114H642.996L682.3 56.929L641 2Z"
            fill={fillColor}
          />
        </g>

        {/* X */}
        <g style={getCharTransform(6)}>
          <path
            d="M712.7 56.317L754 114H721.605L696.579 77.5847L671.092 114H641L682.3 56.929L642.996 2H675.084L698.268 35.6612L721.758 2H752.004L712.7 56.317Z"
            fill={fillColor}
          />
        </g>

        {/* T (last) */}
        <g style={getCharTransform(7)}>
          <path
            d="M760.883 2.18073H794.466V25.231H820.417V113.921H794.466V25.231H760.883V2.18073H854V25.231H820.417V113.921H794.466V25.231H760.883V2.18073Z"
            fill={fillColor}
          />
        </g>
      </svg>
    </div>
  )
}

