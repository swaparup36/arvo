"use client";

import * as React from "react";
import {
  RainbowKitProvider,
  darkTheme,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { arbitrum, base, mainnet, optimism, sepolia } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";

const config = getDefaultConfig({
  appName: "Arvo",
  projectId: "59e310dfb83662fd020082a91ec89183", // Get one at cloud.reown.com
  chains: [mainnet, sepolia, base, arbitrum, optimism],
  ssr: true, // Required for Next.js Server-Side Rendering
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#99e836",
            accentColorForeground: "#06130c",
            borderRadius: "large",
            fontStack: "system",
            overlayBlur: "small",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
