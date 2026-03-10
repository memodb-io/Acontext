import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="flex-1 flex min-h-screen items-start justify-center p-4 pt-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-7 w-64" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-full mt-2" />
            <Skeleton className="h-4 w-3/4 mt-2" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            {/* Name Input Skeleton */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-10 w-full" />
            </div>

            {/* Plan Select Skeleton */}
            <div className="grid gap-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-full" />
            </div>

            {/* Submit Button Skeleton */}
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

