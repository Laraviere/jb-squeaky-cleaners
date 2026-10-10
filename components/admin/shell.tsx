"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/admin/actions";
export function AdminShell({
  children,
  role,
}: {
  children: React.ReactNode;
  role: string;
}) {
  const pathname = usePathname(),
    [open, setOpen] = useState(false),
    toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  const links = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/quotes", label: "Quote Requests" },
    { href: "/admin/applications", label: "Employment Applications" },
  ];
  return (
    <div className="admin-shell">
      <a className="skip-link" href="#admin-content">
        Skip to content
      </a>
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <Link href="/admin" aria-label="JB Squeaky admin dashboard">
            <Image
              src="/branding/jb-squeaky-header-logo.png"
              alt="JB Squeaky Cleaners"
              width={1916}
              height={821}
              sizes="200px"
            />
          </Link>
          <button
            ref={toggle}
            className="admin-menu-toggle"
            aria-expanded={open}
            aria-controls="admin-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
        <div
          id="admin-navigation"
          className={`admin-nav-wrap ${open ? "is-open" : ""}`}
        >
          <p className="admin-eyebrow">Staff portal</p>
          <nav aria-label="Admin navigation">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={
                  (
                    l.href === "/admin"
                      ? pathname === l.href
                      : pathname.startsWith(l.href)
                  )
                    ? "page"
                    : undefined
                }
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="admin-account">
            <span>{role.charAt(0).toUpperCase() + role.slice(1)}</span>
            <form action={signOut}>
              <button type="submit">Sign out</button>
            </form>
            <Link href="/">Public website</Link>
          </div>
        </div>
      </aside>
      <main id="admin-content" tabIndex={-1} className="admin-content">
        {children}
      </main>
    </div>
  );
}
