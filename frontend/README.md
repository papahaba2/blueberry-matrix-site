# Blueberry Matrix — frontend skeleton

## Stack

- Next.js 14 App Router + TypeScript
- Tailwind CSS
- wagmi + RainbowKit
- Framer Motion
- GSAP + Lenis
- React Three Fiber (home hero only)

## Install and run

```bash
cd frontend
npm install
cp .env.example .env.local
```

Set at least:

```dotenv
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
NEXT_PUBLIC_LIMIT_ORDER_MANAGER_ADDRESS=0x...
```

Then:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Build

```bash
npm run build
```

Static export is written to:

```text
frontend/out/
```

## GitHub Pages

For a project page:

```bash
NEXT_PUBLIC_BASE_PATH=/blueberry-matrix-site npm run build
```

`next.config.js` already sets:

```js
output: "export"
images: { unoptimized: true }
trailingSlash: true
```

Also keep `public/.nojekyll`.

Publish `frontend/out/` to the `gh-pages` branch or to the Pages artifact.

## Wallet and contract notes

- RainbowKit/WalletConnect is mounted only after the browser takes over. The
  wallet stack initialises IndexedDB and must not run during static export.
- R3F is loaded with `next/dynamic` and `ssr: false`; on mobile it is skipped.
- `src/config.ts` contains factory, position manager, manager address, tokens,
  pair definitions and the manager ABI imported from the compiled artifact.

## Limit order direction

The contract is strict and single-sided:

- range above current tick → deposit token0;
- range below current tick → deposit token1;
- range containing current tick → UI error, no transaction.

The form derives `tokenIn` from the range and current tick, so it cannot submit
the wrong side. Contract revert strings are mapped to user-facing messages.
