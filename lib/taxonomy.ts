import type { Severity } from "./types";

export interface TypeDescription {
  label: string;
  severity: Severity;
}

/** type code, label, severity. */
const TABLE: [string, string, Severity][] = [
  ["AWS_ACCESS_KEY", "AWS ACCESS KEY", "critical"],
  ["AWS_SECRET_ACCESS_KEY", "AWS SECRET", "critical"],
  ["GOOGLE_API_KEY", "GOOGLE API KEY", "critical"],
  ["GITHUB_TOKEN", "GITHUB TOKEN", "critical"],
  ["SLACK_TOKEN", "SLACK TOKEN", "critical"],
  ["STRIPE_SECRET_KEY", "STRIPE KEY", "critical"],
  ["OPENAI_API_KEY", "OPENAI API KEY", "critical"],
  ["ANTHROPIC_API_KEY", "ANTHROPIC API KEY", "critical"],
  ["PRIVATE_KEY", "PRIVATE KEY", "critical"],
  ["JWT", "JSON WEB TOKEN", "critical"],
  ["SENDGRID_API_KEY", "SENDGRID KEY", "critical"],
  ["SLACK_WEBHOOK", "SLACK WEBHOOK", "critical"],
  ["NPM_TOKEN", "NPM TOKEN", "critical"],
  ["TWILIO_ACCOUNT_SID", "TWILIO SID", "critical"],
  ["API_KEY", "API KEY", "critical"],
  ["PASSWORD", "PASSWORD", "critical"],
  ["CREDIT_CARD", "CARD NUMBER", "high"],
  ["IBAN", "IBAN", "high"],
  ["EMAIL", "EMAIL", "high"],
  ["PHONE", "PHONE", "high"],
  ["PERSON", "PERSON", "high"],
  ["DATE_OF_BIRTH", "DATE OF BIRTH", "high"],
  ["HOME_ADDRESS", "ADDRESS", "high"],
  ["EMPLOYER", "EMPLOYER", "low"],
  ["LOCATION", "LOCATION", "low"],
  ["IP_ADDRESS", "IP ADDRESS", "low"],
  ["MAC_ADDRESS", "MAC ADDRESS", "low"],
  ["ACCOUNT_NUMBER", "ACCOUNT NUMBER", "low"],
];

export const TAXONOMY: Record<string, TypeDescription> = Object.fromEntries(
  TABLE.map(([code, label, severity]) => [code, { label, severity }])
);

/**
 * Unknown types are accepted and labelled generically rather than discarded.
 * A missed name is worse than a vaguely labelled one.
 */
export function describeType(type: string): TypeDescription {
  const found = TAXONOMY[type];
  if (found) return found;
  return { label: type.replace(/_/g, " "), severity: "low" };
}
