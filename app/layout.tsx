import type { Metadata } from "next";
import { Caveat, Lora, Special_Elite } from "next/font/google";
import "./globals.css";

// Handwritten display — recipe titles, headings, tab labels.
const caveat = Caveat({
  variable: "--font-hand",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Refined serif — recipe body and instructions.
const lora = Lora({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

// Typewriter — labels, metadata, buttons, the URL field.
const specialElite = Special_Elite({
  variable: "--font-type",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "The Recipe Notebook · Saved from YouTube",
  description:
    "Paste a YouTube cooking video, pull a clean recipe out of the chatter, and keep it in your notebook.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${caveat.variable} ${lora.variable} ${specialElite.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
