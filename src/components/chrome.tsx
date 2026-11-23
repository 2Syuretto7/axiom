import Link from "next/link";
import { ThemeToggle } from "./theme";

/** The thin top line shared by every screen: wordmark left, quiet controls right. */
export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="relative z-10 flex h-14 items-center justify-between px-4 sm:px-8">
      <Link href="/" className="bar-item font-mono text-[13px] tracking-[0.32em] text-ink" aria-label="Axiom home">
        AXIOM
      </Link>
      <nav className="flex items-center gap-6" aria-label="Preferences">
        <ThemeToggle />
        {children}
      </nav>
    </header>
  );
}
