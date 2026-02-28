'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Github,
  ArrowRight,
  ArrowUpRight,
  FileText,
  BookOpen,
  MessageSquare,
  Package,
  LayoutDashboard,
  Route,
  Bot,
  Menu,
  X,
  DollarSign,
  BarChart3,
  Brain,
  Box,
} from 'lucide-react'

import { useTheme } from 'next-themes'
import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn, getImageInfo } from '@/lib/utils'
import type { Post } from '@/payload-types'
import { AnimatedLogo } from '@/components/animation/animated-logo'

export function Header() {
  const pathname = usePathname()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [showBlogDropdown, setShowBlogDropdown] = useState(false)
  const [showDocsDropdown, setShowDocsDropdown] = useState(false)
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [latestPosts, setLatestPosts] = useState<Post[]>([])
  const [postsLoaded, setPostsLoaded] = useState(false)
  const [starCount, setStarCount] = useState<number | null>(null)
  const [_isMobile, setIsMobile] = useState(false)
  const [logoCollapsed, setLogoCollapsed] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const docsDropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const productDropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const mobileMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMounted(true)

    // Check if mobile on mount and resize
    const checkMobile = () => {
      const mobile = window.innerWidth < 768 // md breakpoint
      setIsMobile(mobile)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    // Fetch GitHub star count
    const fetchStarCount = async () => {
      try {
        const res = await fetch('https://api.github.com/repos/memodb-io/acontext')
        if (res.ok) {
          const data: { stargazers_count: number } = await res.json()
          setStarCount(data.stargazers_count)
        }
      } catch (error) {
        console.error('Failed to fetch star count:', error)
      }
    }
    fetchStarCount()

    // Handle scroll for logo collapse (both mobile and desktop)
    const handleScroll = () => {
      const scrollY = window.scrollY
      setLogoCollapsed(scrollY > 50)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('resize', checkMobile)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('button[aria-label="Toggle menu"]')
      ) {
        setShowMobileMenu(false)
      }
    }

    if (showMobileMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = ''
    }
  }, [showMobileMenu])

  // Close mobile menu on route change
  useEffect(() => {
    setShowMobileMenu(false)
  }, [pathname])

  const fetchLatestPosts = async () => {
    if (postsLoaded) return

    try {
      const res = await fetch('/api/posts?limit=3&sort=-date&depth=1', {
        cache: 'force-cache', // 使用浏览器缓存
      })
      const data: { docs: Post[] } = await res.json()
      setLatestPosts(data.docs || [])
      setPostsLoaded(true)
    } catch (error) {
      console.error('Failed to fetch posts:', error)
    }
  }

  const handleMouseEnter = () => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current)
    }
    setShowBlogDropdown(true)
    fetchLatestPosts()
  }

  const handleMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setShowBlogDropdown(false)
    }, 150)
  }

  const handleDocsMouseEnter = () => {
    if (docsDropdownTimeoutRef.current) {
      clearTimeout(docsDropdownTimeoutRef.current)
    }
    setShowDocsDropdown(true)
  }

  const handleDocsMouseLeave = () => {
    docsDropdownTimeoutRef.current = setTimeout(() => {
      setShowDocsDropdown(false)
    }, 150)
  }

  const handleProductMouseEnter = () => {
    if (productDropdownTimeoutRef.current) {
      clearTimeout(productDropdownTimeoutRef.current)
    }
    setShowProductDropdown(true)
  }

  const handleProductMouseLeave = () => {
    productDropdownTimeoutRef.current = setTimeout(() => {
      setShowProductDropdown(false)
    }, 150)
  }

  const handleMobileLinkClick = () => {
    setShowMobileMenu(false)
  }

  const _isDark = mounted ? resolvedTheme === 'dark' : true

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-header border-b border-border/50">
      <div className="w-full max-w-[1400px] lg:max-w-[1200px] md:max-w-[768px] mx-auto">
        <div className="flex items-center justify-between h-16 px-4 md:px-1">
          {/* Logo + Navigation (left-aligned) */}
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center hover:opacity-80 transition-opacity"
              aria-label="Go to homepage"
            >
              <AnimatedLogo
                width={120}
                height={24}
                collapsed={logoCollapsed}
                disableAutoCollapse={true}
              />
            </Link>

            {/* Navigation - left aligned next to logo */}
            <nav className="hidden md:flex items-center gap-6">
              <div
                className="relative"
                onMouseEnter={handleProductMouseEnter}
                onMouseLeave={handleProductMouseLeave}
              >
                <Link
                  href="/product"
                  className={cn(
                    'text-sm font-medium transition-colors',
                    pathname === '/product' || pathname.startsWith('/product/')
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-primary',
                  )}
                  aria-label="Go to product page"
                >
                  Product
                </Link>

                {/* Product Dropdown */}
                <div
                  className={`absolute left-1/2 -translate-x-1/2 top-full pt-2 transition-all duration-200 ${showProductDropdown
                      ? 'opacity-100 visible translate-y-0'
                      : 'opacity-0 invisible -translate-y-1'
                    }`}
                >
                  <div className="w-[280px] bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
                    <div className="px-3 py-2 border-b border-border/50 bg-muted/20 flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground uppercase tracking-wide">
                        Product
                      </span>
                      <Link
                        href="/product"
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                        aria-label="View all products"
                      >
                        View all
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                    <div className="py-1">
                      <Link
                        href="/product/short-term-memory"
                        className="block px-3 py-1 hover:bg-muted/50 transition-colors group"
                        aria-label="Go to Short-term Memory page"
                      >
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded bg-blue-500/10 shrink-0 flex items-center justify-center">
                              <MessageSquare className="h-4 w-4 text-blue-500" />
                            </div>
                            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                              Short-term Memory
                            </span>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                      <Link
                        href="/product/mid-term-state"
                        className="block px-3 py-1 hover:bg-muted/50 transition-colors group"
                        aria-label="Go to Mid-term State page"
                      >
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded bg-indigo-500/10 shrink-0 flex items-center justify-center">
                              <BarChart3 className="h-4 w-4 text-indigo-500" />
                            </div>
                            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                              Mid-term State
                            </span>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                      <Link
                        href="/product/long-term-skill"
                        className="block px-3 py-1 hover:bg-muted/50 transition-colors group"
                        aria-label="Go to Long-term Skill page"
                      >
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded bg-pink-500/10 shrink-0 flex items-center justify-center">
                              <Brain className="h-4 w-4 text-pink-500" />
                            </div>
                            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                              Long-term Skill
                            </span>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                      <Link
                        href="/product/sandbox"
                        className="block px-3 py-1 hover:bg-muted/50 transition-colors group"
                        aria-label="Go to Sandbox page"
                      >
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded bg-emerald-500/10 shrink-0 flex items-center justify-center">
                              <Box className="h-4 w-4 text-emerald-500" />
                            </div>
                            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                              Sandbox
                            </span>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                      <Link
                        href="https://dash.acontext.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-3 py-1 hover:bg-muted/50 transition-colors group"
                        aria-label="Dashboard (opens in new tab)"
                      >
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded bg-purple-500/10 shrink-0 flex items-center justify-center">
                              <LayoutDashboard className="h-4 w-4 text-purple-500" />
                            </div>
                            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                              Dashboard
                            </span>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
              <Link
                href="/pricing"
                className={cn(
                  'text-sm font-medium transition-colors',
                  pathname === '/pricing'
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-primary',
                )}
                aria-label="Go to pricing page"
              >
                Pricing
              </Link>
              <div
                className="relative"
                onMouseEnter={handleDocsMouseEnter}
                onMouseLeave={handleDocsMouseLeave}
              >
                <Link
                  href="https://docs.acontext.app"
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                  aria-label="Go to documentation (opens in new tab)"
                >
                  Docs
                </Link>

                {/* Docs Dropdown */}
                <div
                  className={`absolute left-1/2 -translate-x-1/2 top-full pt-2 transition-all duration-200 ${showDocsDropdown
                      ? 'opacity-100 visible translate-y-0'
                      : 'opacity-0 invisible -translate-y-1'
                    }`}
                >
                  <div className="w-[480px] bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
                    {/* Two Column Layout */}
                    <div className="flex">
                      {/* Documentation Column */}
                      <div className="flex-1 border-r border-border/50">
                        <div className="px-3 py-2 border-b border-border/50 bg-muted/20 flex items-center">
                          <span className="text-sm font-semibold text-foreground uppercase tracking-wide">
                            Documentation
                          </span>
                        </div>
                        <div className="py-1">
                          <Link
                            href="https://docs.acontext.app/api-reference/introduction"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block px-3 py-1 hover:bg-muted/50 transition-colors group"
                            aria-label="API Reference: Introduction (opens in new tab)"
                          >
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded bg-muted/50 shrink-0 flex items-center justify-center">
                                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                  Introduction
                                </span>
                              </div>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </Link>
                          <Link
                            href="https://docs.acontext.app/api-reference/agent_skills/create-agent-skill"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block px-3 py-1 hover:bg-muted/50 transition-colors group"
                            aria-label="API Reference: Agent Skills (opens in new tab)"
                          >
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded bg-muted/50 shrink-0 flex items-center justify-center">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                  Agent Skills
                                </span>
                              </div>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </Link>
                          <Link
                            href="https://docs.acontext.app/api-reference/artifact/get-artifact"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block px-3 py-1 hover:bg-muted/50 transition-colors group"
                            aria-label="API Reference: Artifact (opens in new tab)"
                          >
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded bg-muted/50 shrink-0 flex items-center justify-center">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                  Artifact
                                </span>
                              </div>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </Link>
                          <Link
                            href="https://docs.acontext.app/api-reference/disk/create-disk"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block px-3 py-1 hover:bg-muted/50 transition-colors group"
                            aria-label="API Reference: Disk (opens in new tab)"
                          >
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded bg-muted/50 shrink-0 flex items-center justify-center">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                  Disk
                                </span>
                              </div>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </Link>
                          <Link
                            href="https://docs.acontext.app/api-reference/sessions/create-session"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block px-3 py-1 hover:bg-muted/50 transition-colors group"
                            aria-label="API Reference: Sessions (opens in new tab)"
                          >
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded bg-muted/50 shrink-0 flex items-center justify-center">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                  Sessions
                                </span>
                              </div>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </Link>
                          <Link
                            href="https://docs.acontext.app/api-reference/sandbox/create-a-new-sandbox"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block px-3 py-1 hover:bg-muted/50 transition-colors group"
                            aria-label="API Reference: Sandbox (opens in new tab)"
                          >
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded bg-muted/50 shrink-0 flex items-center justify-center">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                  Sandbox
                                </span>
                              </div>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </Link>
                        </div>
                      </div>

                      {/* Guides Column */}
                      <div className="flex-1">
                        <div className="px-3 py-2 border-b border-border/50 bg-muted/20 flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground uppercase tracking-wide">
                            Guides
                          </span>
                          <Link
                            href="https://docs.acontext.app"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                            aria-label="View documentation (opens in new tab)"
                          >
                            View docs
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                        <div className="py-1">
                          <Link
                            href="https://docs.acontext.app/store/messages"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block px-3 py-1 hover:bg-muted/50 transition-colors group"
                            aria-label="Guide: Store Messages (opens in new tab)"
                          >
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded bg-muted/50 shrink-0 flex items-center justify-center">
                                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                  Store Messages
                                </span>
                              </div>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </Link>
                          <Link
                            href="https://docs.acontext.app/store/artifacts"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block px-3 py-1 hover:bg-muted/50 transition-colors group"
                            aria-label="Guide: Store Artifacts (opens in new tab)"
                          >
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded bg-muted/50 shrink-0 flex items-center justify-center">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                  Store Artifacts
                                </span>
                              </div>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </Link>
                          <Link
                            href="https://docs.acontext.app/observe/dashboard"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block px-3 py-1 hover:bg-muted/50 transition-colors group"
                            aria-label="Guide: Dashboard (opens in new tab)"
                          >
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded bg-muted/50 shrink-0 flex items-center justify-center">
                                  <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                  Dashboard
                                </span>
                              </div>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </Link>
                          <Link
                            href="https://docs.acontext.app/observe/traces"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block px-3 py-1 hover:bg-muted/50 transition-colors group"
                            aria-label="Guide: Traces (opens in new tab)"
                          >
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded bg-muted/50 shrink-0 flex items-center justify-center">
                                  <Route className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                  Traces
                                </span>
                              </div>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </Link>
                          <Link
                            href="https://docs.acontext.app/observe/agent_tasks"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block px-3 py-1 hover:bg-muted/50 transition-colors group"
                            aria-label="Guide: Agent Tasks (opens in new tab)"
                          >
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded bg-muted/50 shrink-0 flex items-center justify-center">
                                  <Bot className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                  Agent Tasks
                                </span>
                              </div>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="relative"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <Link
                  href="/blog"
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                  aria-label="Go to blog"
                >
                  Blog
                </Link>

                {/* Blog Dropdown */}
                <div
                  className={`absolute left-1/2 -translate-x-1/2 top-full pt-2 transition-all duration-200 ${showBlogDropdown
                      ? 'opacity-100 visible translate-y-0'
                      : 'opacity-0 invisible -translate-y-1'
                    }`}
                >
                  <div className="w-96 bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
                    {/* Header */}
                    <div className="px-3 py-2 border-b border-border/50 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground uppercase tracking-wide">
                          Latest posts
                        </span>
                        <Link
                          href="/blog"
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                          aria-label="View all blog posts"
                        >
                          All posts
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>

                    {/* Posts List */}
                    <div className="py-1">
                      {latestPosts.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-muted-foreground">Loading...</div>
                      ) : (
                        latestPosts.map((post) => (
                          <Link
                            key={post.id}
                            href={`/blog/${post.slug}`}
                            className="block px-4 py-2.5 hover:bg-muted/50 transition-colors group"
                            aria-label={`Read blog post: ${post.title}`}
                          >
                            <div className="flex items-start gap-3">
                              {(() => {
                                const imageInfo = getImageInfo(post.image)
                                return imageInfo.url ? (
                                  <div className="w-28 h-16 rounded overflow-hidden shrink-0 bg-muted aspect-video">
                                    <Image
                                      src={imageInfo.url}
                                      alt={imageInfo.alt || post.title}
                                      width={112}
                                      height={64}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-28 h-16 rounded bg-muted/50 shrink-0 flex items-center justify-center aspect-video">
                                    <FileText className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                )
                              })()}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                                  {post.title}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {new Date(post.date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </p>
                              </div>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </nav>
          </div>

          {/* Right side buttons */}
          <div className="flex items-center gap-3">
            <a
              href="https://cal.com/acontext/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-0.5 text-sm font-medium text-muted-foreground relative transition-all duration-200 hover:text-foreground after:content-[''] after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-px after:bg-foreground after:transition-all after:duration-200 hover:after:w-full"
              aria-label="Talk to Founder (opens in new tab)"
            >
              Talk to Founder
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild className="gap-1.5 px-2.5">
              <a
                href="https://github.com/memodb-io/acontext"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View on GitHub (opens in new tab)"
              >
                <Github className="h-4 w-4" />
                {starCount !== null && (
                  <span className="text-xs font-medium tabular-nums">
                    {starCount >= 1000 ? `${(starCount / 1000).toFixed(1)}k` : starCount}
                  </span>
                )}
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild className="hidden sm:flex">
              <a
                href="https://discord.acontext.io"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Join Discord community (opens in new tab)"
              >
                <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                Discord
              </a>
            </Button>
            <Button size="sm" asChild className="hidden sm:flex">
              <a
                href="https://dash.acontext.io"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Go to dashboard (opens in new tab)"
              >
                Dashboard
              </a>
            </Button>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              aria-label="Toggle menu"
            >
              {showMobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        ref={mobileMenuRef}
        className={`fixed left-0 top-16 flex h-[calc(100vh-4rem)] w-full origin-top bg-background text-foreground md:hidden z-100 transition-all duration-300 ease-in-out ${showMobileMenu
            ? 'opacity-100 scale-y-100 translate-y-0'
            : 'opacity-0 scale-y-95 -translate-y-4 pointer-events-none'
          }`}
      >
        <div className="flex h-full max-h-full w-full flex-col px-3">
          <div className="flex h-full max-h-full flex-col overflow-y-auto px-3 pb-40">
            <nav className="w-full space-y-0">
              <Link
                href="/product/short-term-memory"
                onClick={handleMobileLinkClick}
                className={cn(
                  'group outline-none w-full',
                  pathname === '/product/short-term-memory' && 'text-primary',
                )}
                aria-label="Go to Short-term Memory page"
              >
                <div className="flex gap-x-1 text-center font-sans transition justify-center items-center shrink-0 select-none group-focus:outline-none group-disabled:opacity-75 group-disabled:pointer-events-none disabled:opacity-50 text-xs border-b border-border py-3 w-full">
                  <div className="w-full transition">
                    <span className="flex w-full items-center justify-between">
                      <span className="flex items-center gap-x-0.5 text-base font-normal text-foreground">
                        Short-term Memory
                      </span>
                      <MessageSquare className="size-5 opacity-50" />
                    </span>
                  </div>
                </div>
              </Link>
              <Link
                href="/product/mid-term-state"
                onClick={handleMobileLinkClick}
                className={cn(
                  'group outline-none w-full',
                  pathname === '/product/mid-term-state' && 'text-primary',
                )}
                aria-label="Go to Mid-term State page"
              >
                <div className="flex gap-x-1 text-center font-sans transition justify-center items-center shrink-0 select-none group-focus:outline-none group-disabled:opacity-75 group-disabled:pointer-events-none disabled:opacity-50 text-xs border-b border-border py-3 w-full">
                  <div className="w-full transition">
                    <span className="flex w-full items-center justify-between">
                      <span className="flex items-center gap-x-0.5 text-base font-normal text-foreground">
                        Mid-term State
                      </span>
                      <BarChart3 className="size-5 opacity-50" />
                    </span>
                  </div>
                </div>
              </Link>
              <Link
                href="/product/long-term-skill"
                onClick={handleMobileLinkClick}
                className={cn(
                  'group outline-none w-full',
                  pathname === '/product/long-term-skill' && 'text-primary',
                )}
                aria-label="Go to Long-term Skill page"
              >
                <div className="flex gap-x-1 text-center font-sans transition justify-center items-center shrink-0 select-none group-focus:outline-none group-disabled:opacity-75 group-disabled:pointer-events-none disabled:opacity-50 text-xs border-b border-border py-3 w-full">
                  <div className="w-full transition">
                    <span className="flex w-full items-center justify-between">
                      <span className="flex items-center gap-x-0.5 text-base font-normal text-foreground">
                        Long-term Skill
                      </span>
                      <Brain className="size-5 opacity-50" />
                    </span>
                  </div>
                </div>
              </Link>
              <Link
                href="/product/sandbox"
                onClick={handleMobileLinkClick}
                className={cn(
                  'group outline-none w-full',
                  pathname === '/product/sandbox' && 'text-primary',
                )}
                aria-label="Go to Sandbox page"
              >
                <div className="flex gap-x-1 text-center font-sans transition justify-center items-center shrink-0 select-none group-focus:outline-none group-disabled:opacity-75 group-disabled:pointer-events-none disabled:opacity-50 text-xs border-b border-border py-3 w-full">
                  <div className="w-full transition">
                    <span className="flex w-full items-center justify-between">
                      <span className="flex items-center gap-x-0.5 text-base font-normal text-foreground">
                        Sandbox
                      </span>
                      <Box className="size-5 opacity-50" />
                    </span>
                  </div>
                </div>
              </Link>
              <a
                href="https://dash.acontext.io"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleMobileLinkClick}
                className="group outline-none w-full"
                aria-label="Dashboard (opens in new tab)"
              >
                <div className="flex gap-x-1 text-center font-sans transition justify-center items-center shrink-0 select-none group-focus:outline-none group-disabled:opacity-75 group-disabled:pointer-events-none disabled:opacity-50 text-xs border-b border-border py-3 w-full">
                  <div className="w-full transition">
                    <span className="flex w-full items-center justify-between">
                      <span className="flex items-center gap-x-0.5 text-base font-normal text-foreground">
                        Dashboard
                      </span>
                      <LayoutDashboard className="size-5 opacity-50" />
                    </span>
                  </div>
                </div>
              </a>
              <Link
                href="/pricing"
                onClick={handleMobileLinkClick}
                className={cn(
                  'group outline-none w-full',
                  pathname === '/pricing' && 'text-primary',
                )}
                aria-label="Go to pricing page"
              >
                <div className="flex gap-x-1 text-center font-sans transition justify-center items-center shrink-0 select-none group-focus:outline-none group-disabled:opacity-75 group-disabled:pointer-events-none disabled:opacity-50 text-xs border-b border-border py-3 w-full">
                  <div className="w-full transition">
                    <span className="flex w-full items-center justify-between">
                      <span className="flex items-center gap-x-0.5 text-base font-normal text-foreground">
                        Pricing
                      </span>
                      <DollarSign className="size-5 opacity-50" />
                    </span>
                  </div>
                </div>
              </Link>
              <Link
                href="https://docs.acontext.app"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleMobileLinkClick}
                className="group outline-none w-full"
                aria-label="Go to documentation (opens in new tab)"
              >
                <div className="flex gap-x-1 text-center font-sans transition justify-center items-center shrink-0 select-none group-focus:outline-none group-disabled:opacity-75 group-disabled:pointer-events-none disabled:opacity-50 text-xs border-b border-border py-3 w-full">
                  <div className="w-full transition">
                    <span className="flex w-full items-center justify-between">
                      <span className="flex items-center gap-x-0.5 text-base font-normal text-foreground">
                        Docs
                      </span>
                      <BookOpen className="size-5 opacity-50" />
                    </span>
                  </div>
                </div>
              </Link>
              <Link
                href="/blog"
                onClick={handleMobileLinkClick}
                className="group outline-none w-full"
                aria-label="Go to blog"
              >
                <div className="flex gap-x-1 text-center font-sans transition justify-center items-center shrink-0 select-none group-focus:outline-none group-disabled:opacity-75 group-disabled:pointer-events-none disabled:opacity-50 text-xs border-b border-border py-3 w-full">
                  <div className="w-full transition">
                    <span className="flex w-full items-center justify-between">
                      <span className="flex items-center gap-x-0.5 text-base font-normal text-foreground">
                        Blog
                      </span>
                      <FileText className="size-5 opacity-50" />
                    </span>
                  </div>
                </div>
              </Link>
              <a
                href="https://github.com/memodb-io/acontext"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleMobileLinkClick}
                className="group outline-none w-full"
                aria-label="View on GitHub (opens in new tab)"
              >
                <div className="flex gap-x-1 text-center font-sans transition justify-center items-center shrink-0 select-none group-focus:outline-none group-disabled:opacity-75 group-disabled:pointer-events-none disabled:opacity-50 text-xs border-b border-border py-3 w-full">
                  <div className="w-full transition">
                    <span className="flex w-full items-center justify-between">
                      <span className="flex items-center gap-x-0.5 text-base font-normal text-foreground">
                        GitHub
                      </span>
                      <Github className="size-5 opacity-50" />
                    </span>
                  </div>
                </div>
              </a>
              <a
                href="https://discord.acontext.io"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleMobileLinkClick}
                className="group outline-none w-full"
                aria-label="Join Discord community (opens in new tab)"
              >
                <div className="flex gap-x-1 text-center font-sans transition justify-center items-center shrink-0 select-none group-focus:outline-none group-disabled:opacity-75 group-disabled:pointer-events-none disabled:opacity-50 text-xs border-b border-border py-3 w-full">
                  <div className="w-full transition">
                    <span className="flex w-full items-center justify-between">
                      <span className="flex items-center gap-x-0.5 text-base font-normal text-foreground">
                        Join our community
                      </span>
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        className="size-5 opacity-50"
                      >
                        <path
                          d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
              </a>
              <a
                href="https://dash.acontext.io"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleMobileLinkClick}
                className="group outline-none w-full"
                aria-label="Go to dashboard (opens in new tab)"
              >
                <div className="flex gap-x-1 text-center font-sans transition justify-center items-center shrink-0 select-none group-focus:outline-none group-disabled:opacity-75 group-disabled:pointer-events-none disabled:opacity-50 text-xs border-b border-border py-3 w-full">
                  <div className="w-full transition">
                    <span className="flex w-full items-center justify-between">
                      <span className="flex items-center gap-x-0.5 text-base font-normal text-foreground">
                        Dashboard
                      </span>
                      <LayoutDashboard className="size-5 opacity-50" />
                    </span>
                  </div>
                </div>
              </a>
            </nav>
          </div>
        </div>
      </div>
    </header>
  )
}
