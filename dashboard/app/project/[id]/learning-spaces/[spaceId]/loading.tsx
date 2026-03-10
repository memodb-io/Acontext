import { Skeleton } from "@/components/ui/skeleton";

export default function LearningSpaceDetailLoading() {
  return (
    <div className="h-full bg-background p-6 flex flex-col overflow-hidden space-y-4">
      {/* Header */}
      <div className="shrink-0 space-y-2">
        <div className="flex items-stretch gap-2">
          <Skeleton className="h-14 w-10" />
          <div>
            <Skeleton className="h-7 w-40 mb-1" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex gap-1">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-9 w-20" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-md border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-8 w-20" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
