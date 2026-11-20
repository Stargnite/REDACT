"use client";

import type { ScanMode } from "@/lib/types";

/**
 * What is being scanned. The wording of the hint changes with it, because
 * "never send the text to a server" is a promise about a paragraph and
 * "never send the picture to a server" is a promise about a screenshot, and
 * the second one is the one people need to hear.
 */
export type Subject = "text" | "picture";

const OPTIONS: { value: ScanMode; label: string }[] = [
  { value: "auto", label: "AUTO" },
  { value: "on_device", label: "ON DEVICE" },
  { value: "cloud", label: "CLOUD" },
];

const HINTS: Record<Subject, Record<ScanMode, string>> = {
  text: {
    auto: "Use the on-device model when the text fits",
    on_device: "Never send the text to a server",
    cloud: "Always use the cloud model",
  },
  picture: {
    auto: "Use the on-device model when the text fits",
    on_device: "Never send the text read out of the picture to a server",
    cloud: "Always use the cloud model",
  },
};

/**
 * The hint for the active option, shown as text. A title attribute is
 * invisible on a phone, and on a phone the choice between on device and
 * cloud is the whole point of the control.
 */
export function modeHint(value: ScanMode, subject: Subject = "text"): string {
  return HINTS[subject][value] ?? "";
}

/**
 * Three states, one accent. The active button is the only vermilion thing
 * in the group, and the choice is a radiogroup so a screen reader announces
 * it as one of three options rather than three buttons.
 */
export function ModeToggle({
  value,
  onChange,
  subject = "text",
}: {
  value: ScanMode;
  onChange: (next: ScanMode) => void;
  subject?: Subject;
}) {
  return (
    <div role="radiogroup" aria-label="Which model to use" className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={HINTS[subject][option.value]}
            onClick={() => onChange(option.value)}
            className={
              active
                ? "mono border border-accent px-3 py-2 text-accent transition-colors duration-150"
                : "mono border border-hairline px-3 py-2 text-muted transition-colors duration-150 hover:border-accent hover:text-accent"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
