"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { business, navigation } from "@/lib/site";
import { Icon } from "./icon";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuToggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      menuToggle.current?.focus();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="logo-link" aria-label="JB Squeaky Cleaners home" onClick={() => setOpen(false)}>
          <Image src="/branding/jb-squeaky-header-logo.png" alt="JB Squeaky Cleaners LLC" width={1916} height={821} sizes="(max-width: 420px) 160px, (max-width: 1100px) 180px, 200px" loading="eager" className="site-logo" />
        </Link>
        <button ref={menuToggle} className="menu-toggle" aria-controls="site-navigation" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span>{open ? "Close" : "Menu"}</span><span className="menu-lines" aria-hidden="true">{open ? "×" : "☰"}</span>
        </button>
        <div id="site-navigation" className={`header-menu${open ? " is-open" : ""}`}>
        <nav aria-label="Main navigation" className="site-nav">
          {navigation.map(item => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} onClick={() => setOpen(false)}>{item.label}</Link>)}
        </nav>
        <div className="header-actions">
          <div className="header-phones">{business.phones.map(phone => <a key={phone.href} href={phone.href} aria-label={`Call ${phone.label.toLowerCase()} number ${phone.number}`}><Icon name="phone" />{phone.number}</a>)}</div>
          <Link href="/request-a-quote" aria-current={pathname === "/request-a-quote" ? "page" : undefined} className="button button-small" onClick={() => setOpen(false)}>Request a Quote <Icon name="arrow" /></Link>
        </div>
        </div>
      </div>
    </header>
  );
}
