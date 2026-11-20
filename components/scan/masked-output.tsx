"use client";

import { useState } from "react";

/**
 * The clean copy. This is the text the user pastes into their assistant,
 * so it gets its own panel and its own copy button.
 */
export function MaskedOutput({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="mono text-faint">CLEAN COPY</h2>
        <button
          type="button"
          onClick={copy}
          className="mono text-muted transition-colors duration-150 hover:text-accent"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <pre className="mt-4 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words border border-hairline bg-surface p-4 text-sm leading-relaxed text-text">
        {text}
      </pre>
    </div>
  );
}
