"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
import {
  Folder,
  Database,
  MessageSquare,
  LayoutDashboard,
  Activity,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Separator } from "@/components/ui/separator";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const t = useTranslations("sidebar");
  const { open } = useSidebar();
  const [isJaegerAvailable, setIsJaegerAvailable] = useState(false);

  // Check if Jaeger is available
  useEffect(() => {
    const checkJaeger = async () => {
      try {
        const { checkJaegerAvailability } = await import(
          "@/app/traces/actions"
        );
        const result = await checkJaegerAvailability();
        if (result.code === 0) {
          setIsJaegerAvailable(result.data?.available || false);
        }
      } catch (error) {
        console.error("Failed to check Jaeger availability:", error);
        setIsJaegerAvailable(false);
      }
    };

    checkJaeger();
    const interval = setInterval(checkJaeger, 30000);
    return () => clearInterval(interval);
  }, []);

  const dashboardItem = {
    title: t("dashboard"),
    url: "/dashboard",
    icon: LayoutDashboard,
  };

  const otherNavItems = [
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
  ];

  // Add traces button after Dashboard if Jaeger is available
  const navItems = isJaegerAvailable
    ? [
        dashboardItem,
        {
          title: t("traces"),
          url: "/traces",
          icon: Activity,
        },
        ...otherNavItems,
      ]
    : [dashboardItem, ...otherNavItems];

  const data = {
    navMain: navItems as {
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
                    src="/ico_black.svg"
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
