import type { Metadata } from "next";
import { connection } from "next/server";
import { EmploymentApplication } from "@/components/employment-application";
import { PageIntro } from "@/components/sections";
import {
  applicationAvailable,
  createApplicationToken,
} from "@/lib/employment-storage";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Explore working with JB Squeaky Cleaners LLC in residential and commercial cleaning. Learn about our employment application process.",
};

export default async function Careers() {
  await connection();
  const available = await applicationAvailable();
  return (
    <div className="careers-page">
      <PageIntro
        eyebrow="Careers at JB Squeaky"
        title="Bring care to every clean."
      >
        <p>
          Thank you for your interest in working with JB Squeaky Cleaners LLC.
        </p>
      </PageIntro>
      <section className="section">
        <div className="container careers-introduction">
          <div>
            <span className="eyebrow">
              <span />
              People behind the work
            </span>
            <h2>
              Hands-on work.
              <br />
              Spaces that matter.
            </h2>
            <p>
              Our work includes residential and commercial cleaning, from
              regular cleaning plans to deep and heavy-duty projects.
            </p>
            <p>
              Tell us about your experience, availability, and the kind of work
              you’re interested in. This application is an expression of
              interest; it does not indicate a specific open position or
              guarantee employment.
            </p>
            <a href="#employment-application" className="button">
              {available ? "Apply Now" : "Application Information"}
            </a>
          </div>
          <aside className="careers-work">
            <h3>Residential & commercial cleaning</h3>
            <p>
              Cleaning homes, offices, shared spaces, and the everyday details
              that make a difference.
            </p>
            <h3>A thoughtful start</h3>
            <p>
              Share previous cleaning experience or transferable skills. The
              application has room for education, training, and your preferred
              schedule.
            </p>
            <span>Locally owned & insured</span>
          </aside>
        </div>
      </section>
      <section id="employment-application" className="section soft-section">
        <div className="container careers-application">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                <span />
                The next step
              </span>
              <h2>Your employment application.</h2>
            </div>
          </div>
          <EmploymentApplication
            available={available}
            token={available ? createApplicationToken() : ""}
          />
        </div>
      </section>
    </div>
  );
}
