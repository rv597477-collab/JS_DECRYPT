import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JS_DECRYPT | JavaScript Deobfuscator & Obfuscator",
  description: "Professional JavaScript deobfuscation and obfuscation tool. Reverse engineer any obfuscated JavaScript code with AST-based transforms.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="scanlines grid-bg">
        {children}
      </body>
    </html>
  );
}
