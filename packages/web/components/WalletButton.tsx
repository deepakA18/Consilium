"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { cn } from "@/lib/utils";

/**
 * Wallet connect button styled with our design tokens, so it stays monochrome and adapts to context
 * (white pill on the dark landing, black pill on the light market) instead of RainbowKit's accent.
 */
export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        const pill = "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-colors";

        if (!ready) return <div aria-hidden className="h-8 w-24 opacity-0" />;

        if (!connected) {
          return (
            <button onClick={openConnectModal} className={cn(pill, "bg-primary text-primary-foreground hover:opacity-90")}>
              Connect wallet
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button onClick={openChainModal} className={cn(pill, "bg-no/15 text-no")}>
              Wrong network
            </button>
          );
        }

        return (
          <div className="flex items-center gap-2">
            <button onClick={openChainModal} className={cn(pill, "border border-border text-foreground/80 hover:bg-accent")}>
              {chain.hasIcon && chain.iconUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={chain.iconUrl} alt="" className="size-3.5 rounded-full" />
              )}
              {chain.name}
            </button>
            <button onClick={openAccountModal} className={cn(pill, "border border-border text-foreground hover:bg-accent")}>
              {account.displayName}
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
