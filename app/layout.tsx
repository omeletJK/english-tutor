import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "English Tutor Brain",
  description: "A private family English learning companion with rewards."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
