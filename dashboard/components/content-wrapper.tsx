"use client";

import { usePathname } from "next/navigation";

export function ContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith("/auth");

  return (
    <div
      className={`flex flex-1 w-full overflow-y-hidden ${
        isAuthPage ? "pt-0" : "md:pt-0 pt-[104px]"
      }`}
    >
      {children}
    </div>
  );
}

