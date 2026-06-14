"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, getDefaultConfig, lightTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const config = getDefaultConfig({
  appName: "Consilium",
  // Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to a real WalletConnect Cloud id to enable the WC modal;
  // injected wallets (MetaMask, Rainbow, etc.) work without it.
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "consilium_demo",
  chains: [baseSepolia],
  // Client: route chain reads through our same-origin proxy (/api/rpc), which forwards to the
  // PRIVATE keyed RPC server-side — the keyed URL never ships to the browser. During SSR there is
  // no origin for a relative URL, and server reads don't need the key, so fall back to the public
  // endpoint directly. Either path keeps the keyed URL off the client. Signed transactions still go
  // out through the user's own wallet RPC, not this transport.
  transports: {
    [baseSepolia.id]: http(typeof window === "undefined" ? "https://sepolia.base.org" : "/api/rpc"),
  },
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
