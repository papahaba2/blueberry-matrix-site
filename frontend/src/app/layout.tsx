import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import AppProviders from "@/components/app-providers";
import AppToaster from "@/components/app-toaster";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import SmoothScroll from "@/components/smooth-scroll";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "Blueberry Matrix — Fuse Limit Orders",
  description:
    "Single-sided V4 limit orders, automated vaults and on-chain transparency on Fuse.",
  icons: {
    icon: `${basePath}/berry-logo.svg`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-ink font-sans text-fog antialiased">
        <AppProviders>
          <SmoothScroll>
            <SiteHeader />
            <main className="min-h-screen pt-24">{children}</main>
            <SiteFooter />
            <AppToaster />
          </SmoothScroll>
        </AppProviders>
      </body>
    </html>
  );
}
