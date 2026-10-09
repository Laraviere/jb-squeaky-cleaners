import { galleryPhotos } from "./gallery";

// Public editorial selections; future publishing can replace this data source.
export const homepageContent = {
  hero: { photo: galleryPhotos.openPlan, headline: ["Cleaner Spaces.", "Healthier Lives."] },
  results: { before: galleryPhotos.kitchenBefore, after: galleryPhotos.kitchenAfter },
};
