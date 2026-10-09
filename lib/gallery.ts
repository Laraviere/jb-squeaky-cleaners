import { photos } from "./site";

export type GalleryPhoto = {
  id: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
};

// Public editorial selections only. Stable IDs and explicit dimensions make this
// catalog replaceable by a future published-content query without changing the UI.
export const galleryPhotos = {
  openPlan: { id: "residential-open-plan", src: "/images/gallery/residential/open-plan-kitchen-and-living-area.jpeg", width: 1170, height: 877, alt: "Open-plan residential kitchen and living area with clear counters and wood-look flooring", caption: "Kitchen & open-plan living" },
  windows: { id: "residential-windows", src: "/images/gallery/residential/living-area-windows-and-entry-door.jpeg", width: 1536, height: 2048, alt: "Residential living area with windows, an entry door, and clear wood-look flooring", caption: "Living area & entry" },
  woodKitchen: { id: "residential-wood-kitchen", src: "/images/gallery/residential/kitchen-wood-cabinets-white-appliances.jpeg", width: 1536, height: 2048, alt: "Residential kitchen with wood cabinets, white appliances, and clear flooring", caption: "Kitchen surfaces & appliances" },
  exit: { id: "commercial-exit", src: "/images/gallery/commercial/exit-door-gray-wood-look-floor.jpeg", width: 1170, height: 1520, alt: "Commercial exit area with a dark door and clear gray wood-look flooring", caption: "Commercial floors & exit area" },
  hallway: { id: "commercial-hallway", src: "/images/gallery/commercial/hallway-glass-exit.jpeg", width: 1536, height: 2048, alt: "Commercial hallway with wood-look flooring leading toward a glass exit door", caption: "Hallway & shared spaces" },
  restroom: { id: "commercial-restroom", src: "/images/gallery/commercial/restroom-sinks-and-mirrors.jpeg", width: 1536, height: 2048, alt: "Commercial restroom with a row of sinks, mirrors, and clear flooring", caption: "Restroom sinks & surfaces" },
  living: { id: "residential-living", src: photos.living, width: 1536, height: 2048, alt: "Finished living room looking toward the kitchen", caption: "Living room & kitchen" },
  floor: { id: "residential-floor", src: photos.floor, width: 1536, height: 2048, alt: "Clean wood flooring in a residential living room", caption: "A closer look at the floors" },
  oven: { id: "residential-oven", src: photos.oven, width: 1536, height: 2048, alt: "Oven interior and glass door after cleaning", caption: "Inside the oven" },
  bathroom: { id: "residential-bathroom", src: photos.bathroom, width: 1536, height: 2048, alt: "Bathroom with a tub, toilet, and tiled floor", caption: "Bathroom project view" },
  kitchenBefore: { id: "kitchen-before", src: photos.kitchenBefore, width: 1536, height: 2048, alt: "Kitchen before cleaning, with items on the counters and floor", caption: "The starting point" },
  kitchenAfter: { id: "kitchen-after", src: photos.kitchen, width: 1536, height: 2048, alt: "The same kitchen after cleaning, with cleared counters and clean floors", caption: "A clearer, cleaner space" },
  bedroomBed: { id: "bedroom-bed-before", src: photos.bedroomBed, width: 1536, height: 2048, alt: "Bedroom project before cleaning, viewed toward the bed with belongings throughout the room", caption: "View toward the bed" },
  bedroomEntry: { id: "bedroom-entry-before", src: photos.bedroomEntry, width: 1536, height: 2048, alt: "The same bedroom before cleaning, viewed from the entry", caption: "View from the entry" },
  crew: { id: "crew", src: photos.crew, width: 1536, height: 2048, alt: "Two JB Squeaky crew members together during a cleaning project", caption: "The crew behind the clean" },
  crewWorking: { id: "crew-working", src: photos.crewWorking, width: 1536, height: 2048, alt: "Crew members in protective clothing working inside a home", caption: "A hands-on cleaning project" },
} satisfies Record<string, GalleryPhoto>;

export type GallerySection = {
  id: string;
  title: string;
  description: string;
  photos: readonly GalleryPhoto[];
  layout: "grid" | "pair";
  labels?: readonly string[];
};

export const gallerySections: readonly GallerySection[] = [
  { id: "residential", title: "Residential spaces", description: "Kitchens, living areas, and the details from our residential cleaning projects.", photos: [galleryPhotos.openPlan, galleryPhotos.windows, galleryPhotos.woodKitchen, galleryPhotos.living, galleryPhotos.floor, galleryPhotos.oven, galleryPhotos.bathroom], layout: "grid" },
  { id: "commercial", title: "Commercial spaces", description: "Floors, hallways, and restroom surfaces from our commercial cleaning work.", photos: [galleryPhotos.exit, galleryPhotos.hallway, galleryPhotos.restroom], layout: "grid" },
  // Only this existing, supported kitchen transformation is a before/after pair.
  { id: "before-after", title: "A kitchen reset", description: "Two views of the same kitchen, before and after cleaning. Every space has a starting point; we show the change without judgment.", photos: [galleryPhotos.kitchenBefore, galleryPhotos.kitchenAfter], layout: "pair", labels: ["Before", "After"] },
  { id: "starting-points", title: "Understanding the starting point", description: "Two before views from a bedroom project. There is no matching finished-bedroom photo in this collection.", photos: [galleryPhotos.bedroomBed, galleryPhotos.bedroomEntry], layout: "pair", labels: ["Before", "Before"] },
  { id: "team", title: "Our team at work", description: "The people behind the cleaning, photographed during a project.", photos: [galleryPhotos.crew, galleryPhotos.crewWorking], layout: "pair" },
];
