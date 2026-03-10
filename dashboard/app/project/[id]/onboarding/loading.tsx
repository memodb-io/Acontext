import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="max-w-3xl mx-auto">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>

        {/* Timeline Skeleton */}
        <div className="relative">
          <div className="absolute left-[15px] top-[40px] bottom-0 w-[2px] bg-border"></div>
          <div className="space-y-12">
            {/* Step 1 */}
            <div className="relative pl-12">
              <Skeleton className="absolute left-0 w-8 h-8 rounded-full" />
              <div>
                <Skeleton className="h-6 w-40 mb-4" />
                <Skeleton className="h-4 w-full mb-4" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative pl-12">
              <Skeleton className="absolute left-0 w-8 h-8 rounded-full" />
              <div>
                <Skeleton className="h-6 w-48 mb-4" />
                <Skeleton className="h-4 w-full mb-4" />
                <Skeleton className="h-9 w-36" />
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative pl-12">
              <Skeleton className="absolute left-0 w-8 h-8 rounded-full" />
              <div className="opacity-40">
                <Skeleton className="h-6 w-44 mb-4" />
                <Skeleton className="h-4 w-full mb-4" />
                <Skeleton className="h-48 w-full rounded-lg" />
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative pl-12">
              <Skeleton className="absolute left-0 w-8 h-8 rounded-full" />
              <div className="opacity-40">
                <Skeleton className="h-6 w-40 mb-4" />
                <Skeleton className="h-4 w-full mb-4" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            </div>

            {/* Step 5 */}
            <div className="relative pl-12">
              <Skeleton className="absolute left-0 w-8 h-8 rounded-full" />
              <div className="opacity-40">
                <Skeleton className="h-6 w-32 mb-4" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

