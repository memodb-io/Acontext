import { Skeleton } from "@/components/ui/skeleton";

export default function AgentSkillsLoading() {
  return (
    <div className="h-full bg-background p-6 flex flex-col overflow-hidden space-y-2">
      <div className="shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton className="h-4 w-52" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>

        <div className="flex gap-2">
          <Skeleton className="h-10 w-[200px]" />
          <Skeleton className="h-10 w-64" />
        </div>
      </div>

      <div className="flex-1 overflow-hidden space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-md border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="flex gap-1">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
