import { Skeleton } from "@/components/ui/skeleton";

export default function LogsLoading() {
  return (
    <>
      {/* Header Section with Border */}
      <div className="py-16 border-b border-muted">
        <div className="mx-auto max-w-6xl px-4 w-full">
          <div className="flex flex-col gap-y-4">
            <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between w-full">
              {/* Title */}
              <div className="flex flex-col md:flex-row md:items-end gap-3 w-full">
                <div>
                  <Skeleton className="h-9 w-32 mb-2" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-9 w-[180px]" />
                  <Skeleton className="h-9 w-32" />
                  <Skeleton className="h-9 w-32" />
                  <Skeleton className="h-9 w-9" />
                </div>
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-4 py-8 w-full">
        {/* Chart Skeleton */}
        <div className="mb-6">
          <Skeleton className="h-32 w-full" />
        </div>

        {/* Table Skeleton */}
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

