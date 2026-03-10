import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="py-16 border-b border-muted">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-9 w-48" />
            <div className="flex gap-6">
              <div className="flex flex-col gap-y-1">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-8 w-16" />
              </div>
              <div className="flex flex-col gap-y-1">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="space-y-6">
          {/* Time range selector skeleton */}
          <div className="flex flex-row items-center gap-x-2">
            <Skeleton className="h-[26px] w-[180px]" />
            <Skeleton className="h-4 w-32" />
          </div>

          {/* Charts skeleton - 6 cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="bg-surface-100 rounded-md border shadow-sm overflow-hidden">
                <CardContent>
                  <div className="flex flex-col gap-y-3">
                    <div className="grow flex justify-between items-start min-h-16">
                      <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-8 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-[160px] w-full rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* New counts section - 3 cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="bg-surface-100 rounded-md border shadow-sm overflow-hidden">
                <CardContent>
                  <div className="flex flex-col gap-y-3">
                    <div className="grow flex justify-between items-start min-h-16">
                      <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-16" />
                      </div>
                    </div>
                    <Skeleton className="h-[160px] w-full rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
