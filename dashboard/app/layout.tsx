import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { TopNav } from "@/components/top-nav";
import { NProgressProvider } from "@/components/nprogress";
import {
  getCurrentUserOptional,
  getPrices,
} from "@/lib/supabase";
import { Toaster } from "@/components/ui/sonner";
import { ContentWrapper } from "@/components/content-wrapper";

import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dashboard | Acontext",
  description: "Dashboard for Acontext",
  icons: {
    icon: [
      {
        media: "(prefers-color-scheme: light)",
        url: "/ico_black.svg",
        href: "/ico_black.svg",
      },
      {
        media: "(prefers-color-scheme: dark)",
        url: "/ico_white.svg",
        href: "/ico_white.svg",
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, pricesResult] = await Promise.all([
    getCurrentUserOptional(),
    getPrices(),
  ]);

  return (
    <html
      lang="en"
      className={`${outfit.variable} dark`}
      suppressHydrationWarning
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
            (function() {
              try {
                var theme = localStorage.getItem('acontext-theme') || 'dark';
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {
                document.documentElement.classList.add('dark');
              }
            })();
          `,
          }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Toaster position="top-right" />
          <NProgressProvider />
          <div className="flex min-h-svh w-full">
            <div className="flex flex-col h-screen w-screen relative">
              {/* TopNav is fixed positioned, so it doesn't need to be in flex container */}
              {user && (
                <TopNav
                  user={user}
                  prices={pricesResult.prices}
                  products={pricesResult.products}
                />
              )}
              {/* Content area: add padding-top on mobile for fixed nav layers (56px + 48px = 104px) */}
              <ContentWrapper>{children}</ContentWrapper>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
