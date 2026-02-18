import type { Metadata } from "next";
import "./globals.css";

import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import CommonLayout from "@/components/common-layout";

export const metadata: Metadata = {
  title: "Acontext",
  description: "Acontext",
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
  const locale = await getLocale();

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <CommonLayout>
              {children}
              <Toaster />
            </CommonLayout>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
