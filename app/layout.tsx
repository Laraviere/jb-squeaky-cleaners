import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JB Squeaky Cleaners LLC",
  description: "JB Squeaky Cleaners LLC — Coming Soon",
  applicationName: "JB Squeaky Cleaners",
  icons: {
    // Next.js generates the versioned browser icon link from app/favicon.ico.
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
      <body>{children}</body>
    </html>
  );
}
