const phoneNumbers = [
  { label: "Primary", number: "(276) 235-2889", href: "tel:+12762352889" },
  { label: "Secondary", number: "(276) 235-2887", href: "tel:+12762352887" },
] as const;

export const business = {
  name: "JB Squeaky Cleaners",
  phone: phoneNumbers[0].number,
  phoneHref: phoneNumbers[0].href,
  phones: phoneNumbers,
  email: "sales@jbsqueakycleaners.com",
  area: "Residential: Southwest VA & Northwest NC · Commercial: all VA & NC",
};

export const navigation = [
  { href: "/", label: "Home" },
  { href: "/residential", label: "Residential" },
  { href: "/commercial", label: "Commercial" },
  { href: "/careers", label: "Careers" },
  { href: "/gallery", label: "Gallery" },
  { href: "/about", label: "About" },
];

export const photos = {
  living: "/images/jb-squeaky-living-room-kitchen-after.jpeg",
  floor: "/images/jb-squeaky-living-room-after-floor-view.jpeg",
  kitchen: "/images/jb-squeaky-kitchen-after.jpeg",
  kitchenBefore: "/images/jb-squeaky-kitchen-before.jpeg",
  oven: "/images/jb-squeaky-oven-interior-after.jpeg",
  bathroom: "/images/jb-squeaky-bathroom.jpeg",
  bedroomBed: "/images/jb-squeaky-bedroom-before-bed-view.jpeg",
  bedroomEntry: "/images/jb-squeaky-bedroom-before-entry-view.jpeg",
  crew: "/images/jb-squeaky-cleaning-crew-selfie.jpeg",
  crewWorking: "/images/jb-squeaky-cleaning-crew-protective-suits.jpeg",
};

export const serviceAreas = {
  residential: "Serving Southwest Virginia & Northwest North Carolina",
  commercial: "Serving all of Virginia & North Carolina",
  description: "Residential cleaning in Southwest Virginia & Northwest North Carolina. Commercial cleaning serving all of Virginia & North Carolina.",
};
