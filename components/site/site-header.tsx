"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/scan", label: "Scan" },
  { href: "/image", label: "Picture" },
  { href: "/leak-test", label: "Proof" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/privacy", label: "Privacy" },
];

/**
 * The header.
 *
 * Five links do not fit on a phone, so on a narrow screen they go behind a
 * menu button instead of being squeezed into a row that runs off the edge.
 * From the medium breakpoint up the row comes back, because there the links
 * fit without being shortened or wrapped.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const reduced = useReducedMotion();

  // A page that navigates away has already left the menu behind.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isCurrent = (href: string) => {
    const here = pathname.replace(/\/$/, "");
    const there = href.replace(/\/$/, "");
    return here === there;
  };

  return (
    <header className="border-b border-hairline">
      <div className="mx-auto flex max-w-[var(--content-w)] items-center justify-between px-[var(--gutter)] py-5">
        <Link href="/" className="mono text-text">
          REDACT<span className="text-accent">.</span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-5 md:flex lg:gap-7"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isCurrent(link.href) ? "page" : undefined}
              className={
                isCurrent(link.href)
                  ? "mono text-accent"
                  : "mono text-muted transition-colors duration-150 hover:text-accent"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="site-menu"
          className="mono border border-hairline px-3 py-2 text-muted transition-colors duration-150 hover:border-accent hover:text-accent md:hidden"
        >
          {open ? "CLOSE" : "MENU"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.nav
            id="site-menu"
            aria-label="Primary"
            key="menu"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-hairline md:hidden"
          >
            <ul className="px-[var(--gutter)] pb-2">
              {LINKS.map((link) => (
                <li key={link.href} className="border-b border-hairline last:border-0">
                  <Link
                    href={link.href}
                    aria-current={isCurrent(link.href) ? "page" : undefined}
                    className={
                      isCurrent(link.href)
                        ? "mono block py-4 text-accent"
                        : "mono block py-4 text-muted transition-colors duration-150 hover:text-accent"
                    }
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
