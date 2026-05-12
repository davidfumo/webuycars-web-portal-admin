import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "WeBuyCars MZ",
  description: "WeBuyCars MZ administration and dealer portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`min-h-dvh bg-background font-sans antialiased ${inter.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
