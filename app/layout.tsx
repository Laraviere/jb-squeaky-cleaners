import type { Metadata, Viewport } from "next";
import { serviceAreas } from "@/lib/site";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "JB Squeaky Cleaners | Residential & Commercial Cleaning", template: "%s | JB Squeaky Cleaners" },
  description: `Locally owned and insured. ${serviceAreas.description} One-time and recurring plans. Request a quote.`,
  applicationName: "JB Squeaky Cleaners",
  icons: { apple: { url: "/branding/apple-touch-icon.png", sizes: "180x180", type: "image/png" } },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#061426" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a><Header /><main id="main-content" tabIndex={-1}>{children}</main><Footer /></body></html>;
}
