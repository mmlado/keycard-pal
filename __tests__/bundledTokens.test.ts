import tokensData from '../src/data/tokens.json';
import {
  BUNDLED_TOKEN_CHAINS,
  BUNDLED_TOKEN_COUNT,
  bundledTokenSections,
} from '../src/utils/bundledTokens';

const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const all = () => bundledTokenSections('', null);
const tokens = () => all().flatMap(section => section.data);

describe('bundledTokenSections', () => {
  it('holds every bundled token with an Ethereum address', () => {
    const evm = tokensData.tokens.filter(t =>
      /^0x[0-9a-f]{40}$/.test(t.address),
    );
    expect(tokens()).toHaveLength(evm.length);
    expect(BUNDLED_TOKEN_COUNT).toBe(evm.length);
    expect(tokens().every(t => /^0x[0-9a-f]{40}$/.test(t.address))).toBe(true);
  });

  it('groups by chain name and sorts symbols within each chain', () => {
    const names = all().map(section => section.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(new Set(all().map(s => s.chainId)).size).toBe(names.length);
    for (const section of all()) {
      const symbols = section.data.map(t => t.symbol);
      expect(symbols).toEqual([...symbols].sort((a, b) => a.localeCompare(b)));
      expect(section.data.every(t => t.chainId === section.chainId)).toBe(true);
    }
  });

  it('lists the chains in the order of the sections', () => {
    expect(BUNDLED_TOKEN_CHAINS).toEqual(
      all().map(({ chainId, name }) => ({ chainId, name })),
    );
  });

  it('keeps one chain', () => {
    const sections = bundledTokenSections('', 10);
    expect(sections.map(s => s.name)).toEqual(['OP Mainnet']);
    expect(sections[0].data.length).toBeGreaterThan(0);
  });

  it('matches a symbol anywhere, in any case', () => {
    const found = bundledTokenSections('  usd ', 1).flatMap(s => s.data);
    expect(found.map(t => t.symbol)).toContain('USDC');
    expect(found.every(t => t.symbol.toLowerCase().includes('usd'))).toBe(true);
  });

  it('matches an address from its start, checksummed or not', () => {
    for (const query of [
      USDC,
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      '0xa0b869',
    ]) {
      const found = bundledTokenSections(query, 1).flatMap(s => s.data);
      expect(found.map(t => t.address)).toContain(USDC);
      expect(found.every(t => t.address.startsWith(query.toLowerCase()))).toBe(
        true,
      );
    }
    expect(bundledTokenSections('0x6991c6', 1)).toEqual([]);
  });

  it('does not search addresses for a query without 0x', () => {
    const found = bundledTokenSections('a0b8', null).flatMap(s => s.data);
    expect(found.map(t => t.address)).not.toContain(USDC);
  });

  it('drops the chains with nothing left and answers empty for no match', () => {
    const sections = bundledTokenSections('USDC', null);
    expect(sections.every(s => s.data.length > 0)).toBe(true);
    expect(sections.length).toBeLessThan(all().length);
    expect(bundledTokenSections('no-such-symbol', null)).toEqual([]);
  });
});
