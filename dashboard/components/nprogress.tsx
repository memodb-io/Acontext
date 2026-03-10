"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import NProgress from "nprogress";

// Configure NProgress - disable spinner
NProgress.configure({
  showSpinner: false,
  minimum: 0.08,
  easing: "ease",
  speed: 300,
  trickle: true,
  trickleSpeed: 200,
});

export function NProgressProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstMount = useRef(true);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Listen for link clicks to start progress earlier
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (anchor && anchor.href) {
        const url = new URL(anchor.href);
        const currentUrl = new URL(window.location.href);

        // Only show progress for same-origin navigation
        if (url.origin === currentUrl.origin && url.pathname !== currentUrl.pathname) {
          // Clear any existing timer
          if (progressTimerRef.current) {
            clearTimeout(progressTimerRef.current);
          }
          NProgress.start();
        }
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  useEffect(() => {
    // Don't show progress on initial mount
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    // Complete progress bar after route change
    const timer = setTimeout(() => {
      NProgress.done();
      progressTimerRef.current = null;
    }, 100);

    progressTimerRef.current = timer;

    return () => {
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      NProgress.done();
    };
  }, [pathname, searchParams]);

  return null;
}

