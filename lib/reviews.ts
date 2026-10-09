export type CustomerReview = {
  id: string;
  customerName: string;
  quote: string;
};

// Only genuine, approved public reviews belong here. No reviews are approved yet.
// A future published-content query can replace this collection.
export const customerReviews: readonly CustomerReview[] = [];
