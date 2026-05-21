import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "慢慢说",
  description: "给同学们的一个安静小空间",
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
