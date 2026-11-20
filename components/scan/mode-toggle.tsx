"use client";

import type { ScanMode } from "@/lib/types";

const OPTIONS: { value: ScanMode; label: string; hint: string }[] = [
  { value: "auto", label: "AUTO", hint: "Use the on-device model when the text fits" },
  { value: "on_device", label: "ON DEVICE", hint: "Never send the text to a server" },
  { value: "cloud", label: "CLOUD", hint: "Always use the cloud model" },
];

/**
 * Three states, one accent. The active button is the only vermilion thing
 * in the group, and the choice is a radiogroup so a screen reader announces
 * it as one of three options rather than three buttons.
 */
export function ModeToggle({
  value,
  onChange,
}: {
  value: ScanMode;
  onChange: (next: ScanMode) => void;
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
            title={option.hint}
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
