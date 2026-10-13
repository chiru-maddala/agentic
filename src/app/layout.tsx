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
  title: "AI Ready School — K-12 AI Intelligence",
  description: "Daily K-12 AI research reports, goals, and task intelligence for AI Ready School.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  openGraph: {
    title: "AI Ready School — K-12 AI Intelligence",
    description: "Daily K-12 AI research reports, goals, and task intelligence for AI Ready School.",
    siteName: "AI Ready School · Intellina AI",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AI Ready School — K-12 AI Intelligence",
    description: "Daily K-12 AI research reports, goals, and task intelligence for AI Ready School.",
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
