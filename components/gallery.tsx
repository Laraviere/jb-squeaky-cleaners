import Image from "next/image";
import type { GalleryPhoto } from "@/lib/gallery";

export const galleryImageSizes = "(max-width: 700px) calc(100vw - 40px), (max-width: 1000px) calc((100vw - 72px) / 2), (max-width: 1228px) calc((100vw - 96px) / 3), 377px";
export const featureImageSizes = "(max-width: 700px) calc(100vw - 40px), (max-width: 1228px) calc((100vw - 128px) / 2), 550px";

export function ProjectPhoto({ photo, sizes = galleryImageSizes, eager = false, className = "" }: { photo: GalleryPhoto; sizes?: string; eager?: boolean; className?: string }) {
  return <Image src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} sizes={sizes} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} className={`photo project-photo ${className}`} />;
}

export function ProjectCard({ photo, label, pair = false }: { photo: GalleryPhoto; label?: string; pair?: boolean }) {
  const wide = !pair && photo.width > photo.height;
  const sizes = pair ? "(max-width: 700px) calc(100vw - 40px), (max-width: 1228px) calc((100vw - 72px) / 2), 578px" : wide ? "(max-width: 1000px) calc(100vw - 48px), (max-width: 1228px) calc((100vw - 72px) * 2 / 3), 779px" : galleryImageSizes;
  return <figure className={`project-card${wide ? " project-card-wide" : ""}`}>
    <ProjectPhoto photo={photo} sizes={sizes} />
    {label && <figcaption className={`project-label${label === "After" ? " project-label-after" : ""}`}>{label}</figcaption>}
  </figure>;
}
