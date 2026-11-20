import Link from "next/link";

const LINKS = [
  { href: "/scan", label: "Scan" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/privacy", label: "Privacy" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-hairline">
      <div className="mx-auto flex max-w-[var(--content-w)] items-center justify-between px-[var(--gutter)] py-5">
        <Link href="/" className="mono text-text">
          REDACT<span className="text-accent">.</span>
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-5 sm:gap-7">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="mono text-muted transition-colors duration-150 hover:text-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
