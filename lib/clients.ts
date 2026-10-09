export type FeaturedClient = {
  id: string;
  name: string;
  service: string;
  location?: string;
  website: string;
  logo: { src: string; width: number; height: number; source: string };
};

// Owner-approved public relationships. Stable IDs and source provenance allow
// this catalog to be replaced by a future published-content query.
export const featuredClients: readonly FeaturedClient[] = [
  {
    id: "blue-ridge-bobcats",
    name: "Blue Ridge Bobcats",
    service: "Stadium & Office Cleaning",
    website: "https://www.blueridgebobcats.com/",
    logo: {
      src: "/images/clients/blue-ridge-bobcats.svg",
      width: 55,
      height: 45,
      source: "https://digitalshift-stats.us-lax-1.linodeobjects.com/0ee769f0-00cd-472b-b14c-48868386ce74/team-logo_url-282068-blue-ridge-bobcats-1692119777610507866-medium.svg",
    },
  },
  {
    id: "mount-rogers-community-services",
    name: "Mount Rogers Community Services",
    service: "Commercial Facility Cleaning",
    location: "Galax, Virginia",
    website: "https://www.mountrogers.org/",
    logo: {
      src: "/images/clients/mount-rogers-community-services.png",
      width: 404,
      height: 218,
      source: "https://www.mountrogers.org/wp-content/uploads/logo.png",
    },
  },
];
