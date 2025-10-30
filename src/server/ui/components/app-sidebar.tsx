"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavMain } from "@/components/nav-main";

import Image from "next/image";
import Link from "next/link";
import { Folder, Database, MessageSquare, LayoutDashboard } from "lucide-react";
import { useTranslations } from "next-intl";
import { Separator } from "@/components/ui/separator";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const t = useTranslations("sidebar");
  const { open } = useSidebar();

  const data = {
    navMain: [
      {
        title: t("dashboard"),
        url: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: t("disk"),
        url: "/disk",
        icon: Folder,
      },
      {
        title: t("space"),
        url: "/space",
        icon: Database,
      },
      {
        title: t("session"),
        url: "/session",
        icon: MessageSquare,
      },
    ] as {
      title: string;
      url: string;
      icon?: React.ElementType;
      items?: {
        title: string;
        url: string;
      }[];
    }[],
  };

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                {open ? (
                  <Image
                    src="/rounded_white.svg"
                    alt="Acontext logo"
                    width={142}
                    height={32}
                    unoptimized
                    className="object-cover rounded-sm"
                  />
                ) : (
                  <Image
                    className="rounded"
                    src={`${
                      process.env.NEXT_PUBLIC_BASE_PATH || ""
                    }/ico_black.svg`}
                    alt="Acontext logo"
                    width={32}
                    height={32}
                    priority
                  />
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavMain />
      </SidebarHeader>
      <Separator className="!w-2/3 mx-auto" />
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {data.navMain.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.url}
                  tooltip={{
                    children: item.title,
                    hidden: false,
                  }}
                >
                  <Link href={item.url} className="font-medium">
                    {item.icon && <item.icon />}
                    {item.title}
                  </Link>
                </SidebarMenuButton>
                {item.items?.length ? (
                  <SidebarMenuSub>
                    {item.items.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === subItem.url}
                        >
                          <Link href={subItem.url}>{subItem.title}</Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                ) : null}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
