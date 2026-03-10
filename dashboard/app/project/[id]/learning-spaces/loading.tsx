import { Skeleton } from "@/components/ui/skeleton";

export default function LearningSpacesLoading() {
  return (
    <div className="h-full bg-background p-6 flex flex-col overflow-hidden space-y-2">
      <div className="shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>

        <div className="flex gap-2">
          <Skeleton className="h-10 w-[200px]" />
          <Skeleton className="h-10 w-[300px]" />
        </div>
      </div>

      <div className="flex-1 rounded-md border overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto">
          <div className="w-full">
            <div className="flex items-center border-b px-4 py-3">
              <Skeleton className="h-4 w-20 mr-8" />
              <Skeleton className="h-4 w-16 mr-8" />
              <Skeleton className="h-4 w-32 mr-8" />
              <Skeleton className="h-4 w-24 mr-8" />
              <Skeleton className="h-4 w-40" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center border-b px-4 py-4">
                <Skeleton className="h-4 w-20 mr-8" />
                <Skeleton className="h-4 w-24 mr-8" />
                <Skeleton className="h-4 w-40 mr-8" />
                <Skeleton className="h-4 w-32 mr-8" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
