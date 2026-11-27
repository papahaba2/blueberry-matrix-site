"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { useState, type ReactNode } from "react";
import {
  darkTheme,
  getDefaultConfig,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { http } from "wagmi";
import { fuse } from "viem/chains";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "YOUR_WALLETCONNECT_PROJECT_ID";

const wagmiConfig = getDefaultConfig({
  appName: "Blueberry Matrix",
  projectId: walletConnectProjectId,
  chains: [fuse],
  transports: {
    [fuse.id]: http("https://rpc.fuse.io/"),
  },
  ssr: true,
});

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#875cff",
            accentColorForeground: "white",
            borderRadius: "medium",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
