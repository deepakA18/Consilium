"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, getDefaultConfig, lightTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const config = getDefaultConfig({
  appName: "Consilium",
  // Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to a real WalletConnect Cloud id to enable the WC modal;
  // injected wallets (MetaMask, Rainbow, etc.) work without it.
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "consilium_demo",
  chains: [baseSepolia],
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={lightTheme({ accentColor: "#18181b", accentColorForeground: "#ffffff", borderRadius: "large" })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
