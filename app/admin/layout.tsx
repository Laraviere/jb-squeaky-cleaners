import type { Metadata } from "next";
import { connection } from "next/server";
import "./admin.css";
export const metadata: Metadata = {
  title: {
    default: "Staff Portal | JB Squeaky Cleaners",
    template: "%s | JB Squeaky Staff",
  },
  robots: { index: false, follow: false },
  description: "Private JB Squeaky Cleaners staff portal.",
};
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth pages must also reflect runtime configuration, even when built without it.
  await connection();
  return <div className="admin-root">{children}</div>;
}
