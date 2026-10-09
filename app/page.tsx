import Link from "next/link";
import { ClientShowcase } from "@/components/clients";
import { Icon } from "@/components/icon";
import { Photo, QuoteLink } from "@/components/sections";
import { ProjectPhoto } from "@/components/gallery";
import { galleryPhotos } from "@/lib/gallery";
import Image from "next/image";
import { homepageContent } from "@/lib/home";
import { CustomerReviews } from "@/components/reviews";
import { business, photos, serviceAreas } from "@/lib/site";

export default function Home() {
  const { hero, results } = homepageContent;
  return <div className="premium-home">
    <section className="premium-hero" aria-labelledby="hero-heading">
      <Image src={hero.photo.src} alt={hero.photo.alt} width={hero.photo.width} height={hero.photo.height} sizes="100vw" preload className="premium-hero-photo" />
      <div className="premium-hero-shade" aria-hidden="true" />
      <div className="container premium-hero-content">
        <span className="eyebrow light"><span />JB Squeaky Cleaners LLC</span>
        <h1 id="hero-heading">{hero.headline[0]}<br /><span>{hero.headline[1]}</span></h1>
        <p className="premium-hero-intro">Residential and commercial cleaning, with care for the spaces where you live and work.</p>
        <div className="premium-service-areas"><p><strong>Residential Cleaning</strong>{serviceAreas.residential}</p><p><strong>Commercial Cleaning</strong>{serviceAreas.commercial}</p></div>
        <div className="premium-hero-actions"><QuoteLink /><Link href="#our-services" className="button premium-secondary">Our Services <Icon name="arrow" /></Link></div>
        <ul className="premium-highlights">{["Locally Owned", "Insured", "Recurring Plans"].map(highlight => <li key={highlight}><Icon name="check" />{highlight}</li>)}</ul>
      </div>
    </section>
    <section id="our-services" className="section home-services"><div className="container"><div className="section-heading"><div><span className="eyebrow"><span />Cleaning that fits your life</span><h2>A fresh start for<br />every kind of space.</h2></div><p>One-time visits, recurring plans, or a bigger reset. Tell us your town or ZIP code and what your space needs, and we’ll talk through a plan.</p></div>
      <div className="service-cards"><Link href="/residential" className="service-card"><div className="card-photo"><Photo src={photos.kitchen} alt="Clean kitchen with wood cabinets, clear counters, and finished floors" /><span className="photo-index">01 / AT HOME</span></div><div className="service-card-body"><span className="service-icon"><Icon name="house" /></span><h3>Residential cleaning</h3><p>More room to enjoy your home. One-time visits and recurring plans for your everyday spaces.</p><p>{serviceAreas.residential}</p><span className="card-link">Explore residential <Icon name="arrow" /></span></div></Link>
      <Link href="/commercial" className="service-card service-card-navy"><div className="card-photo"><ProjectPhoto photo={galleryPhotos.exit} sizes="(max-width: 700px) calc(100vw - 40px), (max-width: 1100px) calc((100vw - 72px) / 2), 270px" /></div><div className="service-card-body"><span className="service-icon"><Icon name="building" /></span><h3>Commercial cleaning</h3><p>A cleaning plan built around your workspace, your priorities, and your schedule.</p><p>{serviceAreas.commercial}</p><span className="card-link">Explore commercial <Icon name="arrow" /></span></div></Link></div>
    </div></section>
    <section className="section home-results" aria-labelledby="results-heading"><div className="container home-results-grid">
      <div className="home-results-copy"><span className="eyebrow"><span />Real spaces. Real change.</span><h2 id="results-heading">More Than Clean.<br />A Noticeable Difference.</h2><p>A closer look at the same kitchen, before and after cleaning. A clear view of the difference, without judgment about where it started.</p><p>Some spaces need more than an everyday reset. Deep and detailed cleaning can focus on kitchen buildup, overlooked surfaces, and the areas that need extra attention. We also offer heavy-duty cleaning; share the condition of your space so we can discuss the right scope.</p><Link href="/gallery" className="button">View Our Work <Icon name="arrow" /></Link></div>
      <div className="home-results-photos">{[{photo:results.before,label:"Before"},{photo:results.after,label:"After"}].map(({photo,label}) => <figure key={photo.id}><ProjectPhoto photo={photo} sizes="(max-width: 700px) calc(100vw - 40px), (max-width: 1000px) calc((100vw - 72px) / 2), 330px" /><figcaption className={`home-result-label${label === "After" ? " is-after" : ""}`}>{label}</figcaption></figure>)}</div>
    </div></section>
    <ClientShowcase />
    <CustomerReviews />
    <section className="section home-final-cta" aria-labelledby="final-cta-heading"><div className="container home-final-inner"><div><span className="eyebrow light"><span />Let’s make room for clean</span><h2 id="final-cta-heading">Ready for a cleaner,<br />healthier space?</h2><p>Tell us about your home or business. We’ll discuss your priorities, the scope, and a cleaning plan that works for you.</p></div><div className="home-final-actions"><QuoteLink /><a href={business.phoneHref}>Call {business.phone}</a><a href={`mailto:${business.email}`}>{business.email}</a></div></div></section>
  </div>;
}
