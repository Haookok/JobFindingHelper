import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { SearchBar } from "@/components/search-bar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "秋招面试辅助系统",
  description: "帮助求职者系统复习技术八股文、模拟面试、追踪求职进度",
};

const navItems = [
  { href: "/", label: "首页" },
  { href: "/knowledge", label: "知识库" },
  { href: "/interview", label: "模拟面试" },
  { href: "/progress", label: "进度追踪" },
  { href: "/resume", label: "简历分析" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center px-6">
            <Link href="/" className="mr-8 flex items-center space-x-2">
              <span className="text-lg font-bold tracking-tight">
                JobFindingHelper
              </span>
            </Link>
            <nav className="flex items-center space-x-6 text-sm font-medium">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto">
              <SearchBar />
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t py-6">
          <div className="container flex items-center justify-center px-6">
            <p className="text-sm text-muted-foreground">
              秋招面试辅助系统 &mdash; 祝你拿到心仪的 Offer
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
