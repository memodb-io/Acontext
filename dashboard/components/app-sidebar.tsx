"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon, ChevronsLeftRight } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SIDEBAR_MODE_KEY = "sidebar_mode";

type SidebarMode = "expanded" | "collapsed" | "hover";

export interface NavItem {
  title?: string;
  icon?: LucideIcon;
  href?: string;
  exactMatch?: boolean; // If true, only match exact pathname; if false, match prefix
  tag?: string; // Optional tag to display as a badge below the icon
  divider?: boolean; // If true, render a separator after this item
}

interface AppSidebarProps {
  navItems: NavItem[];
}

// Sidebar Control Component
function SidebarControl({
  mode,
  onModeChange,
}: {
  mode: SidebarMode;
  onModeChange: (mode: SidebarMode) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-8 text-xs group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center"
        >
          <ChevronsLeftRight className="h-3.5 w-3.5 shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden">
            Sidebar control
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-40">
        <DropdownMenuLabel>Sidebar control</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => onModeChange("expanded")}
          className={mode === "expanded" ? "bg-accent" : ""}
        >
          Expanded
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onModeChange("collapsed")}
          className={mode === "collapsed" ? "bg-accent" : ""}
        >
          Collapsed
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onModeChange("hover")}
          className={mode === "hover" ? "bg-accent" : ""}
        >
          Expand on hover
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppSidebar({ navItems }: AppSidebarProps) {
  const pathname = usePathname();
  const { setOpen, open, setOpenMobile, isMobile } = useSidebar();

  // Initialize with default value to avoid hydration mismatch
  // Load from localStorage only after mount
  const [mode, setMode] = React.useState<SidebarMode>("hover");
  const [isMounted, setIsMounted] = React.useState(false);

  // Use ref to track current mode to avoid closure issues
  const modeRef = React.useRef<SidebarMode>("hover");
  // Track previous mode to only update on mode change, not on every render
  const prevModeRef = React.useRef<SidebarMode | null>(null);
  // Store setOpen in ref to avoid dependency issues
  const setOpenRef = React.useRef(setOpen);
  React.useEffect(() => {
    setOpenRef.current = setOpen;
  }, [setOpen]);

  // Load sidebar mode from localStorage after mount to avoid hydration mismatch
  React.useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem(SIDEBAR_MODE_KEY) as SidebarMode;
    if (saved && ["expanded", "collapsed", "hover"].includes(saved)) {
      setMode(saved);
      modeRef.current = saved;
      // Don't set prevModeRef here - let the mode change useEffect handle it
      // This ensures the mode change logic runs even on initial load
      // Set initial state based on loaded mode using ref to ensure consistency
      if (saved === "expanded") {
        setOpenRef.current(true);
      } else {
        setOpenRef.current(false);
      }
    } else {
      // Default to hover mode with closed state
      modeRef.current = "hover";
      // Don't set prevModeRef here - let the mode change useEffect handle it
      setOpenRef.current(false);
    }
  }, []);

  // Save mode to localStorage when it changes
  React.useEffect(() => {
    if (isMounted) {
      localStorage.setItem(SIDEBAR_MODE_KEY, mode);
    }
  }, [mode, isMounted]);

  // Update sidebar state only when mode actually changes
  // For hover mode, we set it to closed initially but let the sidebar component handle hover behavior
  React.useEffect(() => {
    if (!isMounted) return;

    // Only update state when mode actually changes
    if (prevModeRef.current === mode) return;
    prevModeRef.current = mode;

    if (mode === "expanded") {
      setOpenRef.current(true);
    } else if (mode === "collapsed") {
      // For collapsed mode, always keep it closed
      setOpenRef.current(false);
    } else if (mode === "hover") {
      // For hover mode, set to closed initially
      // The sidebar component's onMouseEnter/onMouseLeave will handle the hover behavior
      setOpenRef.current(false);
    }
  }, [mode, isMounted]);

  // For expanded and collapsed modes, enforce the state even if user tries to toggle
  // Hover mode is handled separately to allow natural hover behavior
  React.useEffect(() => {
    if (!isMounted || mode === "hover") {
      return;
    }

    // Only enforce state for expanded and collapsed modes
    if (mode === "expanded" && !open) {
      setOpenRef.current(true);
    } else if (mode === "collapsed" && open) {
      setOpenRef.current(false);
    }
  }, [mode, open, isMounted]);

  // Keep ref in sync with mode
  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Determine collapsible and variant props based on mode
  // Expanded: offcanvas mode, not floating, always open
  // Collapsed: icon mode, not floating, always closed (shows icons only)
  // Hover: icon mode, floating, closed by default, opens on hover
  const collapsible = React.useMemo<"offcanvas" | "icon" | "none">(() => {
    return mode === "expanded" ? "offcanvas" : "icon";
  }, [mode]);

  const variant = React.useMemo<"sidebar" | "floating" | "inset">(() => {
    return mode === "hover" ? "floating" : "sidebar";
  }, [mode]);

  const handleModeChange = React.useCallback(
    (newMode: SidebarMode) => {
      // Update mode immediately - the useEffect will handle state updates
      setMode(newMode);
      modeRef.current = newMode;

      // Save to localStorage immediately
      if (isMounted) {
        localStorage.setItem(SIDEBAR_MODE_KEY, newMode);
      }
    },
    [isMounted]
  );

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item, index) => {
                // Handle divider items
                if (item.divider) {
                  return (
                    <SidebarSeparator
                      key={`divider-${index}`}
                      className="mx-0"
                    />
                  );
                }

                const Icon = item.icon;
                // Determine if item is active based on exactMatch prop
                let isActive = false;
                if (item.exactMatch !== false) {
                  // Default: exact match
                  isActive = pathname === item.href;
                } else {
                  // Prefix match
                  isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                }
                return (
                  <SidebarMenuItem key={item.title} className="relative">
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link
                        href={item.href ?? ""}
                        onClick={(e) => {
                          // Prevent navigation only if already on this exact page
                          if (isActive && pathname === item.href) {
                            e.preventDefault();
                            return;
                          }
                          // Close mobile sidebar when clicking a navigation item
                          if (isMobile) {
                            setOpenMobile(false);
                          }
                        }}
                      >
                        {Icon && <Icon className="h-4 w-4" />}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.tag && item.tag.trim() && (
                      <Badge
                        variant="secondary"
                        className="absolute -top-1 -right-2 bg-blue-500 text-white dark:bg-blue-600 text-[10px] px-1 py-0 h-4 leading-none min-w-[16px] flex items-center justify-center z-10"
                      >
                        {item.tag}
                      </Badge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="hidden md:block">
        <SidebarControl mode={mode} onModeChange={handleModeChange} />
      </SidebarFooter>
    </Sidebar>
  );
}
