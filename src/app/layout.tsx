import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 问答助手",
  description: "公开访问的 AI 问答网站",
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
