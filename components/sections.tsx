import Image from "next/image";
import Link from "next/link";
import { Icon } from "./icon";
import { business } from "@/lib/site";

export function Photo({ src, alt, className = "", eager = false }: { src: string; alt: string; className?: string; eager?: boolean }) {
  return <Image src={src} alt={alt} width={1536} height={2048} sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 600px" className={`photo ${className}`} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} />;
}

export function QuoteLink({ children = "Request a Quote", className = "" }: { children?: React.ReactNode; className?: string }) {
  return <Link href="/request-a-quote" className={`button ${className}`}>{children}<Icon name="arrow" /></Link>;
}

export function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="page-intro"><div className="container"><span className="eyebrow"><span />{eyebrow}</span><h1>{title}</h1><div className="intro-copy">{children}</div></div><div className="intro-sparkle" aria-hidden="true"><Icon name="sparkle" /></div></section>;
}

export function ContactBanner() {
  return <section className="contact-banner"><div className="container banner-inner"><div><span className="eyebrow light"><span />Let’s make room for clean</span><h2>Your space. Your priorities.<br />Let’s find your cleaning plan.</h2><p>One-time or recurring cleaning, tailored to the conversation.</p></div><div className="banner-actions"><QuoteLink /><a href={business.phoneHref} className="banner-phone">Or call {business.phone}</a></div></div></section>;
}

export function Priorities({ items }: { items: { title: string; text: string }[] }) {
  return <div className="priorities">{items.map(item => <div className="priority" key={item.title}><span className="check-icon"><Icon name="check" /></span><div><h3>{item.title}</h3><p>{item.text}</p></div></div>)}</div>;
}
