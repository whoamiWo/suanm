import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: {
    default: '元亨利贞 · 传统术数排盘',
    template: '%s · 元亨利贞',
  },
  description:
    '综合八字、紫微斗数、六爻、奇门遁甲、大六壬等中国传统术数的在线排盘工具，支持真太阳时校正与免费分享。',
  keywords: ['八字排盘', '紫微斗数', '六爻', '奇门遁甲', '大六壬', '算命', '排盘'],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
