import type { Metadata } from "next";
import "./admin.css";
export const metadata: Metadata = {
  title: {
    default: "Staff Portal | JB Squeaky Cleaners",
    template: "%s | JB Squeaky Staff",
  },
  robots: { index: false, follow: false },
  description: "Private JB Squeaky Cleaners staff portal.",
};
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="admin-root">{children}</div>;
}
