export const serviceTypes = ["Residential", "Commercial", "Deep cleaning", "Heavy-duty cleaning", "Not sure yet"] as const;
export const frequencies = ["One-time", "Weekly", "Every other week", "Monthly", "Other / not sure"] as const;

export type QuoteRequest = {
  name: string;
  phone: string;
  email: string;
  service_type: string;
  location: string;
  frequency: string;
  property_size: string;
  preferred_timing: string;
  details: string;
};
export type QuoteField = keyof QuoteRequest;
export type QuoteState = { status: "idle" | "error" | "success"; message: string; errors?: Partial<Record<QuoteField, string>> };

const limits: Record<QuoteField, number> = { name: 100, phone: 40, email: 254, service_type: 40, location: 200, frequency: 40, property_size: 100, preferred_timing: 200, details: 4000 };

export function validateQuote(form: FormData): { values: QuoteRequest; errors: Partial<Record<QuoteField, string>> } {
  const values = {} as QuoteRequest;
  const errors: Partial<Record<QuoteField, string>> = {};
  for (const field of Object.keys(limits) as QuoteField[]) {
    const raw = form.get(field);
    values[field] = typeof raw === "string" ? raw.trim() : "";
    if (!values[field]) errors[field] = "Please complete this field.";
    else if (values[field].length > limits[field]) errors[field] = `Please use ${limits[field]} characters or fewer.`;
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = "Enter a valid email address.";
  if (values.phone && (values.phone.replace(/\D/g, "").length < 7 || !/^[+\d\s().-]+$/.test(values.phone))) errors.phone = "Enter a phone number we can reach you at.";
  if (!(serviceTypes as readonly string[]).includes(values.service_type)) errors.service_type = "Choose a service type.";
  if (!(frequencies as readonly string[]).includes(values.frequency)) errors.frequency = "Choose a cleaning frequency.";
  return { values, errors };
}
