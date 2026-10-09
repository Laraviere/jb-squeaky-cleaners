import { business } from "@/lib/site";
import { customerReviews } from "@/lib/reviews";

export function CustomerReviews() {
  return <section className="section home-reviews" aria-labelledby="reviews-heading"><div className="container">
    <div className="section-heading"><div><span className="eyebrow"><span />Your experience matters</span><h2 id="reviews-heading">Real Reviews. Real Results.</h2></div></div>
    {customerReviews.length ? <div className="home-review-grid">{customerReviews.map(review => <figure key={review.id}><blockquote><p>{review.quote}</p></blockquote><figcaption>{review.customerName}</figcaption></figure>)}</div> : <div className="home-review-empty"><div><h3>Have we cleaned your space?</h3><p>We’d love to hear about your experience. Share your feedback with us by phone or email.</p></div><div className="home-feedback-links"><a href={`mailto:${business.email}`} className="text-link">Email your feedback</a><a href={business.phoneHref} className="text-link">Call {business.phone}</a></div></div>}
  </div></section>;
}
