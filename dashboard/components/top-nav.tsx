"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  Boxes,
  Box,
  ChevronsUpDown,
  Check,
  Plus,
  BookOpen,
  Github,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeSelector } from "@/components/theme-toggle";
import { logout } from "@/app/auth/login/actions";
import { Organization, Project } from "@/types";
import { useUserStore } from "@/stores/user";
import { useTopNavStore } from "@/stores/top-nav";
import { usePlanStore, Price, Product, getPlanTypeDisplayName, isPaidPlan } from "@/stores/plan";
import { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { encodeId } from "@/lib/id-codec";
import { SidebarTriggerWrapper } from "@/components/sidebar-trigger-wrapper";
import { AlertBanner } from "@/components/alert-banner";

const EXTERNAL_LINKS = [
  {
    href: "https://docs.acontext.io/",
    icon: BookOpen,
    label: "Documentation",
  },
  {
    href: "https://github.com/memodb-io/Acontext",
    icon: Github,
    label: "GitHub",
  },
];

// Type definitions for component props
interface OrganizationSelectorProps {
  currentOrganization?: Organization;
  organizations?: Organization[];
}

interface ProjectSelectorProps {
  currentProject?: Project;
  organization?: Organization;
  projects?: Project[];
}

interface TopNavProps {
  user: User;
  prices?: Price[];
  products?: Product[];
}

// Organization Selector Component
function OrganizationSelector({
  currentOrganization,
  organizations = [],
}: OrganizationSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  const handleSelect = (org: Organization) => {
    const encodedOrgId = encodeId(org.id);
    router.push(`/org/${encodedOrgId}`);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 min-w-0">
      {currentOrganization ? (
        <Link
          href={`/org/${encodeId(currentOrganization.id)}`}
          className="flex items-center gap-1 sm:gap-1.5 shrink-0 min-w-0 hover:opacity-80 transition-opacity"
        >
          <Boxes className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[100px] sm:max-w-[150px] md:max-w-[200px] truncate hidden sm:block text-sm">
            {currentOrganization.name}
          </span>
          {isPaidPlan(currentOrganization.plan) && (
            <Badge
              variant="outline"
              className="text-[9px] leading-none px-[5.5px] py-[3px] uppercase tracking-[0.07em] font-medium shrink-0 hidden sm:inline-flex"
            >
              {getPlanTypeDisplayName(currentOrganization.plan || "free")}
            </Badge>
          )}
        </Link>
      ) : (
        <>
          <Boxes className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[100px] sm:max-w-[150px] md:max-w-[200px] truncate hidden sm:block text-sm">
            MemoDB
          </span>
        </>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto shrink-0 touch-manipulation px-0!"
          >
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[240px] sm:w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Find organization..." />
            <CommandList>
              <CommandEmpty>No organization found.</CommandEmpty>
              {organizations.length > 0 && (
                <>
                  <CommandGroup>
                    {organizations.map((org) => (
                      <CommandItem
                        key={org.id}
                        value={`${org.name} ${org.id}`}
                        onSelect={() => handleSelect(org)}
                        className="flex items-center justify-between min-w-0"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="truncate">{org.name}</span>
                          {isPaidPlan(org.plan) && (
                            <Badge
                              variant="outline"
                              className="text-[9px] leading-none px-1 py-0.5 uppercase tracking-[0.07em] font-medium shrink-0"
                            >
                              {getPlanTypeDisplayName(org.plan || "free")}
                            </Badge>
                          )}
                        </div>
                        {currentOrganization?.id === org.id && (
                          <Check className="h-4 w-4" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}
              <CommandGroup>
                <CommandItem
                  value="all-organizations"
                  onSelect={() => {
                    router.push("/organizations");
                    setOpen(false);
                  }}
                >
                  <span>All Organizations</span>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value="new-organization"
                  onSelect={() => {
                    router.push("/new");
                    setOpen(false);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New organization</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Project Selector Component
function ProjectSelector({
  currentProject,
  organization,
  projects = [],
}: ProjectSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  const handleSelect = (proj: Project) => {
    const encodedProjectId = encodeId(proj.id);
    router.push(`/project/${encodedProjectId}`);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 min-w-0">
      <Box className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-foreground max-w-[120px] sm:max-w-32 lg:max-w-none truncate text-sm">
        {currentProject?.name || "Acontext"}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto shrink-0 touch-manipulation px-0!"
          >
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[240px] sm:w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Find project..." />
            <CommandList>
              <CommandEmpty>No project found.</CommandEmpty>
              {projects.length > 0 && (
                <>
                  <CommandGroup>
                    {projects.map((proj) => (
                      <CommandItem
                        key={proj.id}
                        value={`${proj.name} ${proj.id}`}
                        onSelect={() => handleSelect(proj)}
                        className="flex items-center justify-between"
                      >
                        <span>{proj.name}</span>
                        {currentProject?.id === proj.id && (
                          <Check className="h-4 w-4" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}
              <CommandGroup>
                <CommandItem
                  value="create-project"
                  onSelect={() => {
                    if (organization?.id) {
                      router.push(`/new/${encodeId(organization.id)}`);
                    }
                    setOpen(false);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Project</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function TopNav({ user, prices = [], products = [] }: TopNavProps) {
  // Get data from stores
  const { setUser } = useUserStore();
  const { title, organization, project, organizations, projects, hasSidebar } =
    useTopNavStore();
  const { setPrices, setProducts } = usePlanStore();
  const pathname = usePathname();

  // Sync user to store when it changes
  React.useEffect(() => {
    setUser(user);
  }, [user, setUser]);

  // Sync prices to plan store when it changes
  React.useEffect(() => {
    setPrices(prices);
    setProducts(products);
  }, [prices, products, setPrices, setProducts]);

  // Determine visibility flags for selectors
  const shouldShowProject = project !== null;
  const shouldShowOrganization = organization !== null;
  const hasBreadcrumbContent =
    shouldShowOrganization || shouldShowProject || title;

  // Handle user logout
  const handleLogout = async () => {
    await logout();
  };

  const displayName = React.useMemo(
    () =>
      user?.user_metadata?.name || user?.user_metadata?.full_name || "User",
    [user]
  );

  const userInitial = React.useMemo(
    () =>
      user?.user_metadata?.name?.[0] ||
      user?.user_metadata?.full_name?.[0] ||
      user?.email?.[0]?.toUpperCase() ||
      "U",
    [user]
  );

  return (
    <>
      {pathname.startsWith("/auth") ? (
        <></>
      ) : (
        <>
          {/* Mobile Top Layer - Only shown on small screens, contains logo and sidebar trigger */}
          <nav
            className={cn(
              "md:hidden fixed top-0 left-0 right-0 px-4 z-50 w-full h-14 border-b",
              "bg-sidebar border-sidebar-border shadow-sm",
              "transition-width duration-200",
              "flex flex-row items-center justify-between overflow-x-auto",
              "backdrop-blur supports-backdrop-filter:bg-sidebar/95"
            )}
          >
            <Link
              href="/"
              className="flex items-center h-[26px] w-[26px] min-w-[26px]"
            >
              <Image
                alt="Logo"
                src="/nav-logo-black.svg"
                width={26}
                height={26}
                priority
                className="h-[26px] w-[26px] cursor-pointer rounded dark:hidden"
              />
              <Image
                alt="Logo"
                src="/nav-logo-white.svg"
                width={26}
                height={26}
                priority
                className="h-[26px] w-[26px] cursor-pointer rounded hidden dark:block"
              />
            </Link>
            <div className="flex gap-2 min-w-0 ml-3">
              <AlertBanner variant="mobile" />
              {/* External links - shown on mobile */}
              {EXTERNAL_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <Tooltip key={link.href}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full h-8 w-8 border border-border"
                        asChild
                      >
                        <Link
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={link.label}
                        >
                          <Icon className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{link.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              {/* Only show sidebar trigger when sidebar exists */}
              {hasSidebar && <SidebarTriggerWrapper />}
            </div>
          </nav>

          {/* Bottom Layer - Always shown, contains org/project selectors */}
          <header
            className={cn(
              "w-full border-b bg-background backdrop-blur supports-backdrop-filter:bg-background/95 animate-slide-in-from-top",
              // On small screens (< md): fixed below mobile top layer (top-14 = 56px)
              // On medium screens and above (>= md): sticky at top
              "md:sticky md:top-0 fixed top-14 z-40"
            )}
          >
            <div className="flex h-12 items-center px-3 gap-2">
              {/* Left section: Logo and Breadcrumbs */}
              <div className="flex h-full items-center text-sm shrink min-w-0">
                {/* Logo - hidden on mobile when hasSidebar */}
                <Link
                  href="/"
                  className="hidden md:flex items-center justify-center shrink-0 mr-[11px]"
                >
                  <Image
                    alt="Logo"
                    src="/nav-logo-black.svg"
                    width={24}
                    height={24}
                    priority
                    className="h-[24px] dark:hidden"
                  />
                  <Image
                    alt="Logo"
                    src="/nav-logo-white.svg"
                    width={24}
                    height={24}
                    priority
                    className="h-[24px] hidden dark:block"
                  />
                </Link>

                {/* Breadcrumb Navigation */}
                <div className="flex items-center h-full gap-1.5 sm:gap-2">
                  {hasBreadcrumbContent && (
                    <Separator
                      orientation="vertical"
                      className="h-4 mr-1.5 md:mr-3 hidden md:block"
                    />
                  )}

                  {/* Organization Selector - Only shown when organization exists */}
                  {shouldShowOrganization && (
                    <OrganizationSelector
                      currentOrganization={organization || undefined}
                      organizations={organizations}
                    />
                  )}

                  {/* Project Selector - Only shown when project exists */}
                  {shouldShowProject && (
                    <>
                      {shouldShowOrganization && (
                        <Separator
                          orientation="vertical"
                          className="h-4 mx-1 sm:mx-2 shrink-0"
                        />
                      )}
                      <ProjectSelector
                        organization={organization || undefined}
                        currentProject={project || undefined}
                        projects={projects}
                      />
                    </>
                  )}

                  {/* Page Title - Shown when title is provided */}
                  {title && (
                    <>
                      {(shouldShowOrganization || shouldShowProject) && (
                        <Separator
                          orientation="vertical"
                          className="h-4 mx-1 sm:mx-2 shrink-0"
                        />
                      )}
                      <span className="text-sm font-medium truncate max-w-[200px] sm:max-w-none">
                        {title}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Middle section: Alert Banner */}
              <div className="hidden md:flex min-w-0 shrink ml-auto">
                <AlertBanner />
              </div>

              {/* Right section: Actions and User */}
              <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto md:ml-0">
                {/* Feedback - shown on medium screens and above */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs px-2 sm:px-2.5 py-1 rounded-full h-[32px] text-muted-foreground hover:text-foreground hidden md:inline-flex"
                  asChild
                >
                  <a href="mailto:support@acontext.io?subject=Feedback from Acontext Dashboard">
                    <span className="truncate">Feedback</span>
                  </a>
                </Button>

                {/* External links - shown on medium screens and above (hidden on small screens where they appear in Mobile Top Layer) */}
                {EXTERNAL_LINKS.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Tooltip key={link.href}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full h-8 w-8 hidden md:inline-flex border border-border"
                          asChild
                        >
                          <Link
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={link.label}
                          >
                            <Icon className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{link.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}

                {/* User Avatar */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full h-8 w-8 overflow-hidden p-0 touch-manipulation"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={user?.user_metadata?.avatar_url || user?.user_metadata?.picture || user?.user_metadata?.avatar || undefined}
                          alt={displayName}
                        />
                        <AvatarFallback>{userInitial}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <div className="px-2 py-1.5 flex flex-col gap-0 text-sm">
                      <span
                        title={displayName}
                        className="w-full text-left text-foreground truncate"
                      >
                        {displayName}
                      </span>
                      <span
                        title={user?.email || ""}
                        className="w-full text-left text-muted-foreground text-xs truncate"
                      >
                        {user?.email}
                      </span>
                    </div>
                    <Separator className="my-1" />
                    <ThemeSelector />
                    <Separator className="my-1" />
                    <DropdownMenuItem onClick={handleLogout}>
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>
        </>
      )}
    </>
  );
}
