import { Skeleton } from "@/components/ui/skeleton";

export default function MessagesLoading() {
  return (
    <div className="h-full bg-background p-6">
      <div className="space-y-4">
        <div className="flex items-stretch gap-2">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>

        <div className="rounded-md border overflow-hidden flex flex-col">
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-md">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full max-w-[400px]" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
