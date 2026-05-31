import type { Metadata } from "next";
import Link from 'next/link';
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "HyperLocal - Cinematic B-Roll Generator",
  description: "Generate hyperlocalized cinematic b-roll footage from any location worldwide",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-background font-sans">
        <Providers>
          <nav className="border-b border-border">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-primary-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <span className="font-semibold text-lg">HyperLocal</span>
              </Link>
              <div className="flex items-center gap-4">
                <Link
                  href="/"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Projects
                </Link>
                <Link
                  href="/gallery"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Gallery
                </Link>
                <Link
                  href="/new"
                  className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  + New
                </Link>
              </div>
            </div>
          </nav>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
