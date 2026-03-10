import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex flex-col gap-6">
        {/* Header Skeleton */}
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Current Plan Card Skeleton */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-10 w-48" />
            </div>
            <div className="mt-4 p-4 border rounded-lg">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
        </Card>

        {/* Past Invoices Card Skeleton */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-80" />
              </div>
              <Skeleton className="h-10 w-10" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-4 py-3 border-b last:border-0">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods Card Skeleton */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-10 w-10" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <Skeleton className="w-12 h-8" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="pt-4">
              <Skeleton className="h-10 w-36" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
