import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// The metadata object is where we link our manifest file.
export const metadata: Metadata = {
  title: "Offline Voice Assistant",
  description: "A Next.js voice assistant that runs mostly offline.",
  manifest: "/manifest.json", // This line is crucial for PWA functionality.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
