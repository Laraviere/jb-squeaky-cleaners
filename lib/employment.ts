export type ApplicationField = {
  id: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "tel"
    | "date"
    | "time"
    | "number"
    | "textarea"
    | "select"
    | "checks";
  required?: boolean;
  options?: readonly string[];
  maxLength?: number;
  autoComplete?: string;
};
const yesNo = ["Yes", "No"] as const;
export const experienceCategories = [
  "Residential Cleaning",
  "Commercial Cleaning",
  "Office Cleaning",
  "Deep Cleaning",
  "Move-In/Move-Out Cleaning",
  "Restroom Cleaning",
  "Floor Care",
  "Carpet Cleaning",
  "Window Cleaning",
  "Disinfection/Sanitizing",
  "Laundry",
  "Customer Service",
  "Cleaning Chemicals",
  "Other",
] as const;
export const applicationSteps = [
  {
    title: "Personal information",
    group: "applicant",
    fields: [
      {
        id: "full_name",
        label: "Full name",
        required: true,
        autoComplete: "name",
      },
      {
        id: "address",
        label: "Address",
        required: true,
        autoComplete: "street-address",
        maxLength: 250,
      },
      {
        id: "city",
        label: "City",
        required: true,
        autoComplete: "address-level2",
      },
      {
        id: "state",
        label: "State",
        required: true,
        autoComplete: "address-level1",
      },
      {
        id: "zip",
        label: "ZIP code",
        required: true,
        autoComplete: "postal-code",
      },
      {
        id: "phone",
        label: "Phone",
        type: "tel",
        required: true,
        autoComplete: "tel",
      },
      {
        id: "email",
        label: "Email",
        type: "email",
        required: true,
        autoComplete: "email",
        maxLength: 254,
      },
      { id: "position", label: "Position applied for", required: true },
      {
        id: "available_date",
        label: "Date available",
        type: "date",
        required: true,
      },
      { id: "desired_pay", label: "Desired pay rate ($)", type: "number" },
      {
        id: "pay_period",
        label: "Pay period",
        type: "select",
        options: ["Hour", "Week", "Month", "Year"],
      },
      {
        id: "employment_preference",
        label: "Employment preference",
        type: "checks",
        required: true,
        options: ["Full-time", "Part-time", "Temporary/Seasonal"],
      },
      {
        id: "work_authorization",
        label: "Legally authorized to work in the United States?",
        type: "select",
        required: true,
        options: yesNo,
      },
      {
        id: "sponsorship",
        label: "Will you require sponsorship now or in the future?",
        type: "select",
        required: true,
        options: yesNo,
      },
    ],
  },
  {
    title: "Availability",
    group: "availability",
    fields: [
      {
        id: "days",
        label: "Preferred work days",
        type: "checks",
        required: true,
        options: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
      },
      {
        id: "earliest_time",
        label: "Earliest time available",
        type: "time",
        required: true,
      },
      {
        id: "latest_time",
        label: "Latest time available",
        type: "time",
        required: true,
      },
      {
        id: "weekends",
        label: "Willing to work weekends?",
        type: "select",
        required: true,
        options: yesNo,
      },
      {
        id: "evenings",
        label: "Willing to work evenings?",
        type: "select",
        required: true,
        options: yesNo,
      },
      {
        id: "overtime",
        label: "Willing to work overtime when needed?",
        type: "select",
        required: true,
        options: yesNo,
      },
    ],
  },
  {
    title: "Education",
    group: "education",
    fields: [
      { id: "high_school", label: "High school" },
      { id: "graduated", label: "Graduated?", type: "select", options: yesNo },
      { id: "college", label: "College / trade school" },
      { id: "degree", label: "Degree / certificate" },
      {
        id: "training",
        label: "Other training / certifications",
        type: "textarea",
        maxLength: 2000,
      },
    ],
  },
  { title: "Employment history", group: "employment_history", fields: [] },
  {
    title: "Cleaning experience",
    group: "experience",
    fields: [
      {
        id: "experience_categories",
        label: "Check all areas in which you have experience",
        type: "checks",
        options: experienceCategories,
      },
      {
        id: "other_experience",
        label: "Other experience",
        type: "textarea",
        maxLength: 1000,
      },
      {
        id: "years_experience",
        label: "Years of cleaning experience",
        type: "number",
        required: true,
      },
      {
        id: "skills",
        label: "Relevant experience, skills, or certifications",
        type: "textarea",
        maxLength: 3000,
      },
    ],
  },
  {
    title: "Transportation",
    group: "transportation",
    fields: [
      {
        id: "valid_license",
        label: "Valid driver’s license?",
        type: "select",
        required: true,
        options: yesNo,
      },
      {
        id: "transportation",
        label: "Reliable transportation to / from work?",
        type: "select",
        required: true,
        options: yesNo,
      },
      {
        id: "driving_duties",
        label: "Interested in driving-related duties?",
        type: "select",
        required: true,
        options: yesNo,
      },
    ],
  },
  { title: "References", group: "references", fields: [] },
  { title: "Review & certification", group: "certification", fields: [] },
] satisfies { title: string; group: string; fields: ApplicationField[] }[];
export const employerFields: readonly ApplicationField[] = [
  { id: "name", label: "Employer", required: true },
  { id: "address", label: "Address", maxLength: 250 },
  { id: "phone", label: "Phone", type: "tel" },
  { id: "supervisor", label: "Supervisor" },
  { id: "position", label: "Position / title", required: true },
  { id: "from", label: "Employment dates: from (YYYY-MM)", required: true },
  {
    id: "to",
    label: "Employment dates: to (YYYY-MM or Present)",
    required: true,
  },
  { id: "reason", label: "Reason for leaving", maxLength: 1000 },
];
export const referenceFields: readonly ApplicationField[] = [
  { id: "name", label: "Name", required: true },
  { id: "relationship", label: "Relationship", required: true },
  { id: "phone", label: "Phone", type: "tel", required: true },
  { id: "email", label: "Email", type: "email", maxLength: 254 },
];
export const certificationVersion = "employment-pdf-2026-10-v1";
export const certificationText =
  "I certify that the information provided in this application is true and complete to the best of my knowledge. I understand that any material misrepresentation, omission, or falsification may result in disqualification from employment or termination of employment. I understand that completion of this application does not guarantee employment. If employed, I agree to follow JB Squeaky Cleaners LLC policies, procedures, safety requirements, and instructions. Where permitted by applicable law, I understand that employment may be subject to applicable employment terms and conditions communicated by the company.";
export type ApplicationDraft = {
  answers: Record<string, string | string[]>;
  employers: Record<string, string>[];
  references: Record<string, string>[];
  accepted: boolean;
  acknowledgment: string;
};
export type ApplicationErrors = Record<string, string>;
export type ApplicationState = {
  status: "idle" | "error" | "success";
  message: string;
  errors?: ApplicationErrors;
  applicationId?: string;
};
export const emptyApplication = (): ApplicationDraft => ({
  answers: {},
  employers: [],
  references: [{}, {}],
  accepted: false,
  acknowledgment: "",
});
const plainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const validEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const validPhone = (s: string) =>
  /^[+\d\s().-]+$/.test(s) &&
  s.replace(/\D/g, "").length >= 10 &&
  s.replace(/\D/g, "").length <= 15;
const month = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const validTime = (s: unknown): s is string =>
  typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export function isOvernightAvailability(
  answers: Record<string, string | string[]>,
) {
  return (
    validTime(answers.earliest_time) &&
    validTime(answers.latest_time) &&
    answers.latest_time < answers.earliest_time
  );
}

export function validateApplication(input: unknown, step?: number) {
  const errors: ApplicationErrors = {};
  const draft = emptyApplication();
  const raw = plainObject(input) ? input : {};
  const answers = plainObject(raw.answers) ? raw.answers : {};
  const check = (
    fields: readonly ApplicationField[],
    source: Record<string, unknown>,
    target: Record<string, string | string[]>,
    prefix = "",
  ) => {
    for (const field of fields) {
      const key = prefix + field.id;
      const value = source[field.id];
      if (field.type === "checks") {
        const selections = Array.isArray(value) ? value : [];
        target[field.id] = [
          ...new Set(
            selections.filter(
              (x): x is string =>
                typeof x === "string" && !!field.options?.includes(x),
            ),
          ),
        ];
        if (
          (value !== undefined && !Array.isArray(value)) ||
          selections.some(
            (x) => typeof x !== "string" || !field.options?.includes(x),
          )
        )
          errors[key] = "Choose only the listed options.";
        if (field.required && !target[field.id].length)
          errors[key] = "Choose at least one option.";
        continue;
      }
      const text = typeof value === "string" ? value.trim() : "";
      target[field.id] = text;
      if (value !== undefined && typeof value !== "string")
        errors[key] = "Enter a valid answer.";
      if (field.required && !text) errors[key] = "Please complete this field.";
      if (text.length > (field.maxLength ?? 150))
        errors[key] = `Use ${field.maxLength ?? 150} characters or fewer.`;
      if (!text) continue;
      if (field.type === "select" && !field.options?.includes(text))
        errors[key] = "Choose a listed answer.";
      if (field.type === "email" && !validEmail(text))
        errors[key] = "Enter a valid email address.";
      if (field.type === "tel" && !validPhone(text))
        errors[key] = "Enter a valid phone number with area code.";
      if (
        field.type === "date" &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(text) ||
          !Number.isFinite(Date.parse(text)) ||
          new Date(text).toISOString().slice(0, 10) !== text)
      )
        errors[key] = "Enter a valid date.";
      if (field.type === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(text))
        errors[key] = "Enter a valid time.";
      if (
        field.type === "number" &&
        (!/^\d+(\.\d{1,2})?$/.test(text) ||
          Number(text) > (field.id === "years_experience" ? 99 : 100000))
      )
        errors[key] = "Enter a valid non-negative number.";
      if (field.id === "zip" && !/^\d{5}(-\d{4})?$/.test(text))
        errors[key] = "Enter a five-digit ZIP or ZIP+4.";
    }
  };
  applicationSteps.forEach((s, i) => {
    if (step === undefined || step === i)
      check(s.fields, answers, draft.answers);
  });
  if (step === undefined || step === 0) {
    if (draft.answers.desired_pay && !draft.answers.pay_period)
      errors.pay_period = "Choose a pay period.";
    if (draft.answers.pay_period && !draft.answers.desired_pay)
      errors.desired_pay = "Enter your desired pay rate.";
  }
  if (step === undefined || step === 1) {
    if (
      validTime(draft.answers.earliest_time) &&
      draft.answers.earliest_time === draft.answers.latest_time
    )
      errors.latest_time =
        "Choose a different latest time. For overnight availability, choose an end time earlier than your start time.";
  }
  if (step === undefined || step === 4) {
    if (
      (draft.answers.experience_categories as string[]).includes("Other") &&
      !draft.answers.other_experience
    )
      errors.other_experience = "Describe your other experience.";
  }
  if (step === undefined || step === 3) {
    if (!Array.isArray(raw.employers) || raw.employers.length > 3)
      errors.employers = "Include up to three employers.";
    else
      draft.employers = raw.employers.map((row, i) => {
        const target: Record<string, string> = {};
        check(
          employerFields,
          plainObject(row) ? row : {},
          target,
          `employers.${i}.`,
        );
        if (!month(target.from)) errors[`employers.${i}.from`] = "Use YYYY-MM.";
        else if (target.from > new Date().toISOString().slice(0, 7))
          errors[`employers.${i}.from`] =
            "Employment start date cannot be in the future.";
        if (!month(target.to) && target.to.toLowerCase() !== "present")
          errors[`employers.${i}.to`] = "Use YYYY-MM or Present.";
        if (month(target.from) && month(target.to) && target.from > target.to)
          errors[`employers.${i}.to`] = "The end must be after the start.";
        return target;
      });
  }
  if (step === undefined || step === 6) {
    if (!Array.isArray(raw.references) || raw.references.length !== 2)
      errors.references = "Provide two references.";
    else
      draft.references = raw.references.map((row, i) => {
        const target: Record<string, string> = {};
        check(
          referenceFields,
          plainObject(row) ? row : {},
          target,
          `references.${i}.`,
        );
        return target;
      });
  }
  draft.accepted = raw.accepted === true;
  draft.acknowledgment =
    typeof raw.acknowledgment === "string" ? raw.acknowledgment.trim() : "";
  if (step === undefined || step === 7) {
    if (!draft.accepted)
      errors.accepted = "Acknowledge the applicant certification.";
    if (!draft.acknowledgment || draft.acknowledgment.length > 150)
      errors.acknowledgment = "Type your full applicant name.";
    else if (
      draft.acknowledgment.toLowerCase().replace(/\s+/g, " ") !==
      (typeof answers.full_name === "string"
        ? answers.full_name.trim().toLowerCase().replace(/\s+/g, " ")
        : "")
    )
      errors.acknowledgment =
        "Use the same full name as your personal information.";
  }
  return { draft, errors };
}

export function applicationPayload(draft: ApplicationDraft) {
  const payload: Record<string, unknown> = {};
  for (const step of applicationSteps.slice(0, 7)) {
    payload[step.group] = Object.fromEntries(
      step.fields.map((field) => [field.id, draft.answers[field.id]]),
    );
  }
  payload.employment_history = draft.employers;
  payload.references = draft.references;
  payload.certification = {
    accepted: true,
    applicant_name: draft.acknowledgment,
    version: certificationVersion,
    text: certificationText,
  };
  return payload;
}
