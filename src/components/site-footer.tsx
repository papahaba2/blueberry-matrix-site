import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mx-auto mt-24 w-full max-w-[1440px] border-t border-white/[0.07] px-4 py-8 md:px-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-display text-sm font-semibold tracking-[-0.02em] text-white">
            Blueberry Matrix
          </p>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
            Fuse Mainnet · Chain ID 122
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-muted">
          <Link href="/vault" className="hover:text-white">
            Vault
          </Link>
          <Link href="/swap" className="hover:text-white">
            Limit orders
          </Link>
          <Link href="/network" className="hover:text-white">
            Contracts
          </Link>
          <a
            href="https://explorer.fuse.io"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white"
          >
            Explorer ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
