import { Skeleton } from "@/components/ui/skeleton";

export default function UserLoading() {
  return (
    <div className="h-full bg-background p-6 flex flex-col overflow-hidden space-y-2">
      <div className="shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <Skeleton className="h-10 w-64" />
      </div>

      <div className="flex-1 rounded-md border overflow-hidden flex flex-col min-h-0">
        <div className="p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 border rounded-md">
              <div className="flex-1 flex items-center gap-8">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
