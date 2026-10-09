import { formatTokenAmount, lookupToken } from '../src/utils/tokenMetadata';

// Real addresses from the bundled token list (lowercased)
const USDC_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f';
const MAINNET = 1;
const POLYGON = 137;

describe('lookupToken', () => {
  it('resolves a known mainnet token', () => {
    const token = lookupToken(MAINNET, USDC_ADDRESS);
    expect(token).not.toBeNull();
    expect(token!.symbol).toBe('USDC');
    expect(token!.decimals).toBe(6);
  });

  it('is case-insensitive for the address', () => {
    const lower = lookupToken(MAINNET, USDC_ADDRESS.toLowerCase());
    const upper = lookupToken(MAINNET, USDC_ADDRESS.toUpperCase());
    expect(lower).not.toBeNull();
    expect(upper).not.toBeNull();
    expect(lower!.symbol).toBe(upper!.symbol);
  });

  it('returns null for an unknown address', () => {
    expect(lookupToken(MAINNET, '0x' + 'ab'.repeat(20))).toBeNull();
  });

  it('returns null when the chain does not match', () => {
    // USDC on mainnet address, wrong chain
    expect(lookupToken(POLYGON, USDC_ADDRESS)).toBeNull();
  });

  it('returns null when chainId is undefined', () => {
    expect(lookupToken(undefined, USDC_ADDRESS)).toBeNull();
  });

  it('returns null when address is undefined', () => {
    expect(lookupToken(MAINNET, undefined)).toBeNull();
  });

  it('includes logoURI when present', () => {
    const token = lookupToken(MAINNET, USDC_ADDRESS);
    expect(token!.logoURI).toMatch(/^(https?:\/\/|asset:\/)/);
  });
});

describe('lookupToken logo source', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../src/data/tokenLogosIndex.online');
  });

  it('uses bundled asset URIs for a token in the offline logo index', () => {
    jest.doMock('../src/data/tokenLogosIndex.online', () => ({
      tokenLogosIndex: { [`${MAINNET}:${USDC_ADDRESS}`]: 'png' },
    }));

    jest.isolateModules(() => {
      const { lookupToken: lookupWithLocalLogo } =
        require('../src/utils/tokenMetadata') as typeof import('../src/utils/tokenMetadata');

      expect(lookupWithLocalLogo(MAINNET, USDC_ADDRESS)!.logoURI).toBe(
        `asset:/token-logos/${MAINNET}-${USDC_ADDRESS}.png`,
      );
    });
  });

  it('keeps remote logo URIs when the index is empty', () => {
    expect(lookupToken(MAINNET, USDC_ADDRESS)!.logoURI).toMatch(/^https:\/\//);
  });

  it('resolves the real offline index to an asset URI', () => {
    const { tokenLogosIndex } =
      require('../src/data/tokenLogosIndex.offline') as typeof import('../src/data/tokenLogosIndex.offline');

    expect(tokenLogosIndex[`${MAINNET}:${USDC_ADDRESS}`]).toBeTruthy();

    jest.doMock('../src/data/tokenLogosIndex.online', () => ({
      tokenLogosIndex,
    }));

    jest.isolateModules(() => {
      const { lookupToken: lookupOffline } =
        require('../src/utils/tokenMetadata') as typeof import('../src/utils/tokenMetadata');

      expect(lookupOffline(MAINNET, USDC_ADDRESS)!.logoURI).toBe(
        `asset:/token-logos/${MAINNET}-${USDC_ADDRESS}.${
          tokenLogosIndex[`${MAINNET}:${USDC_ADDRESS}`]
        }`,
      );
    });
  });
});

describe('formatTokenAmount', () => {
  const usdc = { symbol: 'USDC', decimals: 6 };
  const dai = { symbol: 'DAI', decimals: 18 };

  it('formats USDC with 6 decimals', () => {
    expect(formatTokenAmount(1_000_000n, usdc)).toBe('1 USDC');
  });

  it('formats fractional USDC amount', () => {
    expect(formatTokenAmount(1_500_000n, usdc)).toBe('1.5 USDC');
  });

  it('formats zero as "0 SYMBOL"', () => {
    expect(formatTokenAmount(0n, usdc)).toBe('0 USDC');
  });

  it('formats DAI with 18 decimals', () => {
    expect(formatTokenAmount(1_000_000_000_000_000_000n, dai)).toBe('1 DAI');
  });

  it('formats a small sub-unit amount', () => {
    const result = formatTokenAmount(1_000n, usdc); // 0.001 USDC
    expect(result).toBe('0.001 USDC');
  });

  it('includes the symbol from the token metadata', () => {
    const token = lookupToken(MAINNET, DAI_ADDRESS)!;
    const result = formatTokenAmount(5_000_000_000_000_000_000n, token);
    expect(result).toContain('DAI');
  });
});
