import type { Metadata } from "next";
import { PageIntro, ContactBanner } from "@/components/sections";
import { ProjectCard } from "@/components/gallery";
import { gallerySections } from "@/lib/gallery";

export const metadata: Metadata = { title: "Our Work", description: "Explore real residential and commercial cleaning photos from JB Squeaky Cleaners, including finished spaces, a kitchen before and after, and our team at work." };

export default function Gallery() {
  return <>
    <PageIntro eyebrow="Our work" title="Real spaces. A fresh perspective."><p>A look at our residential and commercial work, from finished rooms to the details that make a difference.</p></PageIntro>
    <div className="container gallery-navigation"><nav aria-label="Gallery categories">{gallerySections.map(section => <a key={section.id} href={`#${section.id}`}>{section.id === "before-after" ? "Before & after" : section.title}</a>)}</nav></div>
    {gallerySections.map((section, index) => <section id={section.id} key={section.id} className={`section gallery-section${index % 2 ? " soft-section" : ""}`} aria-labelledby={`${section.id}-title`}>
      <div className="container">
        <div className="section-heading"><div><span className="eyebrow"><span />{section.layout === "pair" ? "A closer look" : "Real cleaning projects"}</span><h2 id={`${section.id}-title`}>{section.title}</h2></div><p>{section.description}</p></div>
        <div className={section.layout === "pair" ? "project-pair" : "project-grid"}>{section.photos.map((photo, photoIndex) => <ProjectCard key={photo.id} photo={photo} label={section.labels?.[photoIndex]} pair={section.layout === "pair"} />)}</div>
      </div>
    </section>)}
    <ContactBanner />
  </>;
}
