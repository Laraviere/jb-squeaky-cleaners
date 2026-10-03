"use server";

import { validateQuote, type QuoteState } from "@/lib/quote";
import { getQuoteConfiguration, saveQuote } from "@/lib/quote-storage";

export async function submitQuote(_previous: QuoteState, form: FormData): Promise<QuoteState> {
  const { values, errors } = validateQuote(form);
  if (Object.keys(errors).length) return { status: "error", message: "Please check the highlighted fields. Your request has not been sent.", errors };
  if (form.get("website")) return { status: "error", message: "We couldn’t process this request. Please call (276) 235-2889." };
  if (!getQuoteConfiguration()) return { status: "error", message: "Online quote requests are not available yet. Your request has not been sent. Please call (276) 235-2889 or email sales@jbsqueakycleaners.com." };
  try {
    await saveQuote(values);
    return { status: "success", message: "Your quote request has been saved. Thank you for telling us about your space. This is a request for a quote, not a confirmed booking." };
  } catch {
    // Do not log contact information, credentials, or database response bodies.
    return { status: "error", message: "We couldn’t confirm that your request was saved. Please call (276) 235-2889 or email sales@jbsqueakycleaners.com to confirm your request before trying again." };
  }
}
