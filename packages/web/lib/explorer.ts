const EXPLORER = "https://sepolia.basescan.org";

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER}/address/${address}`;
export const shortHash = (h: string, n = 4) => `${h.slice(0, 2 + n)}…${h.slice(-n)}`;
export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
