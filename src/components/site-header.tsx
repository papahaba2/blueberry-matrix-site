"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion } from "framer-motion";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const LINKS = [
  { label: "Vault", href: "/vault" },
  { label: "Stake", href: "/stake" },
  { label: "Swap", href: "/swap" },
  { label: "Network", href: "/network" },
  { label: "Governance", href: "/governance" },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <motion.header
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50 px-3 pt-3 md:px-5"
    >
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 rounded-2xl border border-white/[0.08] bg-ink/70 px-3 py-2.5 shadow-glass backdrop-blur-2xl md:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-brand/15">
            <Image
              src={`${BASE_PATH}/berry-logo.svg`}
              alt="Blueberry Matrix"
              width={28}
              height={28}
              priority
            />
          </span>
          <span className="hidden leading-none sm:block">
            <span className="block font-display text-[13px] font-semibold tracking-[-0.02em] text-white">
              Blueberry Matrix
            </span>
            <span className="mt-1 flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-faint">
              <i className="h-1 w-1 rounded-full bg-brand shadow-[0_0_8px_#875cff]" />
              Fuse Mainnet
            </span>
          </span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-medium transition-colors ${
                  active
                    ? "bg-white/[0.07] text-white"
                    : "text-muted hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0">
          <ConnectButton showBalance={false} chainStatus="icon" />
        </div>
      </div>
    </motion.header>
  );
}
