import tokensData from '@/data/tokens.json';

import { getChainName } from '@/utils/chainMetadata';

export type BundledToken = {
  chainId: number;
  address: string;
  symbol: string;
  decimals: number;
};

export type BundledTokenSection = {
  chainId: number;
  name: string;
  data: BundledToken[];
};

const EVM_ADDRESS = /^0x[0-9a-f]{40}$/;

// Only an Ethereum address can reach a review.
const TOKENS: readonly BundledToken[] = (
  tokensData as { tokens: BundledToken[] }
).tokens
  .filter(token => EVM_ADDRESS.test(token.address))
  .map(({ chainId, address, symbol, decimals }) => ({
    chainId,
    address,
    symbol,
    decimals,
  }));

const SECTIONS: readonly BundledTokenSection[] = (() => {
  const groups = new Map<number, BundledTokenSection>();
  for (const token of TOKENS) {
    const group = groups.get(token.chainId) ?? {
      chainId: token.chainId,
      name: getChainName(token.chainId),
      data: [],
    };
    group.data.push(token);
    groups.set(token.chainId, group);
  }
  return [...groups.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(group => ({
      ...group,
      data: group.data.sort((a, b) => a.symbol.localeCompare(b.symbol)),
    }));
})();

export const BUNDLED_TOKEN_COUNT = TOKENS.length;

export const BUNDLED_TOKEN_CHAINS: readonly {
  chainId: number;
  name: string;
}[] = SECTIONS.map(({ chainId, name }) => ({ chainId, name }));

function matches(token: BundledToken, query: string): boolean {
  // A hex digit matches most addresses, so only a 0x query searches them.
  if (query.startsWith('0x')) return token.address.startsWith(query);
  return token.symbol.toLowerCase().includes(query);
}

/** A symbol anywhere in it, an address from its start; any case. */
export function bundledTokenSections(
  query: string,
  chainId: number | null,
): BundledTokenSection[] {
  const q = query.trim().toLowerCase();
  const sections =
    chainId === null ? SECTIONS : SECTIONS.filter(s => s.chainId === chainId);
  if (!q) return [...sections];
  return sections
    .map(section => ({
      ...section,
      data: section.data.filter(token => matches(token, q)),
    }))
    .filter(section => section.data.length > 0);
}
