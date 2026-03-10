"use client";

import { useSyncExternalStore, useState, useEffect } from "react";
import { X, Info, AlertTriangle, Megaphone, PartyPopper } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AlertBannerData } from "@/lib/supabase/operations/alert-banner";

const DISMISS_KEY = "alert-banner-dismissed-id";
const DISMISS_EVENT = "alert-banner-dismiss";

function subscribe(callback: () => void) {
  window.addEventListener(DISMISS_EVENT, callback);
  return () => window.removeEventListener(DISMISS_EVENT, callback);
}

function getDismissedId() {
  return localStorage.getItem(DISMISS_KEY);
}

function isBannerInTimeWindow(data: AlertBannerData): boolean {
  const now = Date.now();
  if (data.start_at && now < new Date(data.start_at).getTime()) return false;
  if (data.end_at && now > new Date(data.end_at).getTime()) return false;
  return true;
}

function useAlertBanner() {
  const [data, setData] = useState<AlertBannerData | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.functions.invoke("get-alert-banner").then(({ data: res }) => {
      const banner = res as AlertBannerData | null;
      if (banner?.visible && isBannerInTimeWindow(banner)) {
        setData(banner);
      }
    });
  }, []);

  const dismissedId = useSyncExternalStore(subscribe, getDismissedId, () => null);
  const isDismissed = !!data && dismissedId === data.id;

  const dismiss = () => {
    if (!data) return;
    localStorage.setItem(DISMISS_KEY, data.id);
    window.dispatchEvent(new Event(DISMISS_EVENT));
  };

  return { data, isDismissed, dismiss };
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  discord: DiscordIcon,
  info: Info,
  warning: AlertTriangle,
  megaphone: Megaphone,
  party: PartyPopper,
};

function BannerIcon({ icon, className }: { icon?: string; className?: string }) {
  const Icon = ICON_MAP[icon ?? "info"] ?? Info;
  return <Icon className={className} />;
}

function parseHtml(html: string): React.ReactNode[] {
  const pattern = /<a[^>]*>(.*?)<\/a>|<br\s*\/?>/gi;
  const matches = Array.from(html.matchAll(pattern));
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  for (const m of matches) {
    const idx = m.index!;
    if (idx > cursor) nodes.push(html.slice(cursor, idx));
    if (m[1] !== undefined) {
      nodes.push(
        <span
          key={idx}
          className="font-semibold"
          style={{ color: "var(--alert-banner-color)" }}
        >
          {m[1]}
        </span>
      );
    } else {
      nodes.push(" ");
    }
    cursor = idx + m[0].length;
  }
  if (cursor < html.length) nodes.push(html.slice(cursor));
  return nodes;
}

export function AlertBanner({ variant = "desktop" }: { variant?: "mobile" | "desktop" }) {
  const { data, isDismissed, dismiss } = useAlertBanner();

  if (!data || isDismissed) return null;

  const color = data.color ?? "#3b82f6";
  const href = data.url;
  const pillStyle = {
    "--alert-banner-color": color,
    borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
    backgroundColor: `color-mix(in srgb, ${color} 5%, transparent)`,
  } as React.CSSProperties;

  const Tag = href ? "a" : "div";
  const linkProps = href
    ? { href, target: "_blank" as const, rel: "noopener noreferrer" }
    : {};

  if (variant === "mobile") {
    return (
      <Tag
        {...linkProps}
        className="group/banner flex items-center gap-1.5 rounded-full h-8 px-2.5 text-xs border transition-colors min-w-0 shrink"
        style={pillStyle}
      >
        <span className="shrink-0" style={{ color }}>
          <BannerIcon icon={data.icon} className="size-3.5" />
        </span>
        <span className="truncate text-muted-foreground">
          {parseHtml(data.html)}
        </span>
      </Tag>
    );
  }

  return (
    <Tag
      {...linkProps}
      className="group/banner flex items-center gap-1.5 rounded-full h-[32px] px-3 text-xs border transition-colors min-w-0"
      style={pillStyle}
    >
      <span className="shrink-0" style={{ color }}>
        <BannerIcon icon={data.icon} className="size-3.5" />
      </span>
      <span className="truncate text-muted-foreground group-hover/banner:text-foreground transition-colors">
        {parseHtml(data.html)}
      </span>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dismiss();
        }}
        className="shrink-0 rounded-full p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="size-3" />
      </button>
    </Tag>
  );
}
