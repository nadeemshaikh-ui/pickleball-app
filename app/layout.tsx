import type { Metadata } from "next";
import { Bebas_Neue, Oswald } from "next/font/google";
import "./globals.css";
import DecorativeBackground from "@/components/DecorativeBackground";
import AuthGate from "@/components/AuthGate";
import ClubSwitcher from "@/components/ClubSwitcher";
import GlobalNav from "@/components/GlobalNav";
import DevModePanel from "@/components/DevModePanel";
import ErrorLogger from "@/components/ErrorLogger";
import UpgradePrompt from "@/components/UpgradePrompt";
import AiChatDrawer from "@/components/AiChatDrawer";
import TopBarHomeButton from "@/components/TopBarHomeButton";
import { ActivityTracker } from "@/components/ActivityTracker";

const bebas = Bebas_Neue({
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
    <html lang="en" className={`${bebas.variable} ${oswald.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ActivityTracker />
        <TopBarHomeButton />
        <DecorativeBackground />
        <AuthGate />
        <ClubSwitcher />
        <div style={{ paddingBottom: 80 }}>{children}</div>
        <GlobalNav />
        <AiChatDrawer />
        <DevModePanel />
        <ErrorLogger />
        <UpgradePrompt />
      </body>
    </html>
  );
}
