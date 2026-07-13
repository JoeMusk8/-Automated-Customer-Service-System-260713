import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 客服中心",
  description: "多项目 AI 客服中台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
