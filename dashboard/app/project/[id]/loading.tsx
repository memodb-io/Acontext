import { Skeleton } from "@/components/ui/skeleton";

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

      {/* Time range selector skeleton */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-row items-center gap-x-2">
          <Skeleton className="h-[26px] w-[180px]" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    </div>
  );
}
