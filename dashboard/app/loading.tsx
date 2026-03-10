import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export default function Loading() {
  return (
    <SidebarProvider defaultOpen={false}>
      {/* Sidebar Skeleton */}
      <div className="hidden md:block fixed left-0 top-12 h-[calc(100vh-3rem)] w-12 z-10">
        <div className="bg-sidebar border-r border-sidebar-border flex h-full w-full flex-col">
          {/* Sidebar Content Skeleton */}
          <div className="flex-1 p-2 space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-8 rounded-md" />
            ))}
          </div>
          {/* Sidebar Footer Skeleton */}
          <div className="p-2">
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      </div>

      {/* Sidebar Gap */}
      <div className="hidden md:block w-12 shrink-0" />

      <SidebarInset>
        <div className="container mx-auto py-8 px-4 max-w-6xl">
          <div className="flex flex-col gap-6">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-10 w-32" />
            </div>

            {/* Projects List Skeleton */}
            <div className="flex flex-col gap-4">
              {/* Search Bar Skeleton */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Skeleton className="h-10 w-full pl-9" />
              </div>

              {/* Projects Grid Skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="h-full">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-5 shrink-0 rounded" />
                        <Skeleton className="h-6 flex-1" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-4 w-24" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
