import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Maphy",
  description: "Math & Physics Olympiad practice, submissions, leaderboards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[color:var(--bg)] text-zinc-900">
        <Navbar />
        <div className="flex-1">{children}</div>
        <footer className="border-t border-zinc-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 text-sm text-zinc-600">
            Built for olympiad practice. <span className="text-zinc-400">Maphy</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
