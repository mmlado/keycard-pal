import {
  ADDRESS_CHECKSUM_ERROR,
  ADDRESS_FORMAT_ERROR,
  ADDRESS_ZERO_ERROR,
  ALREADY_ADDED_ERROR,
  CHAIN_ID_ERROR,
  CUSTOM_TOKEN_CAPTION,
  DECIMALS_ERROR,
  DECIMALS_NOTE,
  SYMBOL_ERROR,
} from '../src/constants/customTokens';

import {
  checkCustomTokenDraft,
  customTokenRemarks,
  duplicateSymbolWarning,
  type CustomTokenDraft,
} from '../src/utils/customTokenChecks';
import { setCustomTokens } from '../src/utils/customTokens';

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const FOO_ADDRESS = '0xD3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef';
const OTHER = '0x000000000000000000000000000000000000dEaD';
const FOO = {
  chainId: 1,
  address: FOO_ADDRESS.toLowerCase(),
  symbol: 'FOO',
  decimals: 18,
};
const USDC_TAKEN =
  'Another token on Ethereum Mainnet uses the symbol usdc. Check the contract address.';

const draft = (over: Partial<CustomTokenDraft> = {}): CustomTokenDraft => ({
  chainId: '1',
  address: OTHER,
  symbol: 'BAR',
  decimals: '6',
  ...over,
});

afterEach(() => setCustomTokens([]));

describe('checkCustomTokenDraft', () => {
  it('gives the token, lowercase, with the chain named, when every field is acceptable', () => {
    const check = checkCustomTokenDraft(draft(), false);
    expect(check.token).toEqual({
      chainId: 1,
      address: OTHER.toLowerCase(),
      symbol: 'BAR',
      decimals: 6,
    });
    expect(check.errors).toEqual({});
    expect(check.notes).toEqual({ chainId: 'Ethereum Mainnet' });
    expect(check.duplicateSymbol).toBeNull();
  });

  it('accepts a chain the app does not know, with a note', () => {
    const check = checkCustomTokenDraft(draft({ chainId: '987654321' }), false);
    expect(check.token).not.toBeNull();
    expect(check.notes.chainId).toBe(
      'Keycard Pal does not know chain 987654321.',
    );
  });

  it('names each field it refuses', () => {
    const check = checkCustomTokenDraft(
      { chainId: '0', address: '0x12', symbol: 'A B', decimals: '256' },
      false,
    );
    expect(check.token).toBeNull();
    expect(check.errors).toEqual({
      chainId: CHAIN_ID_ERROR,
      address: ADDRESS_FORMAT_ERROR,
      symbol: SYMBOL_ERROR,
      decimals: DECIMALS_ERROR,
    });
  });

  it('refuses a wrong checksum and the zero address', () => {
    expect(
      checkCustomTokenDraft(
        draft({ address: '0xd3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef' }),
        false,
      ).errors.address,
    ).toBe(ADDRESS_CHECKSUM_ERROR);
    expect(
      checkCustomTokenDraft(draft({ address: `0x${'0'.repeat(40)}` }), false)
        .errors.address,
    ).toBe(ADDRESS_ZERO_ERROR);
  });

  it('refuses a contract the bundled list holds on that chain, and shows its entry', () => {
    const check = checkCustomTokenDraft(draft({ address: USDC }), false);
    expect(check.token).toBeNull();
    expect(check.errors.address).toBe(
      'Keycard Pal already knows this token as USDC (6 decimals).',
    );
    // On another chain the same address is a gap.
    expect(
      checkCustomTokenDraft(
        draft({ chainId: '987654321', address: USDC }),
        false,
      ).token,
    ).not.toBeNull();
  });

  it('refuses a second entry for a token already added and points at it', () => {
    setCustomTokens([FOO]);
    const check = checkCustomTokenDraft(draft({ address: FOO_ADDRESS }), false);
    expect(check.errors.address).toBe(ALREADY_ADDED_ERROR);
    expect(check.existing).toEqual(FOO);
  });

  it('lets a saved token keep its chain and address, and says when the bundled list shadows it', () => {
    setCustomTokens([FOO]);
    expect(
      checkCustomTokenDraft(draft({ address: FOO_ADDRESS }), true).token,
    ).not.toBeNull();
    const shadowed = checkCustomTokenDraft(draft({ address: USDC }), true);
    expect(shadowed.token).not.toBeNull();
    expect(shadowed.notes.address).toBe(
      'Not used: Keycard Pal now knows this token as USDC.',
    );
  });

  it('notes decimals above 18 without refusing them', () => {
    const check = checkCustomTokenDraft(draft({ decimals: '24' }), false);
    expect(check.token?.decimals).toBe(24);
    expect(check.notes.decimals).toBe(DECIMALS_NOTE);
    expect(
      checkCustomTokenDraft(draft({ decimals: '18' }), false).notes,
    ).not.toHaveProperty('decimals');
  });

  it('warns about a symbol another token on the chain uses, without refusing it', () => {
    const check = checkCustomTokenDraft(draft({ symbol: 'usdc' }), false);
    expect(check.token).not.toBeNull();
    expect(check.duplicateSymbol).toBe(USDC_TAKEN);
  });
});

describe('duplicateSymbolWarning', () => {
  it('compares without case against the bundled list on the same chain', () => {
    expect(duplicateSymbolWarning(1, OTHER, 'usdc')).toBe(USDC_TAKEN);
    expect(duplicateSymbolWarning(987654321, OTHER, 'USDC')).toBeNull();
  });

  it('compares against the other custom tokens on the chain, not the token itself', () => {
    setCustomTokens([FOO]);
    expect(duplicateSymbolWarning(1, OTHER, 'Foo')).toBe(
      'Another token on Ethereum Mainnet uses the symbol Foo. Check the contract address.',
    );
    expect(duplicateSymbolWarning(1, FOO_ADDRESS, 'FOO')).toBeNull();
    expect(duplicateSymbolWarning(10, OTHER, 'FOO')).toBeNull();
  });
});

describe('customTokenRemarks', () => {
  it('says nothing about a bundled or unknown token', () => {
    expect(
      customTokenRemarks({ symbol: 'USDC', decimals: 6 }, 1, USDC),
    ).toEqual({ warnings: [] });
    expect(customTokenRemarks(null, 1, OTHER)).toEqual({ warnings: [] });
  });

  it('captions a custom token and warns about a duplicate symbol', () => {
    const custom = { symbol: 'USDC', decimals: 6, custom: true as const };
    expect(customTokenRemarks(custom, 1, OTHER)).toEqual({
      caption: CUSTOM_TOKEN_CAPTION,
      warnings: [
        'Another token on Ethereum Mainnet uses the symbol USDC. Check the contract address.',
      ],
    });
    expect(customTokenRemarks(custom, undefined, OTHER)).toEqual({
      caption: CUSTOM_TOKEN_CAPTION,
      warnings: [],
    });
  });
});
