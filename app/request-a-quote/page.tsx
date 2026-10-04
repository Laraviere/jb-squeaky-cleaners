import type { Metadata } from "next";
import { connection } from "next/server";
import { QuoteForm } from "@/components/quote-form";
import { PageIntro } from "@/components/sections";
import { getQuoteConfiguration } from "@/lib/quote-storage";
import { business, serviceAreas } from "@/lib/site";

export const metadata: Metadata = { title: "Request a Quote", description: `Request a quote from JB Squeaky Cleaners. ${serviceAreas.description} Call (276) 235-2889.` };

export default async function RequestQuote() {
  await connection();
  const configured = !!getQuoteConfiguration();
  return <><PageIntro eyebrow="Request a quote" title="Let’s talk about your space."><p>Tell us what needs cleaning. We’ll discuss the scope, timing, and a plan that fits your property.</p></PageIntro><section className="section quote-section"><div className="container quote-layout"><aside className="quote-sidebar"><span className="eyebrow"><span />A conversation starts here</span><h2>Home or business,<br />we’re here to help.</h2><p>Not sure which cleaning service you need? Share what you can, or get in touch directly.</p><div className="contact-block"><span>GIVE US A CALL</span><a href={business.phoneHref} className="quote-phone">{business.phone}</a></div><div className="contact-block"><span>SEND AN EMAIL</span><a href={`mailto:${business.email}`}>{business.email}</a></div><div className="contact-block"><span>OUR SERVICE AREAS</span><p><strong>Residential Cleaning</strong><br />{serviceAreas.residential}</p><p><strong>Commercial Cleaning</strong><br />{serviceAreas.commercial}</p></div><div className="sidebar-note">Locally owned & insured<br />One-time & recurring plans</div></aside><QuoteForm configured={configured} /></div></section></>;
}
