import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "fzl AI 聊天小站",
  description: "给同学和朋友用的 AI 对话入口",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
