import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#09090b",
        "ink-soft": "#0d0a12",
        brand: {
          DEFAULT: "#875cff",
          soft: "#b8a4ff",
          deep: "#5b3bd6",
        },
        fog: "#e8e4f2",
        muted: "rgba(255,255,255,0.62)",
        faint: "rgba(255,255,255,0.4)",
      },
      fontFamily: {
        sans: ["var(--font-inter)"],
        display: ["var(--font-space-grotesk)"],
        mono: ["var(--font-jetbrains-mono)"],
      },
      boxShadow: {
        glass: "0 20px 80px rgba(0,0,0,0.5)",
        brand: "0 14px 44px rgba(135,92,255,0.24)",
      },
      animation: {
        drift: "drift 9s ease-in-out infinite",
      },
      keyframes: {
        drift: {
          "0%, 100%": { transform: "translate3d(0,0,0)" },
          "50%": { transform: "translate3d(0,-14px,0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
