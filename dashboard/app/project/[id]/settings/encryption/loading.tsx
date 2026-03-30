import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-56" />
            </div>
            <Skeleton className="h-6 w-10 rounded-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
