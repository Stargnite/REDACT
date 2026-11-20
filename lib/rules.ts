import type { Severity } from "./types";

export interface Rule {
  /** Stable machine code. Doubles as the mask token suffix. */
  type: string;
  label: string;
  severity: Severity;
  /** Must carry the global flag. */
  pattern: RegExp;
  /**
   * Which capture group holds the secret. Defaults to 0, the whole match.
   * Used when the match includes surrounding context that is not the secret.
   */
  group?: number;
  /**
   * Optional validator run against the matched text. Returning false drops
   * the match. This is how the noisy patterns stay honest: sixteen digits are
   * only a card number if they pass Luhn.
   */
  validate?: (text: string) => boolean;
}

/**
 * The deterministic tier. Patterns run first, in microseconds, with no model
 * and no network. They are the floor of the product: even if the model tier
 * is unavailable, a live AWS key still gets caught.
 *
 * Every pattern here is deliberately conservative. A scanner that cries wolf
 * on every five-digit number is worse than one that misses a phone number,
 * because the user stops believing it.
 *
 * Patterns avoid escape sequences: word boundaries are expressed as
 * lookarounds, and dot as a literal character class. That keeps them
 * greppable and copy-pasteable into any regex engine.
 */
export const RULES: Rule[] = [
  // --------------------------------------------------------------- critical
  {
    type: "AWS_ACCESS_KEY",
    label: "AWS ACCESS KEY",
    severity: "critical",
    pattern: new RegExp(
      "(?<![0-9A-Za-z_])(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}(?![0-9A-Za-z_])",
      "g"
    ),
  },
  {
    type: "AWS_SECRET_ACCESS_KEY",
    label: "AWS SECRET",
    severity: "critical",
    pattern: new RegExp(
      "aws_secret_access_key[^A-Za-z0-9]{0,4}([A-Za-z0-9/+=]{40})",
      "gi"
    ),
    group: 1,
  },
  {
    type: "GOOGLE_API_KEY",
    label: "GOOGLE API KEY",
    severity: "critical",
    pattern: new RegExp(
      "(?<![0-9A-Za-z_-])AIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])",
      "g"
    ),
  },
  {
    type: "GITHUB_TOKEN",
    label: "GITHUB TOKEN",
    severity: "critical",
    pattern: new RegExp(
      "(?<![0-9A-Za-z_])gh[pousr]_[0-9A-Za-z]{36,255}(?![0-9A-Za-z])",
      "g"
    ),
  },
  {
    type: "SLACK_TOKEN",
    label: "SLACK TOKEN",
    severity: "critical",
    pattern: new RegExp(
      "(?<![0-9A-Za-z])xox[baprs]-[0-9A-Za-z-]{10,72}(?![0-9A-Za-z-])",
      "g"
    ),
  },
  {
    type: "STRIPE_SECRET_KEY",
    label: "STRIPE KEY",
    severity: "critical",
    pattern: new RegExp(
      "(?<![0-9A-Za-z_])[sr]k_(?:live|test)_[0-9A-Za-z]{16,99}(?![0-9A-Za-z])",
      "g"
    ),
  },
  {
    type: "OPENAI_API_KEY",
    label: "OPENAI API KEY",
    severity: "critical",
    pattern: new RegExp(
      "(?<![0-9A-Za-z_])sk-(?:proj-)?[0-9A-Za-z_-]{32,}(?![0-9A-Za-z])",
      "g"
    ),
  },
  {
    type: "ANTHROPIC_API_KEY",
    label: "ANTHROPIC API KEY",
    severity: "critical",
    pattern: new RegExp(
      "(?<![0-9A-Za-z_])sk-ant-[0-9A-Za-z_-]{80,}(?![0-9A-Za-z])",
      "g"
    ),
  },
  {
    type: "PRIVATE_KEY",
    label: "PRIVATE KEY",
    severity: "critical",
    pattern: new RegExp(
      "-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----[^]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----",
      "g"
    ),
  },
  {
    type: "JWT",
    label: "JSON WEB TOKEN",
    severity: "critical",
    pattern: new RegExp(
      "(?<![0-9A-Za-z_-])eyJ[0-9A-Za-z_-]{8,}[.][0-9A-Za-z_-]{8,}[.][0-9A-Za-z_-]{8,}(?![0-9A-Za-z_-])",
      "g"
    ),
  },
  {
    type: "SENDGRID_API_KEY",
    label: "SENDGRID KEY",
    severity: "critical",
    pattern: new RegExp(
      "(?<![0-9A-Za-z])SG[.][0-9A-Za-z_-]{16,32}[.][0-9A-Za-z_-]{16,64}(?![0-9A-Za-z])",
      "g"
    ),
  },
  {
    type: "SLACK_WEBHOOK",
    label: "SLACK WEBHOOK",
    severity: "critical",
    pattern: new RegExp(
      "https://hooks[.]slack[.]com/services/[0-9A-Za-z+/]{20,}",
      "g"
    ),
  },
  {
    type: "NPM_TOKEN",
    label: "NPM TOKEN",
    severity: "critical",
    pattern: new RegExp(
      "(?<![0-9A-Za-z_])npm_[0-9A-Za-z]{36}(?![0-9A-Za-z])",
      "g"
    ),
  },
  {
    type: "TWILIO_ACCOUNT_SID",
    label: "TWILIO SID",
    severity: "critical",
    pattern: new RegExp(
      "(?<![0-9A-Za-z])AC[a-f0-9]{32}(?![0-9A-Za-z])",
      "g"
    ),
  },

  // ------------------------------------------------------------------- high
  {
    type: "EMAIL",
    label: "EMAIL",
    severity: "high",
    pattern: new RegExp(
      "(?<![0-9A-Za-z._%+-])[0-9A-Za-z._%+-]{1,64}@[0-9A-Za-z-]{1,63}(?:[.][0-9A-Za-z-]{1,63})*[.][A-Za-z]{2,24}(?![0-9A-Za-z-])",
      "g"
    ),
  },
  {
    type: "PHONE",
    label: "PHONE",
    severity: "high",
    pattern: new RegExp(
      "(?<![0-9])[+][0-9]{1,3}[ .-]?(?:[0-9]{2,4}[ .-]?){1,4}[0-9]{2,4}(?![0-9])",
      "g"
    ),
  },
  {
    type: "PHONE",
    label: "PHONE",
    severity: "high",
    pattern: new RegExp(
      "(?:phone|tel|telephone|mobile|cell|whatsapp)[^0-9A-Za-z]{0,4}([+0-9][0-9 ().+-]{7,18}[0-9])",
      "gi"
    ),
    group: 1,
  },
  {
    type: "CREDIT_CARD",
    label: "CARD NUMBER",
    severity: "high",
    pattern: new RegExp("(?<![0-9])(?:[0-9][ -]?){13,19}(?![0-9])", "g"),
    validate: passesLuhn,
  },
  {
    type: "IBAN",
    label: "IBAN",
    severity: "high",
    pattern: new RegExp(
      "(?<![0-9A-Za-z])[A-Z]{2}[0-9]{2}[0-9A-Z]{10,30}(?![0-9A-Za-z])",
      "g"
    ),
  },

  // -------------------------------------------------------------------- low
  {
    type: "IP_ADDRESS",
    label: "IP ADDRESS",
    severity: "low",
    pattern: new RegExp(
      "(?<![0-9.])(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])[.]){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(?![0-9.])",
      "g"
    ),
  },
  {
    type: "MAC_ADDRESS",
    label: "MAC ADDRESS",
    severity: "low",
    pattern: new RegExp(
      "(?<![0-9A-Fa-f])(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}(?![0-9A-Fa-f])",
      "g"
    ),
  },
];

/**
 * Luhn checksum. A fifteen digit number is only a card number if the digits
 * satisfy the checksum, which removes almost every false positive without
 * needing a list of issuer prefixes.
 */
export function passesLuhn(raw: string): boolean {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let value = digits.charCodeAt(i) - 48;
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}
