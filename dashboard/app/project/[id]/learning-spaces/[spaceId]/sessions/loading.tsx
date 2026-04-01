import { Skeleton } from "@/components/ui/skeleton";

export default function SessionsLoading() {
  return (
    <div className="rounded-md border overflow-auto flex-1">
      <div className="space-y-0">
        {/* Header row */}
        <div className="flex gap-4 p-3 border-b">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
        {/* Data rows */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4 p-3 border-b">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
