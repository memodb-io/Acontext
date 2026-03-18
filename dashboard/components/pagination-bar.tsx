"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  isLoading?: boolean;
}

export function PaginationBar({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  itemLabel = "items",
  isLoading,
}: PaginationBarProps) {
  return (
    <div className="border-t p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground flex items-center gap-2">
          {totalItems} {itemLabel}
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (page) =>
                  page === 1 ||
                  page === totalPages ||
                  Math.abs(page - currentPage) <= 1
              )
              .map((page, idx, arr) => {
                const showEllipsisBefore =
                  idx > 0 && page - arr[idx - 1] > 1;
                return (
                  <div key={page} className="flex items-center">
                    {showEllipsisBefore && (
                      <span className="px-2 text-sm text-muted-foreground">
                        ...
                      </span>
                    )}
                    <Button
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => onPageChange(page)}
                      className="min-w-10"
                    >
                      {page}
                    </Button>
                  </div>
                );
              })}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onPageChange(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
