"use server";

import { validateApplication, type ApplicationState } from "@/lib/employment";
import {
  applicationAvailable,
  verifyApplicationToken,
  saveApplication,
} from "@/lib/employment-storage";

export async function submitApplication(
  _previous: ApplicationState,
  form: FormData,
): Promise<ApplicationState> {
  if (!(await applicationAvailable()))
    return {
      status: "error",
      message:
        "Online applications are currently unavailable. Your application has not been submitted.",
    };
  const token = form.get("application_token");
  const id = typeof token === "string" ? verifyApplicationToken(token) : null;
  if (!id || form.get("website"))
    return {
      status: "error",
      message:
        "We couldn’t process this application. If you have kept this page open for more than a day, refresh it and start again.",
    };
  const raw = form.get("application");
  if (typeof raw !== "string" || raw.length > 50000)
    return {
      status: "error",
      message: "Please check your application. It has not been submitted.",
    };
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return {
      status: "error",
      message: "Please check your application. It has not been submitted.",
    };
  }
  const { draft, errors } = validateApplication(input);
  if (Object.keys(errors).length)
    return {
      status: "error",
      message:
        "Please correct the highlighted fields. Your application has not been submitted.",
      errors,
    };
  try {
    const applicationId = await saveApplication(draft, id);
    return {
      status: "success",
      message:
        "Your application has been saved. Thank you for your interest in JB Squeaky Cleaners. Submitting an application does not guarantee employment.",
      applicationId,
    };
  } catch {
    // Never log applicant information, secrets, or Supabase response bodies.
    return {
      status: "error",
      message:
        "We couldn’t confirm that your application was saved. Your entries remain on this page. Please try again later or contact us before submitting again.",
    };
  }
}
