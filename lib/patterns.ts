import { RULES } from "./rules";
import type { Finding } from "./types";

/**
 * Runs the deterministic tier over a piece of text.
 *
 * Patterns are global and stateful, so lastIndex is reset before every rule
 * runs. Matches are collected in source order.
 */
export function findPatterns(text: string): Finding[] {
  const findings: Finding[] = [];

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;

    let match: RegExpExecArray | null = rule.pattern.exec(text);
    while (match !== null) {
      const whole = match[0];

      if (whole.length === 0) {
        rule.pattern.lastIndex += 1;
        match = rule.pattern.exec(text);
        continue;
      }

      const group = rule.group ?? 0;
      const value = match[group];

      if (value) {
        const offset =
          group === 0
            ? 0
            : Math.max(0, whole.lastIndexOf(value));

        if (!rule.validate || rule.validate(value)) {
          findings.push({
            type: rule.type,
            label: rule.label,
            severity: rule.severity,
            quote: value,
            start: match.index + offset,
            end: match.index + offset + value.length,
            source: "pattern",
          });
        }
      }

      match = rule.pattern.exec(text);
    }
  }

  return findings.sort((a, b) => a.start - b.start);
}
