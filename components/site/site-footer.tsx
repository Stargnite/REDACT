export function SiteFooter() {
  return (
    <footer className="mt-[clamp(6rem,12vw,10rem)] border-t border-hairline">
      <div className="mx-auto max-w-[var(--content-w)] px-[var(--gutter)] py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="mono text-faint">
            REDACT<span className="text-accent">.</span> built on Firebase AI Logic
          </p>
          <p className="mono text-faint">Runs in your browser. There is no server.</p>
        </div>
      </div>
    </footer>
  );
}
