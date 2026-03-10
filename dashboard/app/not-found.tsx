"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-[calc(100vh-104px)] w-full items-center justify-center p-4 md:min-h-screen md:p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 text-6xl font-bold text-muted-foreground">404</div>
          <CardTitle className="text-2xl">Page Not Found</CardTitle>
          <CardDescription className="mt-2">
            Sorry, the page you are looking for does not exist or has been moved.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button asChild className="w-full">
            <Link href="/">Go Home</Link>
          </Button>
          <Button variant="outline" className="w-full" onClick={() => router.back()}>
            Go Back
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

