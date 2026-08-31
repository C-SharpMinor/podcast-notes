import Link from "next/link";

export default function Footer() {
  return (
    <footer className="max-w-4xl mx-auto px-4 py-8 mt-8 border-t border-[var(--border)] flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[var(--text-muted)]">
      <Link
        href="/terms"
        className="hover:text-[var(--text)] transition-colors min-h-11 inline-flex items-center"
      >
        Terms of Service
      </Link>
      <Link
        href="/privacy"
        className="hover:text-[var(--text)] transition-colors min-h-11 inline-flex items-center"
      >
        Privacy Policy
      </Link>
      <Link
        href="/dmca"
        className="hover:text-[var(--text)] transition-colors min-h-11 inline-flex items-center"
      >
        Copyright / Takedown
      </Link>
      <span>© {new Date().getFullYear()} PenDown</span>
    </footer>
  );
}