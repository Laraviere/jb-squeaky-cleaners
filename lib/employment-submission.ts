import type { ApplicationState } from "./employment";

type SubmissionAction = (
  previous: ApplicationState,
  form: FormData,
) => Promise<ApplicationState>;

// Catch transport failures before React treats a rejected action as a page error.
// Do not clear entries or mint a new token: an unconfirmed request may be saved.
export function recoverableEmploymentSubmission(action: SubmissionAction) {
  return async (
    previous: ApplicationState,
    form: FormData,
  ): Promise<ApplicationState> => {
    if (previous.status === "success") return previous;
    try {
      return await action(previous, form);
    } catch {
      return {
        status: "error",
        message:
          "We couldn’t receive a submission confirmation. Your entries are still here. Please retry without changing your application. We’ll reuse the same submission token to prevent duplicate saves.",
      };
    }
  };
}
