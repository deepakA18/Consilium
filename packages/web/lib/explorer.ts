const EXPLORER = "https://sepolia.basescan.org"; // market, agents, stakes — all on Base Sepolia
// Position P is a real Ethereum mainnet Aave v3 borrower (its signals are read from mainnet), so its
// address + history live on Etherscan, not basescan.
const POSITION_EXPLORER = "https://etherscan.io";

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER}/address/${address}`;
export const positionUrl = (address: string) => `${POSITION_EXPLORER}/address/${address}`;
export const positionTxUrl = (hash: string) => `${POSITION_EXPLORER}/tx/${hash}`;
export const shortHash = (h: string, n = 4) => `${h.slice(0, 2 + n)}…${h.slice(-n)}`;
export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
