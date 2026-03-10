"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as React from "react";

// Custom event name for triggering sidebar toggle
const SIDEBAR_TOGGLE_EVENT = "sidebar-toggle";

// Wrapper component that triggers sidebar toggle via custom event
// This works even when SidebarProvider is in a different component tree
export function SidebarTriggerWrapper() {
  const handleClick = React.useCallback(() => {
    // Dispatch custom event to trigger sidebar toggle
    window.dispatchEvent(new CustomEvent(SIDEBAR_TOGGLE_EVENT));
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "border rounded-md",
        "min-w-[32px] w-[32px] h-[32px]",
        "hover:bg-sidebar-accent hover:border-sidebar-border",
        "bg-sidebar-accent/50",
        "border-sidebar-border"
      )}
      onClick={handleClick}
    >
      <Menu className="h-[14px] w-[14px]" />
      <span className="sr-only">Toggle sidebar</span>
    </Button>
  );
}

// Export event name for use in SidebarProvider
export { SIDEBAR_TOGGLE_EVENT };

