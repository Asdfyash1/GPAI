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
  title: "Forge — STEM Copilot",
  description:
    "Forge is a high-performance STEM copilot: solver, visualizer, chat, cheatsheet builder, report writer, PDF notes, and notebook in one workspace.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
  },
  metadataBase: new URL("https://forge-gpai.vercel.app"),
  openGraph: {
    type: "website",
    title: "Forge — STEM Copilot",
    description:
      "Step-by-step AI solver with cross-check verification, multi-model chat, visualizer, cheatsheets, and more.",
    siteName: "Forge",
  },
  twitter: {
    card: "summary_large_image",
    title: "Forge — STEM Copilot",
    description:
      "AI-powered STEM education platform with solver, chat, visualizer, and more.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
