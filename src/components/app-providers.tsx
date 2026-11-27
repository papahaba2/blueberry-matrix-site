"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";

const Providers = dynamic(() => import("@/components/providers"), {
  ssr: false,
  loading: () => null,
});

/**
 * WalletConnect/RainbowKit initialise IndexedDB on import, so the wallet stack
 * must never run during static prerendering. Children are mounted only after
 * the browser has taken over.
 */
export default function AppProviders({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-ink">
        <div className="mx-auto h-16 max-w-[1440px] px-4 pt-3">
          <div className="h-14 rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
        </div>
      </div>
    );
  }

  return <Providers>{children}</Providers>;
}
