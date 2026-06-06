import type { Metadata } from "next";
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
  title: "IntelliRadar — Intellina AI Daily Intelligence",
  description: "Daily AI research reports, task intelligence, and presentations for Intellina AI.",
  openGraph: {
    title: "IntelliRadar — Intellina AI Daily Intelligence",
    description: "Daily AI research reports, task intelligence, and presentations for Intellina AI.",
    siteName: "IntelliRadar · Intellina AI",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "IntelliRadar — Intellina AI Daily Intelligence",
    description: "Daily AI research reports, task intelligence, and presentations for Intellina AI.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
