import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JB Squeaky Cleaners LLC",
  description: "JB Squeaky Cleaners LLC — Coming Soon",
  applicationName: "JB Squeaky Cleaners",
  icons: {
    icon: [
      { url: "/branding/favicon.ico" },
      { url: "/branding/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/branding/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
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
