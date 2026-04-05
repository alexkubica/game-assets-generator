import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AppNav } from "@/components/app-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Game Assets Generator",
  description: "Generate local video-derived game asset frames from a source image.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-4 md:px-8 md:py-6 lg:px-10">
          <AppNav />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
