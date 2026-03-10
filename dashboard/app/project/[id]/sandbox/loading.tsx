import { Skeleton } from "@/components/ui/skeleton";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

export default function SandboxLoading() {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {/* Sandbox List Panel Skeleton */}
      <ResizablePanel defaultSize={25} minSize={15} maxSize={35}>
        <div className="h-full bg-background p-4 flex flex-col">
          <div className="mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-7 w-24" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-9" />
              </div>
            </div>
            <Skeleton className="h-10 w-full" />
          </div>

          <div className="flex-1 overflow-auto space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />

      {/* Content Panel Skeleton */}
      <ResizablePanel>
        <div className="h-full bg-background p-4 overflow-auto">
          <Skeleton className="h-7 w-20 mb-4" />
          <div className="rounded-md border bg-card p-6">
            <div className="space-y-6">
              {/* Sandbox header skeleton */}
              <div className="border-b pb-4">
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>

              {/* Sandbox details skeleton */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-8 w-full" />
                </div>
                <div>
                  <Skeleton className="h-4 w-20 mb-1" />
                  <Skeleton className="h-8 w-full" />
                </div>
                <div>
                  <Skeleton className="h-4 w-20 mb-1" />
                  <Skeleton className="h-8 w-full" />
                </div>
                <div>
                  <Skeleton className="h-4 w-20 mb-1" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>

              {/* History commands section skeleton */}
              <div className="border-t pt-4">
                <Skeleton className="h-4 w-32 mb-3" />
                <Skeleton className="h-64 w-full rounded-md" />
              </div>

              {/* Generated files section skeleton */}
              <div className="border-t pt-4">
                <Skeleton className="h-4 w-28 mb-3" />
                <Skeleton className="h-64 w-full rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
