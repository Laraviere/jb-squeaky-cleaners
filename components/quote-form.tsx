"use client";

import { useActionState, useState } from "react";
import { submitQuote } from "@/app/request-a-quote/actions";
import { frequencies, serviceTypes, type QuoteField, type QuoteRequest, type QuoteState } from "@/lib/quote";
import { business, serviceAreas } from "@/lib/site";
import { Icon } from "./icon";

const initial: QuoteState = { status: "idle", message: "" };
const empty: QuoteRequest = { name: "", phone: "", email: "", service_type: "", location: "", frequency: "", property_size: "", preferred_timing: "", details: "" };

export function QuoteForm({ configured }: { configured: boolean }) {
  const [state, formAction, pending] = useActionState(submitQuote, initial);
  const [values, setValues] = useState(empty);
  const fieldProps = (field: QuoteField) => ({ id: field, name: field, value: values[field], required: true, "aria-invalid": !!state.errors?.[field], "aria-describedby": state.errors?.[field] ? `${field}-error` : undefined, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setValues({ ...values, [field]: e.target.value }) });
  const error = (field: QuoteField) => state.errors?.[field] && <span className="field-error" id={`${field}-error`}>{state.errors[field]}</span>;

  if (state.status === "success") return <div className="form-success" role="status"><span className="service-icon"><Icon name="check" /></span><h2>Request received.</h2><p>{state.message}</p><a href={business.phoneHref} className="text-link">Questions? Call {business.phone}</a></div>;

  return <form action={formAction} className="quote-form" aria-describedby="quote-form-note">
    <div className="form-heading"><span className="eyebrow"><span />Tell us about your space</span><h2>Start your quote request.</h2><p id="quote-form-note">All fields are required. Estimates are welcome—write “not sure” if you don’t know your property size or timing.</p></div>
    {!configured && <div className="form-notice" role="status"><strong>Online requests are not available yet.</strong><p>Please <a href={business.phoneHref}>call {business.phone}</a> or <a href={`mailto:${business.email}`}>email us</a> to request a quote. This form cannot send or save a request until online submissions are enabled.</p></div>}
    <fieldset disabled={pending}><legend className="sr-only">Your contact information and cleaning needs</legend><div className="form-grid">
      <div className="field"><label htmlFor="name">Full name</label><input {...fieldProps("name")} autoComplete="name" maxLength={100} placeholder="Your name" />{error("name")}</div>
      <div className="field"><label htmlFor="phone">Phone number</label><input {...fieldProps("phone")} type="tel" autoComplete="tel" maxLength={40} placeholder="(276) 555-0123" />{error("phone")}</div>
      <div className="field field-full"><label htmlFor="email">Email address</label><input {...fieldProps("email")} type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" />{error("email")}</div>
      <div className="field"><label htmlFor="service_type">Service type</label><select {...fieldProps("service_type")}><option value="">Choose a service</option>{serviceTypes.map(x=><option key={x}>{x}</option>)}</select>{error("service_type")}</div>
      <div className="field"><label htmlFor="frequency">Cleaning frequency</label><select {...fieldProps("frequency")}><option value="">Choose a frequency</option>{frequencies.map(x=><option key={x}>{x}</option>)}</select>{error("frequency")}</div>
      <div className="field field-full"><label htmlFor="location">Property location</label><input {...fieldProps("location")} maxLength={200} placeholder="City, state, ZIP code" aria-describedby={state.errors?.location ? "location-area-note location-error" : "location-area-note"} /><p id="location-area-note">Residential: {serviceAreas.residential}. Commercial: {serviceAreas.commercial}.</p>{error("location")}</div>
      <div className="field"><label htmlFor="property_size">Approximate property size</label><input {...fieldProps("property_size")} maxLength={100} placeholder="Sq ft, rooms, or not sure" />{error("property_size")}</div>
      <div className="field"><label htmlFor="preferred_timing">Preferred timing</label><input {...fieldProps("preferred_timing")} maxLength={200} placeholder="Date, schedule, or flexible" />{error("preferred_timing")}</div>
      <div className="field field-full"><label htmlFor="details">Cleaning details</label><textarea {...fieldProps("details")} rows={5} maxLength={4000} placeholder="Tell us about the space, its current condition, and the areas you’d like us to focus on." />{error("details")}</div>
      <div className="honeypot" aria-hidden="true"><label htmlFor="website">Leave this field empty</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
    </div></fieldset>
    {state.message && <div className="form-message" role="alert" tabIndex={-1}>{state.message}</div>}
    <div className="form-submit"><p>We’ll use your contact details to respond to your cleaning request. Submitting a request does not confirm a booking.</p><button type="submit" className="button" disabled={pending || !configured}>{pending ? "Sending request…" : "Send Quote Request"}<Icon name="arrow" /></button></div>
  </form>;
}
