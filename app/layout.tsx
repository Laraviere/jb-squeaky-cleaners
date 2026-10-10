import type { Metadata, Viewport } from "next";
import { serviceAreas } from "@/lib/site";
import { SiteChrome } from "@/components/site-chrome";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "JB Squeaky Cleaners | Residential & Commercial Cleaning",
    template: "%s | JB Squeaky Cleaners",
  },
  description: `Locally owned and insured. ${serviceAreas.description} One-time and recurring plans. Request a quote.`,
  applicationName: "JB Squeaky Cleaners",
  appleWebApp: {
    capable: true,
    title: "JB Squeaky Cleaners",
    statusBarStyle: "default",
  },
  icons: {
    apple: {
      url: "/branding/apple-touch-icon.png",
      sizes: "180x180",
      type: "image/png",
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#061426",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
