import { Skeleton } from "@/components/ui/skeleton";

export default function AgentSkillDetailLoading() {
  return (
    <div className="h-full bg-background p-6 flex flex-col overflow-hidden space-y-2">
      <div className="shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-stretch gap-2">
            <Skeleton className="h-10 w-10" />
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      <div className="flex-1 rounded-md border overflow-hidden flex flex-col min-h-0">
        <div className="flex h-full">
          <div className="w-[35%] border-r p-4 space-y-2">
            <Skeleton className="h-4 w-12 mb-3" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2 py-1.5">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
          <div className="flex-1 p-4">
            <Skeleton className="h-full w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
