import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://travel.20041026.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "旅途手帐 | 智能旅行攻略与行李建议",
    template: "%s | 旅途手帐",
  },
  description: "输入或随机选择旅行目的地，日期可选，AI 为你生成旅行攻略、分日行程与可勾选行李清单。",
  keywords: ["旅行攻略", "行李建议", "行程规划", "AI旅行", "智能攻略"],
  openGraph: {
    title: "旅途手帐",
    description: "AI 旅行攻略与个性化行李建议",
    url: siteUrl,
    siteName: "旅途手帐",
    locale: "zh_CN",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
