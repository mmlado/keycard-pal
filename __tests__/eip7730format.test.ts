import { UNLIMITED_APPROVAL_WARNING } from '../src/constants/approval';
import {
  asAddress,
  describeAddress,
  describeFieldValue,
  describeInteroperable,
  describeTokenTicker,
  ENCRYPTED_TEXT,
  formatEip7730Field,
  interpolateIntent,
  interoperableName,
  NOT_SIGNER_WARNING,
  SENDER_TEXT,
  UNKNOWN_TOKEN_WARNING,
} from '../src/utils/eip7730/format';
import {
  buildArgsEachResolver,
  buildArgsPathResolver,
} from '../src/utils/eip7730/paths';

import type {
  Eip7730DisplayFormat,
  Eip7730Field,
} from '../src/utils/eip7730/zip';

jest.mock('../src/utils/tokenMetadata', () => ({
  lookupToken: jest.fn(),
}));

const { lookupToken } = jest.requireMock('../src/utils/tokenMetadata') as {
  lookupToken: jest.Mock;
};

const TOKEN = '0x000000000000000000000000000000000000feed';
const CONTRACT = '0x000000000000000000000000000000000000c0de';
const OTHER = '0x000000000000000000000000000000000000beef';
const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
// A Solana mint as Across passes it: 32 bytes, none of them padding.
const SOLANA_KEY =
  '0xc6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d61';

const FORMAT: Eip7730DisplayFormat = {
  fields: [],
  metadata: {
    tokens: { '*': { decimals: 6, ticker: 'USDC' } },
    enums: { orderType: { '0': 'BUY', '1': 'SELL' } },
  },
};

function field(
  format: Eip7730Field['format'],
  params?: Record<string, unknown>,
): Eip7730Field {
  return { path: 'v', label: 'V', format, params };
}

function ctx(
  paths: Record<string, string> = {},
  extra: { chainId?: number; contractAddress?: string } = {
    chainId: 1,
    contractAddress: TOKEN,
  },
) {
  return { ...extra, resolvePath: (p: string) => paths[p] ?? null };
}

beforeEach(() => {
  jest.clearAllMocks();
  lookupToken.mockReturnValue(null);
});

describe('formatEip7730Field', () => {
  it('passes raw, calldata and addressName values through', () => {
    for (const format of ['raw', 'calldata', 'addressName'] as const) {
      expect(formatEip7730Field(field(format), '0xabc', FORMAT, ctx())).toEqual(
        { text: '0xabc' },
      );
    }
  });

  it('shows a placeholder for a value that did not resolve', () => {
    expect(formatEip7730Field(field('raw'), null, FORMAT, ctx())).toEqual({
      text: '—',
    });
  });

  describe('date in RFC 3339, in the time zone of the phone', () => {
    afterEach(() => jest.restoreAllMocks());
    // Minutes behind UTC, as Date reports them: Belgrade in winter is -60.
    const at = (minutesBehindUtc: number, value = '1800000000') => {
      jest
        .spyOn(Date.prototype, 'getTimezoneOffset')
        .mockReturnValue(minutesBehindUtc);
      return formatEip7730Field(field('date'), value, FORMAT, ctx()).text;
    };

    it('writes UTC with a Z', () => {
      expect(at(0)).toBe('2027-01-15 08:00:00Z');
    });

    it('writes any other zone with its offset', () => {
      expect(at(-60)).toBe('2027-01-15 09:00:00+01:00');
      expect(at(-330)).toBe('2027-01-15 13:30:00+05:30');
      expect(at(210)).toBe('2027-01-15 04:30:00-03:30');
    });

    it('pads every part, and crosses midnight into the local date', () => {
      expect(at(0, '86461')).toBe('1970-01-02 00:01:01Z');
      expect(at(60, '86461')).toBe('1970-01-01 23:01:01-01:00');
    });
  });

  it('keeps a timestamp past any date, such as a deadline that never expires', () => {
    for (const value of [
      (2n ** 256n - 1n).toString(),
      (2n ** 48n - 1n).toString(),
    ]) {
      expect(formatEip7730Field(field('date'), value, FORMAT, ctx()).text).toBe(
        value,
      );
    }
  });

  it('writes a zero timestamp as the epoch, which the spec does not exempt', () => {
    jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(0);
    expect(formatEip7730Field(field('date'), '0', FORMAT, ctx()).text).toBe(
      '1970-01-01 00:00:00Z',
    );
    jest.restoreAllMocks();
  });

  it('keeps a value that is not a timestamp', () => {
    for (const value of ['soon', '-5', '']) {
      expect(formatEip7730Field(field('date'), value, FORMAT, ctx()).text).toBe(
        value,
      );
    }
  });

  describe('enum', () => {
    const f = field('enum', { $ref: '$.metadata.enums.orderType' });

    it('resolves the $.metadata.enums path', () => {
      expect(formatEip7730Field(f, '0', FORMAT, ctx()).text).toBe('BUY');
      expect(formatEip7730Field(f, '1', FORMAT, ctx()).text).toBe('SELL');
    });

    it('keeps a value the enum does not list', () => {
      expect(formatEip7730Field(f, '5', FORMAT, ctx()).text).toBe('5');
    });

    it('finds a decimal key from the hex a slice gives', () => {
      expect(formatEip7730Field(f, '0x01', FORMAT, ctx()).text).toBe('SELL');
      expect(formatEip7730Field(f, 'x', FORMAT, ctx()).text).toBe('x');
    });

    it('shows a value the enum does not list in decimal, as its keys are', () => {
      expect(formatEip7730Field(f, '0x05', FORMAT, ctx()).text).toBe('5');
      expect(
        formatEip7730Field(f, `0x${'f'.repeat(64)}`, FORMAT, ctx()).text,
      ).toBe((2n ** 256n - 1n).toString());
    });

    it('reads no empty or blank value as 0', () => {
      expect(formatEip7730Field(f, '', FORMAT, ctx()).text).toBe('');
      expect(formatEip7730Field(f, '  ', FORMAT, ctx()).text).toBe('  ');
      expect(formatEip7730Field(f, ' 1 ', FORMAT, ctx()).text).toBe(' 1 ');
    });

    it('shows the value in decimal without a $ref or an enum to resolve it', () => {
      expect(formatEip7730Field(field('enum'), '0', FORMAT, ctx()).text).toBe(
        '0',
      );
      expect(
        formatEip7730Field(field('enum'), '0x05', FORMAT, ctx()).text,
      ).toBe('5');
      expect(
        formatEip7730Field(
          field('enum', { $ref: '$.metadata.enums.missing' }),
          '0x05',
          FORMAT,
          ctx(),
        ).text,
      ).toBe('5');
    });
  });

  it('keeps a block height as the number, not a 1970 date', () => {
    expect(
      formatEip7730Field(
        field('date', { encoding: 'blockheight' }),
        '19332140',
        FORMAT,
        ctx(),
      ).text,
    ).toBe('19332140');
  });

  describe('unit', () => {
    const unit = (value: string, params: Record<string, unknown>) =>
      formatEip7730Field(field('unit', params), value, FORMAT, ctx()).text;

    it('gives the spec examples', () => {
      expect(unit('10', { base: 'h' })).toBe('10h');
      expect(unit('15', { base: 'd', decimals: 1 })).toBe('1.5d');
      expect(unit('36000', { base: 's', prefix: true })).toBe('36ks');
    });

    it('appends the base exactly as written', () => {
      expect(unit('250', { base: 'bps' })).toBe('250bps');
      expect(unit('5000', { base: '%', decimals: 2 })).toBe('50%');
      expect(
        unit('2000000000000000000', { base: ' shares', decimals: 18 }),
      ).toBe('2 shares');
      expect(unit('7', {})).toBe('7');
    });

    it('picks the SI prefix that leaves the smallest significand of one or more', () => {
      expect(unit('1500000', { base: 'W', prefix: true })).toBe('1.5MW');
      expect(unit('999', { base: 'W', prefix: true })).toBe('999W');
      expect(unit('15', { base: 's', decimals: 4, prefix: true })).toBe(
        '1.5ms',
      );
      expect(unit('5', { base: 'g', decimals: 1, prefix: true })).toBe('500mg');
      expect(unit('0', { base: 'W', prefix: true })).toBe('0W');
      expect(unit(`1${'0'.repeat(40)}`, { base: 'W', prefix: true })).toBe(
        '10000000000QW',
      );
    });

    it('ignores decimals that are no uint8 and keeps a value that is no number', () => {
      expect(unit('15', { base: 'd', decimals: -1 })).toBe('15d');
      expect(unit('soon', { base: 'd' })).toBe('soon');
    });
  });

  describe('duration', () => {
    const duration = (value: string) =>
      formatEip7730Field(field('duration'), value, FORMAT, ctx()).text;

    it('shows seconds as HH:MM:ss, the hours uncapped', () => {
      expect(duration('8250')).toBe('02:17:30');
      expect(duration('0')).toBe('00:00:00');
      expect(duration('126230400')).toBe('35064:00:00');
    });

    it('keeps a value that is no duration', () => {
      expect(duration('-5')).toBe('-5');
      expect(duration('soon')).toBe('soon');
    });
  });

  it('shows an NFT by its token ID, as the spec falls back to without a collection list', () => {
    expect(
      formatEip7730Field(
        field('nftName', { collectionPath: '@.to' }),
        '1036',
        FORMAT,
        ctx({ '@.to': OTHER }),
      ),
    ).toEqual({ text: '1036' });
  });

  describe('tokenAmount', () => {
    it('takes the token from tokenPath', () => {
      expect(
        formatEip7730Field(
          field('tokenAmount', { tokenPath: 'token' }),
          '1500000',
          FORMAT,
          ctx({ token: TOKEN }),
        ),
      ).toEqual({ text: '1.5 USDC' });
    });

    it('takes a fixed token address from token', () => {
      expect(
        formatEip7730Field(
          field('tokenAmount', { token: TOKEN }),
          '1500000',
          FORMAT,
          ctx(),
        ),
      ).toEqual({ text: '1.5 USDC' });
    });

    it('warns instead of using the called contract when no token is named', () => {
      expect(
        formatEip7730Field(
          field('tokenAmount'),
          '1500000',
          FORMAT,
          ctx({}, { chainId: 1, contractAddress: TOKEN }),
        ),
      ).toEqual({ text: '1500000', warnings: [UNKNOWN_TOKEN_WARNING] });
    });

    it('warns on a token constant it cannot resolve yet', () => {
      expect(
        formatEip7730Field(
          field('tokenAmount', { token: '$.metadata.constants.usdc' }),
          '1500000',
          FORMAT,
          ctx(),
        ),
      ).toEqual({ text: '1500000', warnings: [UNKNOWN_TOKEN_WARNING] });
    });

    it('applies `*` metadata to the described contract only', () => {
      const own: Eip7730DisplayFormat = {
        fields: [],
        metadata: { tokens: { '*': { decimals: 6, ticker: 'USDT' } } },
      };
      const f = field('tokenAmount', { tokenPath: 'token' });
      const extra = { chainId: 1, contractAddress: CONTRACT };
      expect(
        formatEip7730Field(f, '1500000', own, ctx({ token: CONTRACT }, extra)),
      ).toEqual({ text: '1.5 USDT' });
      expect(
        formatEip7730Field(f, '1500000', own, ctx({ token: OTHER }, extra)),
      ).toEqual({
        text: '1500000',
        warnings: [UNKNOWN_TOKEN_WARNING],
        unknownTokenAddress: OTHER,
      });
    });

    it('names the address of a token it does not know', () => {
      expect(
        formatEip7730Field(
          field('tokenAmount', { tokenPath: 'token' }),
          '1500000',
          { fields: [] },
          ctx({ token: OTHER.toUpperCase().replace('0X', '0x') }),
        ),
      ).toEqual({
        text: '1500000',
        warnings: [UNKNOWN_TOKEN_WARNING],
        unknownTokenAddress: OTHER,
      });
    });

    it('falls back to the bundled token list', () => {
      lookupToken.mockReturnValue({ symbol: 'DAI', decimals: 18 });
      expect(
        formatEip7730Field(
          field('tokenAmount', { token: OTHER }),
          '1000000000000000000',
          { fields: [] },
          ctx(),
        ),
      ).toEqual({ text: '1 DAI' });
      expect(lookupToken).toHaveBeenCalledWith(1, OTHER);
    });

    it('reads a native currency address as the chain currency', () => {
      for (const nativeCurrencyAddress of [NATIVE, [OTHER, NATIVE]]) {
        expect(
          formatEip7730Field(
            field('tokenAmount', { tokenPath: 'token', nativeCurrencyAddress }),
            '2000000000000000',
            FORMAT,
            ctx({ token: NATIVE }),
          ),
        ).toEqual({ text: '0.002 ETH' });
      }
    });

    it('ignores native currency constants it cannot resolve yet', () => {
      expect(
        formatEip7730Field(
          field('tokenAmount', {
            tokenPath: 'token',
            nativeCurrencyAddress: ['$.metadata.constants.addressAsEth'],
          }),
          '2000000000000000',
          FORMAT,
          ctx({ token: NATIVE }),
        ),
      ).toEqual({
        text: '2000000000000000',
        warnings: [UNKNOWN_TOKEN_WARNING],
        unknownTokenAddress: NATIVE,
      });
    });

    describe('threshold', () => {
      const threshold =
        '0x8000000000000000000000000000000000000000000000000000000000000000';
      const f = field('tokenAmount', { token: TOKEN, threshold });

      const unlimited = {
        text: 'Unlimited USDC',
        warnings: [UNLIMITED_APPROVAL_WARNING],
      };

      it('shows "Unlimited" with the ticker and the approval warning at the threshold', () => {
        expect(formatEip7730Field(f, threshold, FORMAT, ctx())).toEqual(
          unlimited,
        );
      });

      it('shows "Unlimited" above the threshold', () => {
        expect(
          formatEip7730Field(f, (2n ** 256n - 1n).toString(), FORMAT, ctx()),
        ).toEqual(unlimited);
      });

      it('warns on "Any amount" too', () => {
        expect(
          formatEip7730Field(
            field('tokenAmount', {
              token: TOKEN,
              threshold,
              message: 'Any amount',
            }),
            threshold,
            FORMAT,
            ctx(),
          ),
        ).toEqual({
          text: 'Any amount USDC',
          warnings: [UNLIMITED_APPROVAL_WARNING],
        });
      });

      it.each(['All', 'Max'])(
        'does not warn on "%s", the user\'s own funds',
        message => {
          expect(
            formatEip7730Field(
              field('tokenAmount', { token: TOKEN, threshold, message }),
              threshold,
              FORMAT,
              ctx(),
            ),
          ).toEqual({ text: `${message} USDC` });
        },
      );

      it('shows the amount below the threshold', () => {
        expect(formatEip7730Field(f, '1500000', FORMAT, ctx())).toEqual({
          text: '1.5 USDC',
        });
      });

      it('still warns when the token is unknown', () => {
        expect(
          formatEip7730Field(
            field('tokenAmount', { threshold }),
            threshold,
            FORMAT,
            ctx(),
          ),
        ).toEqual({
          text: 'Unlimited',
          warnings: [UNLIMITED_APPROVAL_WARNING, UNKNOWN_TOKEN_WARNING],
        });
      });

      it('names the unknown token at the threshold too', () => {
        expect(
          formatEip7730Field(
            field('tokenAmount', { token: OTHER, threshold }),
            threshold,
            FORMAT,
            ctx(),
          ),
        ).toEqual({
          text: 'Unlimited',
          warnings: [UNLIMITED_APPROVAL_WARNING, UNKNOWN_TOKEN_WARNING],
          unknownTokenAddress: OTHER,
        });
      });

      it('ignores a threshold constant it cannot resolve yet', () => {
        expect(
          formatEip7730Field(
            field('tokenAmount', {
              token: TOKEN,
              threshold: '$.metadata.constants.max',
            }),
            '1500000',
            FORMAT,
            ctx(),
          ),
        ).toEqual({ text: '1.5 USDC' });
      });
    });

    it('passes a non-numeric value through', () => {
      expect(
        formatEip7730Field(
          field('tokenAmount', { token: TOKEN }),
          'abc',
          FORMAT,
          ctx(),
        ),
      ).toEqual({ text: 'abc' });
    });
  });

  describe('amount', () => {
    it('formats wei in the chain currency', () => {
      expect(
        formatEip7730Field(field('amount'), '2000000000000000', FORMAT, ctx()),
      ).toEqual({ text: '0.002 ETH' });
      expect(
        formatEip7730Field(
          field('amount'),
          '1000000000000000000',
          FORMAT,
          ctx({}, { chainId: 137 }),
        ),
      ).toEqual({ text: '1 POL' });
    });

    it('shows "All" at the threshold', () => {
      expect(
        formatEip7730Field(
          field('amount', { threshold: '0x10' }),
          '16',
          FORMAT,
          ctx(),
        ),
      ).toEqual({ text: 'All' });
    });

    it('uses the descriptor message', () => {
      expect(
        formatEip7730Field(
          field('amount', { threshold: '0x10', message: 'Everything' }),
          '17',
          FORMAT,
          ctx(),
        ),
      ).toEqual({ text: 'Everything' });
    });

    it('keeps the raw value without a chain', () => {
      expect(
        formatEip7730Field(field('amount'), '2000', FORMAT, ctx({}, {})),
      ).toEqual({ text: '2000' });
    });
  });
});

describe('chainId', () => {
  const chain = (value: string) =>
    formatEip7730Field(field('chainId'), value, FORMAT, ctx()).text;

  it('names the chain, decimal or hex', () => {
    expect(chain('1')).toBe('Ethereum Mainnet');
    expect(chain('0x89')).toBe(chain('137'));
    expect(chain('137')).not.toBe('137');
  });

  it('says which chain it does not know, and keeps a value that is no chain ID', () => {
    expect(chain('123456789123')).toBe('Chain 123456789123');
    expect(chain('0')).toBe('0');
    expect(chain('soon')).toBe('soon');
  });
});

describe('tokenTicker', () => {
  const ticker = (
    params: Record<string, unknown> | undefined,
    raw: string,
    paths: Record<string, string> = {},
  ) =>
    describeTokenTicker(field('tokenTicker', params), raw, FORMAT, ctx(paths));

  it("names a token from the entry's metadata on the request's chain", () => {
    expect(ticker(undefined, TOKEN)).toMatchObject({
      token: { symbol: 'USDC', decimals: 6 },
      warnings: [],
    });
  });

  it('looks a token up on the chain the field names', () => {
    lookupToken.mockReturnValue({ symbol: 'WETH', decimals: 18 });
    expect(ticker({ chainId: 10 }, TOKEN)?.token?.symbol).toBe('WETH');
    expect(lookupToken).toHaveBeenCalledWith(10, TOKEN);
    ticker({ chainIdPath: 'dst' }, OTHER, { dst: '8453' });
    expect(lookupToken).toHaveBeenCalledWith(8453, OTHER);
  });

  it('warns about a token nothing knows, and gives null for no address', () => {
    expect(ticker(undefined, OTHER)?.warnings).toEqual([UNKNOWN_TOKEN_WARNING]);
    expect(ticker({ chainId: 10 }, TOKEN)?.warnings).toEqual([
      UNKNOWN_TOKEN_WARNING,
    ]);
    expect(ticker(undefined, '0x12')).toBeNull();
  });

  it('fills a sentence with the ticker, or the address when unknown', () => {
    const fmt = (fieldPath: string) => ({
      intent: 'Bridge',
      interpolatedIntent: `Bridge {${fieldPath}}`,
      fields: [
        { path: fieldPath, label: 'Token', format: 'tokenTicker' as const },
      ],
      metadata: FORMAT.metadata,
    });
    expect(interpolateIntent(fmt('t'), ctx({ t: TOKEN }))).toBe('Bridge USDC');
    expect(interpolateIntent(fmt('t'), ctx({ t: OTHER }))).toBe(
      `Bridge ${asAddress(OTHER)}`,
    );
  });
});

describe("an entry's own token metadata", () => {
  it('names only the contract the entry describes, so no other address borrows its ticker', () => {
    const amount = (contractAddress?: string) =>
      formatEip7730Field(
        field('tokenAmount', { tokenPath: 'token' }),
        '1500000',
        FORMAT,
        ctx({ token: OTHER }, { chainId: 1, contractAddress }),
      );
    expect(amount(OTHER).text).toBe('1.5 USDC');
    expect(amount(CONTRACT)).toMatchObject({
      text: '1500000',
      warnings: [UNKNOWN_TOKEN_WARNING],
    });
  });
});

describe('tokenAmount on another chain', () => {
  it('reads the token on the chain the field names', () => {
    lookupToken.mockReturnValue({ symbol: 'USDC', decimals: 6 });
    expect(
      formatEip7730Field(
        field('tokenAmount', { tokenPath: 'token', chainId: 42161 }),
        '1500000',
        FORMAT,
        ctx({ token: OTHER }),
      ).text,
    ).toBe('1.5 USDC');
    expect(lookupToken).toHaveBeenCalledWith(42161, OTHER);
  });

  it("ignores the entry's own token metadata off its chain", () => {
    expect(
      formatEip7730Field(
        field('tokenAmount', { tokenPath: 'token', chainId: 42161 }),
        '1500000',
        FORMAT,
        ctx({ token: TOKEN }),
      ),
    ).toMatchObject({ text: '1500000', warnings: [UNKNOWN_TOKEN_WARNING] });
  });

  it("names the native currency of the field's chain", () => {
    expect(
      formatEip7730Field(
        field('tokenAmount', {
          tokenPath: 'token',
          chainId: 137,
          nativeCurrencyAddress: NATIVE,
        }),
        '2000000000000000000',
        FORMAT,
        ctx({ token: NATIVE }),
      ).text,
    ).toMatch(/^2 (POL|MATIC)$/);
  });
});

describe('encrypted fields', () => {
  const HANDLE = `0x${'ab'.repeat(32)}`;
  const encrypted = (
    format: Eip7730Field['format'],
    encryption: Eip7730Field['encryption'],
  ): Eip7730Field => ({ path: 'v', label: 'Amount', format, encryption });

  it('shows the fallback label and keeps the ciphertext for its own row', () => {
    expect(
      formatEip7730Field(
        encrypted('tokenAmount', { fallbackLabel: '[Encrypted Amount]' }),
        HANDLE,
        FORMAT,
        ctx(),
      ),
    ).toEqual({ text: '[Encrypted Amount]', encryptedValue: HANDLE });
  });

  it('says it is encrypted when the entry gives no label', () => {
    expect(
      formatEip7730Field(encrypted('amount', {}), HANDLE, FORMAT, ctx()).text,
    ).toBe(ENCRYPTED_TEXT);
  });

  it('never reads an encrypted address handle as an address in a sentence', () => {
    const fmt = {
      intent: 'Send',
      interpolatedIntent: 'Send to {v}',
      fields: [encrypted('addressName', {})],
    };
    expect(interpolateIntent(fmt, ctx({ v: HANDLE }))).toBe(
      `Send to ${ENCRYPTED_TEXT}`,
    );
  });

  it('fills a sentence with the placeholder, never the handle', () => {
    const fmt = {
      intent: 'Transfer',
      interpolatedIntent: 'Transfer {v}',
      fields: [
        encrypted('tokenAmount', { fallbackLabel: '[Encrypted Amount]' }),
      ],
    };
    expect(interpolateIntent(fmt, ctx({ v: HANDLE }))).toBe(
      'Transfer [Encrypted Amount]',
    );
  });
});

describe('interoperable addresses', () => {
  const VITALIK = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  const interop = (chain: string, address: string) =>
    `0x00010000${chain}14${address.slice(2).toLowerCase()}`;

  it('writes the ERC-7730 and ERC-7828 examples with their checksums', () => {
    expect(interoperableName(interop('0101', VITALIK))?.text).toBe(
      `${VITALIK}@eip155:1#4CA88C9C`,
    );
    expect(
      interoperableName(
        interop('0101', '0xFe89cc7aBB2C4183683ab71653C4cdc9B02D44b7'),
      )?.text,
    ).toBe('0xFe89cc7aBB2C4183683ab71653C4cdc9B02D44b7@eip155:1#80B12379');
  });

  it('reads a chain ID of several bytes', () => {
    expect(interoperableName(interop('03aa36a7', VITALIK))).toMatchObject({
      chainId: 11155111,
      address: VITALIK,
    });
  });

  it('gives null for anything it cannot write as an EVM address', () => {
    const good = interop('0101', VITALIK);
    expect(interoperableName(`0x0002${good.slice(6)}`)).toBeNull();
    expect(interoperableName(`0x00010002${good.slice(10)}`)).toBeNull();
    expect(interoperableName(good.slice(0, -2))).toBeNull();
    expect(interoperableName(`${good}00`)).toBeNull();
    expect(interoperableName('0x000100000000')).toBeNull();
    expect(interoperableName('0x0001000001001400')).toBeNull();
    expect(interoperableName('hello')).toBeNull();
  });

  it("checks a token on the address's own chain, and fills a sentence with the name", () => {
    lookupToken.mockReturnValue({ symbol: 'USDC', decimals: 6 });
    const toField: Eip7730Field = {
      path: 'to',
      label: 'To',
      format: 'interoperableAddressName',
      params: { types: ['token'] },
    };
    const shown = describeInteroperable(
      toField,
      interop('0189', VITALIK),
      FORMAT,
      ctx(),
    );
    expect(shown).toMatchObject({
      name: `${VITALIK}@eip155:137#${shown?.name.split('#')[1]}`,
      token: { symbol: 'USDC' },
      ens: false,
    });
    expect(lookupToken).toHaveBeenCalledWith(137, VITALIK.toLowerCase());
    expect(
      interpolateIntent(
        {
          intent: 'Send',
          interpolatedIntent: 'Send to {to}',
          fields: [toField],
        },
        ctx({ to: interop('0101', VITALIK) }),
      ),
    ).toBe(`Send to ${VITALIK}@eip155:1#4CA88C9C`);
  });
});

describe('interpolated intent safety', () => {
  const uri = {
    intent: 'Set base URI',
    interpolatedIntent: 'Set base URI to {uri}',
    fields: [{ path: 'uri', label: 'URI', format: 'raw' as const }],
  };

  it('fills a plain value', () => {
    expect(interpolateIntent(uri, ctx({ uri: 'ipfs://abc' }))).toBe(
      'Set base URI to ipfs://abc',
    );
  });

  it('falls back to the intent when a value could fake or hide text', () => {
    for (const value of [
      'ipfs://x\nNo approval or transfer is made',
      'ipfs://x\u2028second line',
      '\u202eHTE 01 dnes',
      'ipfs://\u200bx',
      'x\u0007',
    ])
      expect(interpolateIntent(uri, ctx({ uri: value }))).toBeNull();
  });

  it('falls back to the intent when a value or the sentence runs long', () => {
    expect(interpolateIntent(uri, ctx({ uri: 'a'.repeat(81) }))).toBeNull();
    expect(interpolateIntent(uri, ctx({ uri: 'a'.repeat(80) }))).not.toBeNull();
    const list = {
      intent: 'Pay',
      interpolatedIntent: 'Pay {to.[]}',
      fields: [{ path: 'to.[]', label: 'To', format: 'raw' as const }],
    };
    const listCtx = (to: string[]) => ({
      chainId: 1,
      resolvePath: buildArgsPathResolver({ to }),
      resolveEach: buildArgsEachResolver({ to }),
    });
    expect(interpolateIntent(list, listCtx(['a', 'b']))).toBe('Pay a, b');
    expect(
      interpolateIntent(list, listCtx(Array(10).fill('a'.repeat(20)))),
    ).toBeNull();
  });
});

describe('conformance fixes', () => {
  it('reads a token kept in a uint256 through tokenPath', () => {
    lookupToken.mockImplementation((_c: number, a: string) =>
      a === OTHER ? { symbol: 'WETH', decimals: 18 } : null,
    );
    expect(
      formatEip7730Field(
        field('tokenAmount', { tokenPath: 'asset' }),
        '1000000000000000000',
        FORMAT,
        ctx({ asset: BigInt(OTHER).toString() }, { chainId: 1 }),
      ).text,
    ).toBe('1 WETH');
  });

  it('still takes a literal token only as an address', () => {
    expect(
      formatEip7730Field(
        field('tokenAmount', { token: BigInt(TOKEN).toString() }),
        '1500000',
        FORMAT,
        ctx({}, { chainId: 1, contractAddress: TOKEN }),
      ).warnings,
    ).toEqual([UNKNOWN_TOKEN_WARNING]);
  });

  it("fills a sentence with an addressName token's ticker", () => {
    lookupToken.mockReturnValue({ symbol: 'USDT', decimals: 6 });
    expect(
      interpolateIntent(
        {
          intent: 'Sell',
          interpolatedIntent: 'Sell for {asset}',
          fields: [
            {
              path: 'asset',
              label: 'Asset',
              format: 'addressName',
              params: { types: ['token'] },
            },
          ],
        },
        ctx({ asset: OTHER }),
      ),
    ).toBe('Sell for USDT');
  });

  it("checks an interoperable address's token on its chain without moving the request's", () => {
    // ERC-7930: version 1, eip155, chain 137 (0x89), a 20-byte address.
    const interop = `0x00010000018914${TOKEN.slice(2)}`;
    const toField: Eip7730Field = {
      path: 'to',
      label: 'To',
      format: 'interoperableAddressName',
      params: { types: ['token'] },
    };
    // The entry's own token metadata names its own contract, on its own chain only.
    const shown = describeInteroperable(toField, interop, FORMAT, ctx());
    expect(lookupToken).toHaveBeenCalledWith(137, TOKEN);
    expect(shown?.token).toBeNull();
  });
});

describe('asAddress', () => {
  const ADDRESS = '0xD3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef';

  it('checksums an address', () => {
    expect(asAddress(ADDRESS.toLowerCase())).toBe(ADDRESS);
  });

  it('takes an address from a zero-padded 32-byte word', () => {
    expect(asAddress(`0x${'0'.repeat(24)}${ADDRESS.slice(2)}`)).toBe(ADDRESS);
  });

  it('takes the low 20 bytes of a uint256, as 1inch orders keep addresses', () => {
    const packed = 0x80n * 2n ** 248n + BigInt(ADDRESS);
    expect(asAddress(packed.toString())).toBe(ADDRESS);
  });

  it("gives null for a 32-byte word that is another chain's address", () => {
    expect(asAddress(SOLANA_KEY)).toBeNull();
  });

  it("shows another chain's address as written, in every address format", () => {
    for (const format of ['addressName', 'tokenTicker'] as const) {
      expect(
        describeFieldValue(field(format), SOLANA_KEY, FORMAT, ctx()),
      ).toMatchObject({ kind: 'text', text: SOLANA_KEY });
    }
    expect(lookupToken).not.toHaveBeenCalled();
  });

  it("finds no token at another chain's address through tokenPath", () => {
    lookupToken.mockReturnValue({ symbol: 'WETH', decimals: 18 });
    expect(
      formatEip7730Field(
        field('tokenAmount', { tokenPath: 'asset' }),
        '1500000',
        FORMAT,
        ctx({ asset: SOLANA_KEY }, { chainId: 1 }),
      ),
    ).toMatchObject({ text: '1500000', warnings: [UNKNOWN_TOKEN_WARNING] });
    expect(lookupToken).not.toHaveBeenCalled();
  });

  it('gives null for anything else', () => {
    expect(asAddress('0x1234')).toBeNull();
    expect(asAddress((2n ** 256n).toString())).toBeNull();
    expect(asAddress('vitalik.eth')).toBeNull();
  });
});

describe('describeAddress', () => {
  const SIGNER = '0xD3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef';
  const ZERO = '0x0000000000000000000000000000000000000000';
  const name = (
    params: Record<string, unknown>,
    raw: string,
    paths: Record<string, string> = { '@.from': SIGNER },
  ) => describeAddress(field('addressName', params), raw, FORMAT, ctx(paths));

  it('gives null for a value that is no address', () => {
    expect(name({}, '0x1234')).toBeNull();
  });

  it('names a known token, from the entry first, then the bundled list', () => {
    expect(name({ types: ['token'] }, TOKEN)).toMatchObject({
      token: { symbol: 'USDC', decimals: 6 },
      warnings: [],
    });
    lookupToken.mockReturnValue({ symbol: 'DAI', decimals: 18, logoURI: 'x' });
    expect(name({ types: ['token'] }, OTHER)?.token).toEqual({
      symbol: 'DAI',
      decimals: 18,
      logoURI: 'x',
    });
    expect(lookupToken).toHaveBeenCalledWith(1, OTHER);
  });

  it('warns about an unknown token only when token is the one type', () => {
    expect(name({ types: ['token'] }, OTHER)?.warnings).toEqual([
      UNKNOWN_TOKEN_WARNING,
    ]);
    expect(name({ types: ['token', 'contract'] }, OTHER)?.warnings).toEqual([]);
    expect(name({ types: ['contract'] }, TOKEN)?.token).toBeNull();
  });

  it('warns when a wallet-only address is not the signer, and only then', () => {
    expect(name({ types: ['wallet'] }, OTHER)?.warnings).toEqual([
      NOT_SIGNER_WARNING,
    ]);
    expect(name({ types: ['wallet'] }, SIGNER.toLowerCase())?.warnings).toEqual(
      [],
    );
    expect(name({ types: ['wallet'] }, OTHER, {})?.warnings).toEqual([]);
    expect(name({ types: ['wallet', 'eoa'] }, OTHER)?.warnings).toEqual([]);
  });

  it('allows ENS unless the sources leave it out', () => {
    expect(name({}, OTHER)?.ens).toBe(true);
    expect(name({ sources: ['local', 'ens'] }, OTHER)?.ens).toBe(true);
    expect(name({ sources: ['local'] }, OTHER)?.ens).toBe(false);
    expect(name({ sources: [] }, OTHER)?.ens).toBe(false);
  });

  it('shows the signer for a sender address, and no address without one', () => {
    for (const senderAddress of [ZERO, [ZERO]]) {
      expect(name({ senderAddress, types: ['token'] }, ZERO)).toEqual({
        address: SIGNER,
        sender: true,
        token: null,
        warnings: [],
        ens: true,
      });
    }
    expect(name({ senderAddress: ZERO }, ZERO, {})).toMatchObject({
      address: null,
      sender: true,
    });
    expect(name({ senderAddress: ZERO }, OTHER)?.sender).toBe(false);
  });

  it('fills a sentence with the signer, or the word for it', () => {
    const fmt = {
      intent: 'Swap',
      interpolatedIntent: 'Swap for {to}',
      fields: [
        {
          path: 'to',
          label: 'Beneficiary',
          format: 'addressName' as const,
          params: { senderAddress: ZERO },
        },
      ],
    };
    expect(interpolateIntent(fmt, ctx({ to: ZERO, '@.from': SIGNER }))).toBe(
      `Swap for ${SIGNER}`,
    );
    expect(interpolateIntent(fmt, ctx({ to: ZERO }))).toBe(
      `Swap for ${SENDER_TEXT}`,
    );
  });
});

describe('interpolateIntent', () => {
  const RECIPIENT = '0xd3cda913deb6f4967b2ef3aa68f5a843da74c4ef';
  const sentence = (
    interpolatedIntent: string | undefined,
    paths: Record<string, string> = { '#.amount': '1500000', to: RECIPIENT },
  ) =>
    interpolateIntent(
      {
        intent: 'Send',
        interpolatedIntent,
        fields: [
          { path: 'to', label: 'To', format: 'addressName' },
          {
            path: '#.amount',
            label: 'Amount',
            format: 'tokenAmount',
            params: { token: TOKEN },
          },
          { path: '@.value', label: 'Value', format: 'amount' },
          { path: '', label: 'Ticker', format: 'raw', value: 'kmmUSDC' },
          { path: 'data', label: 'Call', format: 'calldata' },
        ],
        metadata: FORMAT.metadata,
      },
      ctx({ ...paths, '@.value': '500000000000000000' }),
    );

  it('formats each placeholder as its field, addresses checksummed', () => {
    expect(sentence('Send {amount} to {#.to}')).toBe(
      'Send 1.5 USDC to 0xD3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef',
    );
    expect(sentence('Wrap {@.value}')).toBe('Wrap 0.5 ETH');
    expect(sentence('Run {{f}} for {amount}')).toBe('Run {f} for 1.5 USDC');
  });

  it('gives no sentence, so the intent shows, when anything cannot be filled', () => {
    expect(sentence(undefined)).toBeNull();
    expect(sentence('Send {amount} to {to}', { '#.amount': '1' })).toBeNull();
    expect(sentence('Send {missing}')).toBeNull();
    expect(sentence('Call {data}', { data: '0x12' })).toBeNull();
    expect(sentence('Broken {amount')).toBeNull();
  });
  it('fills an array placeholder with every element, each paired with its token', () => {
    const OTHER_TOKEN = '0x000000000000000000000000000000000000f00d';
    const args = {
      amounts: [1500000n, 2000000n],
      tokens: [TOKEN, OTHER_TOKEN],
      owners: [
        '0xd3cda913deb6f4967b2ef3aa68f5a843da74c4ef',
        '0x000000000000000000000000000000000000c0de',
      ],
    };
    const resolveEach = buildArgsEachResolver(args);
    const fmt = (interpolatedIntent: string) => ({
      intent: 'Withdraw',
      interpolatedIntent,
      fields: [
        {
          path: 'amounts.[]',
          label: 'Amount',
          format: 'tokenAmount' as const,
          params: { tokenPath: 'tokens.[]' },
        },
        { path: 'owners.[]', label: 'Owner', format: 'addressName' as const },
      ],
    });
    lookupToken.mockImplementation((_chain: number, address: string) =>
      address === TOKEN
        ? { symbol: 'USDC', decimals: 6 }
        : address === OTHER_TOKEN
        ? { symbol: 'DAI', decimals: 6 }
        : null,
    );
    const context = {
      chainId: 1,
      resolvePath: (p: string) => resolveEach(p)[0] ?? null,
      resolveEach,
    };
    expect(interpolateIntent(fmt('Withdraw {amounts.[]}'), context)).toBe(
      'Withdraw 1.5 USDC, 2 DAI',
    );
    expect(interpolateIntent(fmt('For {owners.[]}'), context)).toBe(
      'For 0xD3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef, 0x000000000000000000000000000000000000c0DE',
    );
    expect(
      interpolateIntent(fmt('Withdraw {amounts.[]}'), {
        ...context,
        resolveEach: buildArgsEachResolver({ amounts: [] }),
      }),
    ).toBeNull();
  });
});
