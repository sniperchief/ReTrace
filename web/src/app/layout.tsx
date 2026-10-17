import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { defaultLocale, getMessages } from "@/i18n";
import { MessagesProvider } from "@/i18n/client";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

const messages = getMessages(defaultLocale);

export const metadata: Metadata = {
  title: { default: messages.app.name, template: `%s · ${messages.app.name}` },
  description: messages.app.tagline,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f4d3f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={defaultLocale} className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <MessagesProvider messages={messages}>{children}</MessagesProvider>
      </body>
    </html>
  );
}
