export const SUPPORTED_WC_METHODS = [
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v4',
] as const;

export const SUPPORTED_WC_EIP155_CHAIN_IDS = [
  // Mainnets
  1, // Ethereum Mainnet
  10, // Optimism
  137, // Polygon
  8453, // Base
  42161, // Arbitrum One
  // Testnets
  11155111, // Sepolia
  11155420, // Optimism Sepolia
  80002, // Polygon Amoy
  84532, // Base Sepolia
  421614, // Arbitrum Sepolia
  17000, // Holesky
] as const;

export type WCContext = { id: number; topic: string };
