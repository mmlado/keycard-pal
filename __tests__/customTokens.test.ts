import {
  addressProblem,
  findCustomToken,
  getCustomTokens,
  isValidSymbol,
  parseChainId,
  parseDecimals,
  readCustomTokens,
  setCustomTokens,
  subscribeCustomTokens,
} from '../src/utils/customTokens';

const CHECKSUMMED = '0xD3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef';
const LOWER = CHECKSUMMED.toLowerCase();
const UPPER = `0x${CHECKSUMMED.slice(2).toUpperCase()}`;
const MISCASED = '0xd3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef';

const token = { chainId: 1, address: LOWER, symbol: 'FOO', decimals: 18 };

afterEach(() => setCustomTokens([]));

describe('parseChainId', () => {
  it('takes a whole number above 0', () => {
    expect(parseChainId('1')).toBe(1);
    expect(parseChainId('8453')).toBe(8453);
  });

  it.each(['', '0', '-1', '1.5', ' 1', '1e3', '0x1', '99999999999999999999'])(
    'refuses %p',
    text => expect(parseChainId(text)).toBeNull(),
  );
});

describe('addressProblem', () => {
  it('accepts EIP-55, all lowercase and all uppercase', () => {
    expect(addressProblem(CHECKSUMMED)).toBeNull();
    expect(addressProblem(LOWER)).toBeNull();
    expect(addressProblem(UPPER)).toBeNull();
  });

  it('refuses mixed case that is not the checksum', () => {
    expect(addressProblem(MISCASED)).toBe('checksum');
  });

  it.each(['', '0x', LOWER.slice(0, 41), `${LOWER}0`, `0X${LOWER.slice(2)}`])(
    'refuses %p as malformed',
    text => expect(addressProblem(text)).toBe('format'),
  );

  it('refuses the zero address', () => {
    expect(addressProblem(`0x${'0'.repeat(40)}`)).toBe('zero');
  });
});

describe('isValidSymbol', () => {
  it('takes 1 to 20 printable ASCII characters as typed', () => {
    expect(isValidSymbol('USDC')).toBe(true);
    expect(isValidSymbol('stETH')).toBe(true);
    expect(isValidSymbol('A'.repeat(20))).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['too long', 'A'.repeat(21)],
    ['a space', 'US DC'],
    ['a Cyrillic look-alike', 'USD\u0421'],
    ['a zero-width space', 'USD\u200bC'],
    ['a bidi override', '\u202eUSDC'],
    ['a non-ASCII symbol', 'USD\u20ae0'],
  ])('refuses %s', (_, text) => expect(isValidSymbol(text)).toBe(false));
});

describe('parseDecimals', () => {
  it('takes 0 to 255', () => {
    expect(parseDecimals('0')).toBe(0);
    expect(parseDecimals('18')).toBe(18);
    expect(parseDecimals('255')).toBe(255);
  });

  it.each(['', '256', '-1', '1.5', '1000', 'six'])('refuses %p', text =>
    expect(parseDecimals(text)).toBeNull(),
  );
});

describe('readCustomTokens', () => {
  it('reads nothing from anything but a list', () => {
    expect(readCustomTokens(null)).toEqual([]);
    expect(readCustomTokens({ tokens: [token] })).toEqual([]);
  });

  it('keeps every entry the editor would accept and skips the rest', () => {
    expect(
      readCustomTokens([
        token,
        { ...token, address: CHECKSUMMED },
        { ...token, chainId: 0 },
        { ...token, address: `0x${'0'.repeat(40)}` },
        { ...token, symbol: 'USD\u0421' },
        { ...token, decimals: 256 },
        { ...token, decimals: '18' },
        null,
        'FOO',
      ]),
    ).toEqual([token]);
  });

  it('keeps the first entry of a chain and address and drops extra fields', () => {
    expect(
      readCustomTokens([
        { ...token, logoURI: 'https://example.com/foo.png' },
        { ...token, symbol: 'BAR' },
        { ...token, chainId: 10 },
      ]),
    ).toEqual([token, { ...token, chainId: 10 }]);
  });
});

describe('the in-memory list', () => {
  it('finds a token by chain and any case of its address', () => {
    setCustomTokens([token]);
    expect(findCustomToken(1, CHECKSUMMED)).toEqual(token);
    expect(findCustomToken(10, CHECKSUMMED)).toBeNull();
  });

  it('tells subscribers when it changes, until they leave', () => {
    const listener = jest.fn();
    const leave = subscribeCustomTokens(listener);
    setCustomTokens([token]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getCustomTokens()).toEqual([token]);
    leave();
    setCustomTokens([]);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
