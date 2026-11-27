"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const HeroCanvas = dynamic(() => import("@/components/hero-canvas"), {
  ssr: false,
  loading: () => null,
});

export default function HeroVisual() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(window.matchMedia("(min-width: 768px)").matches);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(135,92,255,0.16),transparent_60%)]" />
      <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.4)_1px,transparent_1px)] [background-size:72px_72px]" />
      {enabled && <HeroCanvas />}
      <motion.div
        aria-hidden
        animate={{ y: [0, -14, 0], opacity: [0.45, 0.7, 0.45] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute right-[8%] top-[18%] h-48 w-48 rounded-full bg-brand/20 blur-3xl md:h-72 md:w-72"
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />
    </div>
  );
}
