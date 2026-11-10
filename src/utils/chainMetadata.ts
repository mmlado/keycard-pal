import chains from '../data/chains.json';

type ChainEntry = {
  chainId: number;
  name: string;
  shortName: string | null;
  nativeCurrency: { symbol: string };
};

const chainMap = new Map<number, ChainEntry>(
  (chains as ChainEntry[]).map(c => [c.chainId, c]),
);

export function getChainName(chainId: number): string {
  return chainMap.get(chainId)?.name ?? `Chain ${chainId}`;
}

export function isKnownChain(chainId: number): boolean {
  return chainMap.has(chainId);
}

export function getNativeCurrencySymbol(chainId: number): string {
  return chainMap.get(chainId)?.nativeCurrency.symbol ?? 'ETH';
}
