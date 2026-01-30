'use client'

import React, { useRef, useEffect, useLayoutEffect, useState } from 'react'

// Base grid spacing constant
const BASE_GRID_SPACING = 40
// Base SVG size for scaling calculations - match product/hero.tsx
// Product uses: outerRadius * 2 + 100 = 480 * 2 + 100 = 1060
const BASE_SVG_SIZE = 1060
// Base radius for scale calculation - match product/hero.tsx
const BASE_OUTER_RADIUS = 480

// Function to calculate connections between nearby points
function calculateConnections(
  points: Array<{
    x: number
    y: number
    phase: number
    speed: number
    distanceToCenter: number
    baseOpacity: number
  }>,
  gridSpacing: number,
  currentTime: number = 0,
): Array<{
  from: number
  to: number
  phase: number
  averageDistance: number
  nextChangeTime: number
  fadeProgress: number
  targetFrom?: number
  targetTo?: number
}> {
  const connections: Array<{
    from: number
    to: number
    phase: number
    averageDistance: number
    nextChangeTime: number
    fadeProgress: number
    targetFrom?: number
    targetTo?: number
  }> = []
  const maxDistance = gridSpacing * 1.8

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i].x - points[j].x
      const dy = points[i].y - points[j].y
      const dist = Math.hypot(dx, dy)

      // 15% chance to connect nearby points (matching matrix-canvas.tsx)
      if (dist < maxDistance && Math.random() < 0.15) {
        // Calculate average distance from center for edge fading
        const averageDistance = (points[i].distanceToCenter + points[j].distanceToCenter) / 2
        // 随机分配下次变化时间：3-7秒之间
        const nextChangeTime = currentTime + (Math.random() * 4000 + 3000)
        connections.push({
          from: i,
          to: j,
          phase: Math.random() * Math.PI * 2,
          averageDistance,
          nextChangeTime,
          fadeProgress: 1, // 初始完全显示
        })
      }
    }
  }

  return connections
}

// Static grid background component using SVG
function StaticGridBackground({ scale }: { scale: number }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [strokeColor, setStrokeColor] = React.useState('rgba(62, 207, 142, 0.3)')
  const [pointColorRgb, setPointColorRgb] = React.useState('rgb(62, 207, 142)') // Use RGB without alpha - opacity controlled by style.opacity
  const strokeRgbRef = useRef('62, 207, 142') // Store RGB for animation loop
  const animationRef = useRef<number | null>(null)
  const timeRef = useRef(0)
  const connectionUpdateRef = useRef<Map<number, number>>(new Map()) // 存储每条连线的变化开始时间
  const connectionsDataRef = useRef<Array<{
    from: number
    to: number
    phase: number
    averageDistance: number
    nextChangeTime: number
    fadeProgress: number
    targetFrom?: number
    targetTo?: number
  }> | null>(null) // 使用 ref 存储连接数据，避免频繁状态更新
  const pendingStateUpdateRef = useRef(false) // 标志是否有待处理的状态更新
  const [gridData, setGridData] = React.useState<{
    points: Array<{
      x: number
      y: number
      phase: number
      speed: number
      distanceToCenter: number
      baseOpacity: number
    }>
    connections: Array<{
      from: number
      to: number
      phase: number
      averageDistance: number
      nextChangeTime: number // 下次变化的时间（毫秒）
      fadeProgress: number // 淡入淡出进度 0-1，0=完全淡出，1=完全显示
      targetFrom?: number // 目标起点（变化中）
      targetTo?: number // 目标终点（变化中）
    }>
    svgSize: number
    maxDistance: number
    edgeMargin: number
  } | null>(null)

  useEffect(() => {
    // Get computed primary color from CSS variable and convert to rgba with opacity
    const updateColor = () => {
      if (svgRef.current) {
        // Check if dark mode is active
        const isDark = document.documentElement.classList.contains('dark')

        // Get RGB values from CSS variable --primary-rgb
        const rootStyle = getComputedStyle(document.documentElement)
        const primaryRgb = rootStyle.getPropertyValue('--primary-rgb').trim()

        if (primaryRgb) {
          // --primary-rgb is in format "r, g, b"
          const [r, g, b] = primaryRgb.split(',').map((v) => v.trim())

          // Lower opacity for subtle background effect - match matrix-canvas.tsx
          const strokeOpacity = isDark ? 0.35 : 0.3
          strokeRgbRef.current = `${r}, ${g}, ${b}` // Store RGB for animation loop
          setStrokeColor(`rgba(${r}, ${g}, ${b}, ${strokeOpacity})`)
          setPointColorRgb(`rgb(${r}, ${g}, ${b})`) // Use RGB only - opacity controlled by style.opacity
        } else {
          // Fallback: try to get computed color from a temporary element
          const tempEl = document.createElement('div')
          tempEl.style.color = 'var(--primary)'
          document.body.appendChild(tempEl)
          const computedColor = getComputedStyle(tempEl).color
          document.body.removeChild(tempEl)

          // Extract RGB values and add opacity
          const rgbMatch = computedColor.match(/\d+/g)
          if (rgbMatch && rgbMatch.length >= 3) {
            const r = rgbMatch[0]
            const g = rgbMatch[1]
            const b = rgbMatch[2]
            const strokeOpacity = isDark ? 0.35 : 0.3
            strokeRgbRef.current = `${r}, ${g}, ${b}` // Store RGB for animation loop
            setStrokeColor(`rgba(${r}, ${g}, ${b}, ${strokeOpacity})`)
            setPointColorRgb(`rgb(${r}, ${g}, ${b})`) // Use RGB only - opacity controlled by style.opacity
          }
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

  // Calculate grid data based on scale (memoized)
  useEffect(() => {
    // Grid spacing should remain constant, not scale with viewport
    const gridSpacing = BASE_GRID_SPACING
    const svgSize = Math.max(BASE_SVG_SIZE * scale, 800)
    const center = svgSize / 2

    // Calculate grid points - centered layout
    const cols = Math.ceil(svgSize / gridSpacing)
    const rows = Math.ceil(svgSize / gridSpacing)
    const points: Array<{
      x: number
      y: number
      phase: number
      speed: number
      distanceToCenter: number
      baseOpacity: number
    }> = []

    // Start from center and expand outward
    // Use (cols - 1) / 2 to properly center both even and odd grid sizes
    const startX = center - ((cols - 1) / 2) * gridSpacing
    const startY = center - ((rows - 1) / 2) * gridSpacing

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * gridSpacing
        const y = startY + row * gridSpacing
        // Only add points within SVG bounds
        if (x >= 0 && x <= svgSize && y >= 0 && y <= svgSize) {
          const dx = x - center
          const dy = y - center
          const distanceToCenter = Math.hypot(dx, dy)
          points.push({
            x,
            y,
            phase: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.02 + 0.01,
            distanceToCenter,
            baseOpacity: Math.random() * 0.2 + 0.15, // Match matrix-canvas: 0.15-0.35
          })
        }
      }
    }

    // Calculate connections between nearby points - similar to matrix-canvas.tsx
    // Simple 15% probability connection algorithm
    const connections = calculateConnections(points, gridSpacing, 0)

    // Find the maximum distance for normalization
    const maxDistanceToCenter = Math.max(...points.map((p) => p.distanceToCenter))

    // Edge margin for fading (similar to matrix-canvas.tsx)
    const edgeMargin = 100

    setGridData({ points, connections, svgSize, maxDistance: maxDistanceToCenter, edgeMargin })
  }, [scale])

  // Function to find a new connection point for a given point
  const findNewConnection = (
    pointIndex: number,
    points: Array<{
      x: number
      y: number
      phase: number
      speed: number
      distanceToCenter: number
      baseOpacity: number
    }>,
    existingConnections: Array<{ from: number; to: number }>,
    gridSpacing: number,
  ): number | null => {
    const maxDistance = gridSpacing * 1.8
    const currentPoint = points[pointIndex]
    const candidates: number[] = []

    // Find all nearby points that could be connected
    for (let i = 0; i < points.length; i++) {
      if (i === pointIndex) continue
      const dx = currentPoint.x - points[i].x
      const dy = currentPoint.y - points[i].y
      const dist = Math.hypot(dx, dy)
      if (dist < maxDistance) {
        // Check if this connection already exists
        const exists = existingConnections.some(
          (conn) =>
            (conn.from === pointIndex && conn.to === i) ||
            (conn.from === i && conn.to === pointIndex),
        )
        if (!exists) {
          candidates.push(i)
        }
      }
    }

    if (candidates.length === 0) return null
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  // Animation loop for pulsing effect
  useEffect(() => {
    if (!gridData) return

    // 初始化 connectionsDataRef（只在首次或 gridData 结构变化时）
    const shouldInit =
      !connectionsDataRef.current ||
      connectionsDataRef.current.length !== gridData.connections.length ||
      connectionsDataRef.current.some((conn, idx) => {
        const newConn = gridData.connections[idx]
        return !newConn || conn.from !== newConn.from || conn.to !== newConn.to
      })

    if (shouldInit) {
      connectionsDataRef.current = gridData.connections.map((conn) => ({ ...conn }))
      connectionUpdateRef.current.clear() // 清除所有进行中的变化
      pendingStateUpdateRef.current = false // 重置状态更新标志
    }

    const fadeDuration = 1500 // 淡入淡出持续时间（毫秒）- 增加时间使效果更明显
    const gridDataRef = { current: gridData } // 使用 ref 存储 gridData，避免闭包问题

    const animate = () => {
      timeRef.current += 0.016 // ~60fps
      const currentTime = timeRef.current * 1000 // Convert to milliseconds

      if (!connectionsDataRef.current || !gridDataRef.current) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      let needsStateUpdate = false
      const gridPoints = gridDataRef.current.points

      // Update connections - check each connection individually for random changes
      const newConnections = connectionsDataRef.current.map((conn, index) => {
        const changeStartTime = connectionUpdateRef.current.get(index)

        // 如果正在变化中
        if (changeStartTime !== undefined) {
          const elapsed = currentTime - changeStartTime
          const progress = Math.min(1, elapsed / fadeDuration) // 0 到 1

          // 淡出阶段占 60%，淡入阶段占 40%，让淡出更明显
          const fadeOutRatio = 0.6
          const fadeInRatio = 0.4

          // 前半段：淡出 (progress 0->fadeOutRatio, fadeProgress 1->0)
          if (progress < fadeOutRatio) {
            // 使用平滑的缓动函数使淡出更明显 (ease-in-out cubic)
            const t = progress / fadeOutRatio // 0 到 1
            // ease-in-out cubic: 更平滑的过渡
            const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
            const fadeProgress = 1 - eased // 从 1 淡出到 0
            return { ...conn, fadeProgress }
          }

          // 中间：切换到新点 (progress = fadeOutRatio)
          if (progress >= fadeOutRatio && conn.targetTo === undefined) {
            // Include both current 'to' and 'targetTo' (if exists) when checking existing connections
            const existingConnections = connectionsDataRef.current.map((c) => ({
              from: c.from,
              to: c.targetTo !== undefined ? c.targetTo : c.to,
            }))
            const newTo = findNewConnection(
              conn.from,
              gridPoints,
              existingConnections,
              BASE_GRID_SPACING,
            )
            if (newTo !== null) {
              needsStateUpdate = true // 需要更新状态以触发重新渲染（因为连接点改变了）
              return {
                ...conn,
                targetTo: newTo,
                fadeProgress: 0, // 开始淡入
              }
            }
          }

          // 后半段：淡入 (progress fadeOutRatio->1, fadeProgress 0->1)
          if (progress >= fadeOutRatio) {
            // 使用平滑的缓动函数使淡入更明显 (ease-in-out cubic)
            const t = (progress - fadeOutRatio) / fadeInRatio // 0 到 1
            // ease-in-out cubic: 更平滑的过渡
            const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
            const fadeProgress = eased // 从 0 淡入到 1

            // 如果淡入完成
            if (progress >= 1) {
              connectionUpdateRef.current.delete(index)
              needsStateUpdate = true // 需要更新状态（因为连接完成了）
              return {
                ...conn,
                fadeProgress: 1,
                to: conn.targetTo !== undefined ? conn.targetTo : conn.to, // 更新实际连接点
                targetTo: undefined,
                nextChangeTime: currentTime + (Math.random() * 4000 + 3000), // 随机下次变化时间
              }
            }

            return { ...conn, fadeProgress }
          }

          return conn
        }

        // 检查是否到了变化时间
        if (currentTime >= conn.nextChangeTime) {
          needsStateUpdate = true // 需要更新状态（因为开始变化了）
          connectionUpdateRef.current.set(index, currentTime)
          return {
            ...conn,
            fadeProgress: 1, // 开始淡出
          }
        }

        return conn
      })

      // 更新 ref
      connectionsDataRef.current = newConnections

      // 只在真正需要重新渲染 SVG 结构时才更新状态（比如连接点改变）
      if (needsStateUpdate && !pendingStateUpdateRef.current) {
        pendingStateUpdateRef.current = true

        // 使用 requestAnimationFrame 来延迟更新，避免阻塞动画
        requestAnimationFrame(() => {
          setGridData((prev) => {
            if (!prev || !connectionsDataRef.current) {
              pendingStateUpdateRef.current = false
              return prev
            }
            // 检查是否真的需要更新（避免不必要的更新）
            const hasChanged = prev.connections.some((oldConn, idx) => {
              const newConn = connectionsDataRef.current?.[idx]
              return !newConn || oldConn.to !== newConn.to || oldConn.targetTo !== newConn.targetTo
            })
            pendingStateUpdateRef.current = false
            if (!hasChanged) return prev
            return { ...prev, connections: connectionsDataRef.current }
          })
        })
      }

      // Update SVG elements with animation
      const svg = svgRef.current
      if (!svg) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      // Animate connections opacity and position
      const connections = svg.querySelectorAll('.grid-connection')
      const rgb = strokeRgbRef.current

      connections.forEach((conn, index) => {
        const element = conn as SVGLineElement
        if (
          connectionsDataRef.current &&
          gridDataRef.current &&
          index < connectionsDataRef.current.length
        ) {
          const connData = connectionsDataRef.current[index]

          const fromPoint = gridPoints[connData.from]
          const oldToPoint = gridPoints[connData.to]
          const newToPoint = connData.targetTo !== undefined ? gridPoints[connData.targetTo] : null

          if (!fromPoint || !oldToPoint) return

          // 如果正在变化中，使用位置插值
          let toX = oldToPoint.x
          let toY = oldToPoint.y
          if (newToPoint && connData.targetTo !== undefined) {
            const changeStartTime = connectionUpdateRef.current.get(index)
            if (changeStartTime !== undefined) {
              const elapsed = currentTime - changeStartTime
              const progress = Math.min(1, elapsed / fadeDuration)
              // 在淡出阶段保持旧位置，在淡入阶段插值到新位置
              if (progress >= 0.5) {
                const t = (progress - 0.5) * 2 // 0 到 1
                toX = oldToPoint.x + (newToPoint.x - oldToPoint.x) * t
                toY = oldToPoint.y + (newToPoint.y - oldToPoint.y) * t
              }
            }
          }

          // Calculate distance to edges for both points (similar to matrix-canvas.tsx)
          const fromDistToLeft = fromPoint.x
          const fromDistToRight = gridDataRef.current.svgSize - fromPoint.x
          const fromDistToTop = fromPoint.y
          const fromDistToBottom = gridDataRef.current.svgSize - fromPoint.y
          const fromMinDist = Math.min(
            fromDistToLeft,
            fromDistToRight,
            fromDistToTop,
            fromDistToBottom,
          )

          const toDistToLeft = toX
          const toDistToRight = gridDataRef.current.svgSize - toX
          const toDistToTop = toY
          const toDistToBottom = gridDataRef.current.svgSize - toY
          const toMinDist = Math.min(toDistToLeft, toDistToRight, toDistToTop, toDistToBottom)

          // Use the minimum distance of both points (connection is as dark as its darkest point)
          const minDistToEdge = Math.min(fromMinDist, toMinDist)

          // Pulse animation
          const pulse = (Math.sin(timeRef.current * 2 + connData.phase) + 1) / 2
          const baseOpacity = 0.12 + pulse * 0.04 // Lower base opacity similar to matrix-canvas (0.08-0.16 range)

          // Apply edge fading (fade from 1.0 at edgeMargin to 0.2 at edge 0) - match matrix-canvas.tsx
          let strokeOpacity = baseOpacity
          if (minDistToEdge < gridDataRef.current.edgeMargin) {
            const fadeFactor = Math.max(0.2, minDistToEdge / gridDataRef.current.edgeMargin)
            strokeOpacity = baseOpacity * fadeFactor
          }

          // Update position and stroke
          element.setAttribute('x1', String(fromPoint.x))
          element.setAttribute('y1', String(fromPoint.y))
          element.setAttribute('x2', String(toX))
          element.setAttribute('y2', String(toY))
          // Use fixed stroke opacity, control visibility via element opacity
          // Smooth transitions are handled by JavaScript easing functions in the animation loop
          element.style.stroke = `rgba(${rgb}, ${strokeOpacity})`
          element.style.opacity = String(connData.fadeProgress)
        }
      })

      // Animate points opacity and size
      const pointElements = svg.querySelectorAll('.grid-point')

      pointElements.forEach((point, index) => {
        const element = point as SVGCircleElement
        if (gridDataRef.current && index < gridDataRef.current.points.length) {
          const pointData = gridDataRef.current.points[index]

          // Pulse animation - exactly match matrix-canvas.tsx
          const pulse = (Math.sin(timeRef.current * pointData.speed + pointData.phase) + 1) / 2
          // Match matrix-canvas: baseOpacity * (0.6 + pulse * 0.4)
          let opacity = pointData.baseOpacity * (0.6 + pulse * 0.4)

          // Calculate distance to edges (similar to matrix-canvas.tsx)
          const distToLeft = pointData.x
          const distToRight = gridDataRef.current.svgSize - pointData.x
          const distToTop = pointData.y
          const distToBottom = gridDataRef.current.svgSize - pointData.y
          const minDistToEdge = Math.min(distToLeft, distToRight, distToTop, distToBottom)

          // Apply edge darkening effect (fade from 1.0 at edgeMargin to 0.2 at edge 0) - match matrix-canvas.tsx
          if (minDistToEdge < gridDataRef.current.edgeMargin) {
            const fadeFactor = Math.max(0.2, minDistToEdge / gridDataRef.current.edgeMargin)
            opacity *= fadeFactor
          }

          // Radius similar to matrix-canvas.tsx
          const radius = 2.5
          element.style.opacity = String(opacity)
          element.setAttribute('r', String(radius))
        }
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      pendingStateUpdateRef.current = false
    }
  }, [gridData?.points, gridData?.svgSize]) // 只在 points 或 svgSize 变化时重新初始化

  if (!gridData) return null

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <svg
        ref={svgRef}
        className="absolute"
        style={{
          width: `${gridData.svgSize}px`,
          height: `${gridData.svgSize}px`,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        viewBox={`0 0 ${gridData.svgSize} ${gridData.svgSize}`}
      >
        {/* SVG filter for glow effect on points - match matrix-canvas.tsx glow */}
        <defs>
          <filter id="glow-filter" x="-200%" y="-200%" width="500%" height="500%">
            {/* Outer glow - matches matrix-canvas glowRadius = radius * 4 = 10 */}
            {/* Matrix-canvas: gradient from opacity*0.8 to opacity*0.3 to 0 */}
            {/* Create multiple blur layers for smoother gradient effect */}
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur2" />
            {/* Increase alpha significantly to make glow visible */}
            <feColorMatrix
              in="blur1"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 3 0"
              result="glow1"
            />
            <feColorMatrix
              in="blur2"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 2 0"
              result="glow2"
            />
            {/* Merge glow layers, then composite with source */}
            <feMerge>
              <feMergeNode in="glow1" />
              <feMergeNode in="glow2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid connections */}
        <g strokeWidth="1">
          {gridData.connections.map((conn, index) => {
            // 使用当前连接点（不考虑 targetTo，因为动画循环会直接更新 DOM）
            const fromPoint = gridData.points[conn.from]
            const toPoint = gridData.points[conn.to]
            if (!fromPoint || !toPoint) return null

            // Calculate initial opacity to match animation loop (prevents flash)
            const pulse = (Math.sin(0 * 2 + conn.phase) + 1) / 2
            let initialOpacity = 0.12 + pulse * 0.04

            // Calculate distance to edges for both points
            const fromDistToLeft = fromPoint.x
            const fromDistToRight = gridData.svgSize - fromPoint.x
            const fromDistToTop = fromPoint.y
            const fromDistToBottom = gridData.svgSize - fromPoint.y
            const fromMinDist = Math.min(
              fromDistToLeft,
              fromDistToRight,
              fromDistToTop,
              fromDistToBottom,
            )

            const toDistToLeft = toPoint.x
            const toDistToRight = gridData.svgSize - toPoint.x
            const toDistToTop = toPoint.y
            const toDistToBottom = gridData.svgSize - toPoint.y
            const toMinDist = Math.min(toDistToLeft, toDistToRight, toDistToTop, toDistToBottom)

            const minDistToEdge = Math.min(fromMinDist, toMinDist)

            // Apply edge fading
            if (minDistToEdge < gridData.edgeMargin) {
              const fadeFactor = Math.max(0.2, minDistToEdge / gridData.edgeMargin)
              initialOpacity *= fadeFactor
            }

            // Extract RGB from strokeColor or use fallback
            const rgbMatch = strokeColor.match(/\d+,\s*\d+,\s*\d+/)
            const rgb = rgbMatch ? rgbMatch[0] : strokeRgbRef.current

            // Use base opacity for stroke - animation loop will control visibility via element opacity
            // Don't divide by fadeProgress here as it can cause issues when fadeProgress is small
            const baseStrokeOpacity = initialOpacity

            return (
              <line
                key={`conn-${conn.from}-${conn.to}-${index}`}
                className="grid-connection"
                x1={fromPoint.x}
                y1={fromPoint.y}
                x2={toPoint.x}
                y2={toPoint.y}
                stroke={`rgba(${rgb}, ${baseStrokeOpacity})`}
                style={{
                  opacity: conn.fadeProgress,
                  // Transition for initial render, but animation loop handles smooth transitions
                  transition: 'opacity 0.3s ease-in-out',
                }}
              />
            )
          })}
        </g>

        {/* Grid points */}
        <g fill={pointColorRgb} filter="url(#glow-filter)">
          {gridData.points.map((point, index) => {
            // Calculate initial opacity to match animation loop (prevents flash)
            const pulse = (Math.sin(0 * point.speed + point.phase) + 1) / 2
            let initialOpacity = point.baseOpacity * (0.6 + pulse * 0.4)

            // Calculate distance to edges
            const distToLeft = point.x
            const distToRight = gridData.svgSize - point.x
            const distToTop = point.y
            const distToBottom = gridData.svgSize - point.y
            const minDistToEdge = Math.min(distToLeft, distToRight, distToTop, distToBottom)

            // Apply edge darkening effect
            if (minDistToEdge < gridData.edgeMargin) {
              const fadeFactor = Math.max(0.2, minDistToEdge / gridData.edgeMargin)
              initialOpacity *= fadeFactor
            }

            return (
              <circle
                key={`point-${index}`}
                className="grid-point"
                cx={point.x}
                cy={point.y}
                r="2.5"
                style={{ opacity: initialOpacity }}
              />
            )
          })}
        </g>
      </svg>
    </div>
  )
}

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  // Calculate initial scale based on window width to avoid flash
  // Match product/hero.tsx calculation: use BASE_OUTER_RADIUS for scale calculation
  const getInitialScale = () => {
    if (typeof window === 'undefined') return 1
    const containerWidth = window.innerWidth
    const maxRadius = Math.min(containerWidth * 0.45, BASE_OUTER_RADIUS)
    const newScale = maxRadius / BASE_OUTER_RADIUS
    return Math.max(0.5, Math.min(1, newScale))
  }

  const [scale, setScale] = useState(getInitialScale)

  // Calculate responsive scale based on container width
  // Match product/hero.tsx: use BASE_OUTER_RADIUS for scale calculation
  // Use useLayoutEffect to calculate scale synchronously before paint to avoid flash
  useLayoutEffect(() => {
    const calculateScale = () => {
      const container = sectionRef.current
      if (!container) return

      const containerWidth = container.offsetWidth
      // Scale down on smaller screens to fit within container
      // Use 90% of available width to ensure grid doesn't get clipped
      // Match product/hero.tsx calculation
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
    if (!title) return

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
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[calc(35vh*4/3)] flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 overflow-hidden"
    >
      {/* Background container with max-width */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center">
        <div className="relative w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] h-full">
          {/* Static grid background */}
          <StaticGridBackground scale={scale} />
          {/* Background gradient */}
          <div className="absolute inset-0">
            <div className="absolute top-1/4 left-1/4 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute top-1/2 right-1/4 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-accent/5 rounded-full blur-3xl opacity-50" />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] mx-auto text-center space-y-6 pt-16 pb-24 relative z-10">
        <h1
          ref={titleRef}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight"
        >
          <span className="hero-text-gradient">Simple, Transparent Pricing</span>
        </h1>
        <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          Begin for free, invite your team, and scale without limits.
        </p>
      </div>
    </section>
  )
}
