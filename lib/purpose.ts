import type { Purpose, ScanContext } from "./types";

export interface PurposeSpec {
  value: Purpose;
  label: string;
  /** One line, shown under the control so the choice is never a guess. */
  hint: string;
  /**
   * What to tell the model. This is the whole of purpose-aware redaction: the
   * same text is sensitive or not depending on where it is going.
   */
  instruction: string;
  /**
   * Whether the model may keep a span for this purpose. A general scrub keeps
   * nothing. A support ticket keeps the contact details, because the agent
   * needs them.
   */
  allowsRetention: boolean;
}

export const PURPOSES: PurposeSpec[] = [
  {
    value: "general",
    label: "GENERAL",
    hint: "Redact everything sensitive, whatever the context",
    instruction:
      "The user has not said where the text is going. Redact every span that identifies a person, a place they live or work, an organisation they are attached to, or any credential.",
    allowsRetention: false,
  },
  {
    value: "job_application",
    label: "JOB APPLICATION",
    hint: "Keep your professional identity, hide your home details",
    instruction:
      "The text is going to an assistant to review a job application. Keep the candidate's name, their job titles, their employer and their skills, because the reviewer needs them. Redact the home address, the phone number, the personal email address, the date of birth, and any identity or account number.",
    allowsRetention: true,
  },
  {
    value: "support_ticket",
    label: "SUPPORT TICKET",
    hint: "Keep the details the agent needs, hide the rest",
    instruction:
      "The text is going to a support agent. Keep the contact email address and any order, ticket or account reference, because the agent needs them to find the case. Redact the home address, payment details, and any detail about the person that is not needed to resolve the problem.",
    allowsRetention: true,
  },
  {
    value: "medical_note",
    label: "MEDICAL NOTE",
    hint: "Keep the clinical facts, hide the patient",
    instruction:
      "The text is going to a clinician, or to an assistant summarising a medical record. Keep the clinical facts: diagnoses, medication, test results, symptoms and when they started. Redact the patient's name, their address, their contact details, and any insurance or NHS number.",
    allowsRetention: true,
  },
  {
    value: "legal_contract",
    label: "LEGAL CONTRACT",
    hint: "Keep the parties and obligations, hide personal identifiers",
    instruction:
      "The text is going to an assistant reviewing a contract. Keep the party names, the obligations, the dates and the payment terms. Redact personal identifiers: signatures, home addresses, tax numbers, bank account numbers and reference numbers that identify a person.",
    allowsRetention: true,
  },
  {
    value: "public_post",
    label: "PUBLIC POST",
    hint: "Hide anything that identifies a private person",
    instruction:
      "The text is going out as a public post. Keep opinions, arguments and general statements. Redact anything that identifies a private individual: their name, where they live, where they work, their age and their family.",
    allowsRetention: false,
  },
  {
    value: "custom",
    label: "CUSTOM",
    hint: "Write your own rule",
    instruction: "",
    allowsRetention: true,
  },
];

export const DEFAULT_PURPOSE: Purpose = "general";

/**
 * The context a scan runs under when the caller did not say.
 *
 * The default is the strictest one: redact everything, and write tokens
 * rather than rewrites. A scan with no context is a scan where nothing is
 * known to be safe.
 */
export const DEFAULT_CONTEXT: ScanContext = {
  purpose: DEFAULT_PURPOSE,
  outputForm: "token",
};

export function purposeSpec(value: Purpose): PurposeSpec {
  return PURPOSES.find((purpose) => purpose.value === value) ?? PURPOSES[0];
}

/**
 * The purpose, as one paragraph for the model. The custom rule is the
 * user's own words, so it goes in the same place the built-in ones do.
 */
export function purposeInstruction(context: ScanContext): string {
  const spec = purposeSpec(context.purpose);

  if (context.purpose === "custom") {
    const note = context.purposeNote?.trim();
    return note
      ? `The user wrote this rule for this text: "${note}". Apply it exactly. Redact the spans the rule covers, and keep the spans the rule says are needed.`
      : "The user gave no rule. Redact every span that identifies a person, a place, an organisation or a credential.";
  }

  return spec.instruction;
}

export function allowsRetention(context: ScanContext): boolean {
  return purposeSpec(context.purpose).allowsRetention;
}
