"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface SettingsNavProps {
  projectId: string;
}

const tabs = [
  { label: "General", segment: "general" },
  { label: "Task Tracking", segment: "task-tracking" },
  { label: "Encryption", segment: "encryption" },
] as const;

export function SettingsNav({ projectId }: SettingsNavProps) {
  const pathname = usePathname();

  return (
    <div className="bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]">
      {tabs.map((tab) => {
        const href = `/project/${projectId}/settings/${tab.segment}`;
        const isActive = pathname.endsWith(`/settings/${tab.segment}`);

        return (
          <Link
            key={tab.segment}
            href={href}
            className={cn(
              "inline-flex h-[calc(100%-1px)] items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow]",
              "text-foreground dark:text-muted-foreground",
              isActive && "bg-background dark:bg-input/30 dark:text-foreground dark:border-input shadow-sm"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
