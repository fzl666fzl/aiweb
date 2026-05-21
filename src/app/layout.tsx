import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "fzl AI 小站",
  description: "给同学和朋友用的小工具集合",
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
