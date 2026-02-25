"use client";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import Link from "next/link";

import { BookText, ArrowUpRight, Github } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export function NavMain() {
  const pathname = usePathname();
  const t = useTranslations("navigation");

  const items = [
    {
      title: t("github"),
      url: "https://github.com/memodb-io/Acontext",
      icon: Github,
    },
    {
      title: t("docs"),
      url: "https://docs.acontext.app/",
      icon: BookText,
    },
  ];

  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title} className="group/item">
          <SidebarMenuButton
            asChild
            isActive={pathname === item.url}
            tooltip={{
              children: item.title,
              hidden: false,
            }}
          >
            <Link href={item.url} target="_blank">
              <item.icon />
              <span>{item.title}</span>
              {pathname !== item.url && (
                <ArrowUpRight className="invisible ml-auto h-4 w-4 shrink-0 opacity-50 group-hover/item:visible" />
              )}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
