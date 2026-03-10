"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ProjectError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Project error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-6 text-center max-w-md">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Failed to load project
          </h1>
          <p className="text-sm text-muted-foreground">
            We encountered an error while loading this project. This could be due to a network issue or a temporary server problem.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground font-mono">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <Button onClick={reset} variant="default">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/organizations">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to organizations
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
