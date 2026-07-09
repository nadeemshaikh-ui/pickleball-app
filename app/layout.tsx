import type { Metadata } from "next";
import { Anton, Oswald } from "next/font/google";
import "./globals.css";
import DecorativeBackground from "@/components/DecorativeBackground";

const anton = Anton({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const oswald = Oswald({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Pickleball Session",
  description: "Pickleball session scorekeeping",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${anton.variable} ${oswald.variable}`}>
      <body>
        <DecorativeBackground />
        {children}
      </body>
    </html>
  );
}
