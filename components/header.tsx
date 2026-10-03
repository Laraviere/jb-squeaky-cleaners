"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { business, navigation } from "@/lib/site";
import { Icon } from "./icon";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return <>
    <div className="topbar"><div className="container topbar-inner"><span>{business.area}</span><a href={business.phoneHref}><Icon name="phone" />{business.phone}</a></div></div>
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="logo-link" aria-label="JB Squeaky Cleaners home" onClick={() => setOpen(false)}>
          <Image src="/branding/jb-squeaky-header-logo.png" alt="JB Squeaky Cleaners LLC" width={1916} height={821} sizes="(max-width: 420px) 170px, (max-width: 900px) 180px, (max-width: 1100px) 200px, 220px" loading="eager" className="site-logo" />
        </Link>
        <button className="menu-toggle" aria-controls="site-navigation" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span>{open ? "Close" : "Menu"}</span><span className="menu-lines" aria-hidden="true">{open ? "×" : "☰"}</span>
        </button>
        <nav id="site-navigation" aria-label="Main navigation" className={`site-nav${open ? " is-open" : ""}`}>
          {navigation.map(item => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} onClick={() => setOpen(false)}>{item.label}</Link>)}
          <Link href="/request-a-quote" aria-current={pathname === "/request-a-quote" ? "page" : undefined} className="button button-small" onClick={() => setOpen(false)}>Request a Quote <Icon name="arrow" /></Link>
        </nav>
      </div>
    </header>
  </>;
}
