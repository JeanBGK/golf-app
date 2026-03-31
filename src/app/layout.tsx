import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Golf Team Match",
  description: "Best ball team scoring with real-time sync",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.className} h-full`}>
      <body className="min-h-full bg-green-50 text-gray-800">{children}</body>
    </html>
  );
}
