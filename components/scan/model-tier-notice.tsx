import type { ModelTierError } from "@/lib/errors";

/**
 * What the user sees when the model tier did not run. The SDK's raw message
 * is long and full of URLs, so it goes behind a disclosure and the page
 * keeps its shape.
 */
export function ModelTierNotice({ error }: { error: ModelTierError }) {
  return (
    <div className="border-l-2 border-accent bg-surface p-4 sm:p-5">
      <p className="mono text-accent">{error.label}</p>
      <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-text">
        {error.title}
      </p>
      <p className="mt-2 max-w-[54ch] text-sm leading-relaxed text-muted">
        {error.detail}
      </p>

      {error.retryHint ? (
        <p className="mono mt-4 text-faint">{error.retryHint}</p>
      ) : null}

      <details className="mt-4">
        <summary className="mono cursor-pointer text-faint transition-colors duration-150 hover:text-accent">
          Technical detail
        </summary>
        <pre className="mono mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words border border-hairline p-3 text-xs leading-relaxed text-faint [overflow-wrap:anywhere]">
          {error.raw}
        </pre>
      </details>
    </div>
  );
}
