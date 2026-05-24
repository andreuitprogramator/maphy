import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import Link from "next/link";

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
  description: "Pregătire olimpiadă matematică și fizică, rezolvări, clasamente.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme — runs before React hydrates */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()` }} />
      </head>
      <body className="min-h-full flex flex-col bg-[color:var(--bg)] text-zinc-900">
        <Navbar />
        <div className="flex-1">{children}</div>
        <footer className="border-t border-zinc-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-zinc-500">
            <span>Construit pentru pregătire olimpiadă. <span className="text-zinc-400">Maphy</span></span>
            <div className="flex gap-4">
              <Link href="/termeni" className="hover:underline">Termeni și condiții</Link>
              <Link href="/confidentialitate" className="hover:underline">Confidențialitate</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
