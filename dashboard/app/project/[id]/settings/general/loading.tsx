import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function Loading() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
          <div className="flex flex-col gap-6">
            {/* Header Skeleton */}
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-80" />
            </div>

            {/* Tabs Skeleton */}
            <div className="w-full">
              <div className="flex gap-2 mb-6">
                <Skeleton className="h-10 w-24" />
              </div>

              <div className="space-y-6 mt-6">
                {/* Project Details Card Skeleton */}
                <Card>
                  <CardHeader>
                    <Skeleton className="h-6 w-40 mb-2" />
                    <Skeleton className="h-4 w-64" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Skeleton className="h-10 w-20" />
                      <Skeleton className="h-10 w-20" />
                    </div>
                  </CardContent>
                </Card>

                {/* Separator Skeleton */}
                <Separator />

                {/* Danger Zone Card Skeleton */}
                <Card>
                  <CardHeader>
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-56" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5 flex-1">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                      <Skeleton className="h-9 w-24" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
    </div>
  );
}
