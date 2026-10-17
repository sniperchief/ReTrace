import type { Metadata, Viewport } from "next";
import { Work_Sans } from "next/font/google";
import { Suspense, type ReactNode } from "react";
import { Flash } from "@/components/flash";
import { defaultLocale, getMessages } from "@/i18n";
import { MessagesProvider } from "@/i18n/client";
import { getLocale } from "@/server/i18n";
import "./globals.css";

const workSans = Work_Sans({ variable: "--font-work-sans", subsets: ["latin"] });

const messages = getMessages(defaultLocale);

export const metadata: Metadata = {
  title: { default: messages.app.name, template: `%s · ${messages.app.name}` },
  description: messages.app.tagline,
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
  appleWebApp: { capable: true, title: messages.app.name, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#151035",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={defaultLocale} className={`${workSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {/* The language comes from a cookie, so everything inside streams per request. */}
        <Suspense fallback={null}>
          <LocalizedRoot>{children}</LocalizedRoot>
        </Suspense>
      </body>
    </html>
  );
}

async function LocalizedRoot({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <MessagesProvider messages={getMessages(locale)} locale={locale}>
      {children}
      {/* One instance for the whole app: previous pages stay mounted (hidden) during navigation. */}
      <Flash />
    </MessagesProvider>
  );
}
