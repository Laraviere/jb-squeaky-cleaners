import Image from "next/image";
import Link from "next/link";
import { business, navigation } from "@/lib/site";

export function Footer() {
  return <footer className="site-footer"><div className="container">
    <div className="footer-grid">
      <div className="footer-brand"><Link href="/" aria-label="JB Squeaky Cleaners home"><Image src="/branding/jb-squeaky-logo.JPG" alt="JB Squeaky Cleaners LLC" width={1170} height={660} sizes="170px" className="footer-logo" /></Link><p>Cleaning for the places<br />where life and work happen.</p><span className="footer-tag">Locally owned. Insured.</span></div>
      <div><h2>Explore</h2><nav aria-label="Footer navigation">{navigation.map(item => <Link href={item.href} key={item.href}>{item.label}</Link>)}<Link href="/request-a-quote">Request a Quote</Link></nav></div>
      <div><h2>Let’s talk cleaning</h2><a className="footer-phone" href={business.phoneHref}>{business.phone}</a><a href={`mailto:${business.email}`}>{business.email}</a><p className="footer-area">Southwest Virginia<br />Northwest North Carolina</p></div>
    </div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} JB Squeaky Cleaners LLC</span><span>Residential & commercial cleaning</span></div>
  </div></footer>;
}
