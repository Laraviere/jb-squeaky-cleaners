export function ApplicantPrivacyNotice({
  headingLevel = 3,
}: {
  headingLevel?: 3 | 4;
}) {
  const Heading = headingLevel === 4 ? "h4" : "h3";
  return (
    <section className="applicant-privacy-notice" aria-label="Applicant Privacy Notice">
      <Heading>Applicant Privacy Notice</Heading>
      <p>
        JB Squeaky Cleaners LLC collects application information to evaluate
        employment opportunities, communicate with applicants, and contact references.
      </p>
      <p>Only authorized staff can access submitted applications.</p>
      <p>
        Unfinished applications may be saved in unencrypted browser storage on
        your device for recovery within seven days. Expired drafts are removed
        when the application is next opened.
      </p>
      <p>
        Please do not submit Social Security numbers, driver&apos;s-license numbers,
        or sensitive background screening information.
      </p>
      <p>
        For privacy questions, contact{" "}
        <a href="mailto:sales@jbsqueakycleaners.com">sales@jbsqueakycleaners.com</a>.
      </p>
    </section>
  );
}
