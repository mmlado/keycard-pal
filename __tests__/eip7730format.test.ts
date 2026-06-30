import { formatEip7730Field } from '../src/utils/eip7730/format';

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

const FORMAT_WITH_TOKEN: Eip7730DisplayFormat = {
  fields: [],
  metadata: {
    tokens: {
      '0x000000000000000000000000000000000000feed': {
        decimals: 6,
        ticker: 'USDC',
      },
    },
    enums: {
      orderType: { '0': 'BUY', '1': 'SELL' },
    },
  },
};

const noopCtx = {
  resolvePath: () => null,
};

beforeEach(() => jest.clearAllMocks());

describe('formatEip7730Field', () => {
  it('raw passes value through unchanged', () => {
    const field: Eip7730Field = { path: 'x', label: 'X', format: 'raw' };
    expect(
      formatEip7730Field(field, '0xdeadbeef', FORMAT_WITH_TOKEN, noopCtx),
    ).toBe('0xdeadbeef');
  });

  it('calldata falls back to raw rendering', () => {
    const field: Eip7730Field = {
      path: 'data',
      label: 'Inner',
      format: 'calldata',
    };
    expect(
      formatEip7730Field(field, '0xabcdef', FORMAT_WITH_TOKEN, noopCtx),
    ).toBe('0xabcdef');
  });

  it('date formats a Unix timestamp', () => {
    const field: Eip7730Field = { path: 't', label: 'T', format: 'date' };
    const result = formatEip7730Field(
      field,
      '1700000000',
      FORMAT_WITH_TOKEN,
      noopCtx,
    );
    expect(result).toMatch(/\d/);
    expect(result).not.toBe('1700000000');
  });

  it('enum maps via params.$ref into metadata.enums', () => {
    const field: Eip7730Field = {
      path: 'kind',
      label: 'Kind',
      format: 'enum',
      params: { $ref: 'orderType' },
    };
    expect(formatEip7730Field(field, '0', FORMAT_WITH_TOKEN, noopCtx)).toBe(
      'BUY',
    );
    expect(formatEip7730Field(field, '1', FORMAT_WITH_TOKEN, noopCtx)).toBe(
      'SELL',
    );
    expect(formatEip7730Field(field, '5', FORMAT_WITH_TOKEN, noopCtx)).toBe(
      '5',
    );
  });

  it('tokenAmount uses descriptor metadata decimals + ticker', () => {
    const field: Eip7730Field = {
      path: 'amount',
      label: 'Amount',
      format: 'tokenAmount',
    };
    const ctx = {
      chainId: 1,
      contractAddress: '0x000000000000000000000000000000000000FEED',
      resolvePath: () => null,
    };
    expect(formatEip7730Field(field, '1500000', FORMAT_WITH_TOKEN, ctx)).toBe(
      '1.5 USDC',
    );
  });

  it('tokenAmount falls back to bundled tokens.json when descriptor lacks decimals', () => {
    lookupToken.mockReturnValue({ symbol: 'DAI', decimals: 18 });
    const field: Eip7730Field = {
      path: 'amount',
      label: 'Amount',
      format: 'tokenAmount',
    };
    const ctx = {
      chainId: 1,
      contractAddress: '0x000000000000000000000000000000000000dead',
      resolvePath: () => null,
    };
    expect(
      formatEip7730Field(
        field,
        '1000000000000000000',
        { fields: [], metadata: { tokens: {} } },
        ctx,
      ),
    ).toBe('1 DAI');
  });

  it('tokenAmount returns raw value when no decimals known', () => {
    lookupToken.mockReturnValue(null);
    const field: Eip7730Field = {
      path: 'amount',
      label: 'Amount',
      format: 'tokenAmount',
    };
    const ctx = {
      chainId: 1,
      contractAddress: '0x0000000000000000000000000000000000000bad',
      resolvePath: () => null,
    };
    expect(formatEip7730Field(field, '1234567', { fields: [] }, ctx)).toBe(
      '1234567',
    );
  });

  it('addressName returns the raw value (ENS handled by component)', () => {
    const field: Eip7730Field = {
      path: 'to',
      label: 'To',
      format: 'addressName',
    };
    expect(
      formatEip7730Field(
        field,
        '0xabc0000000000000000000000000000000000000',
        FORMAT_WITH_TOKEN,
        noopCtx,
      ),
    ).toBe('0xabc0000000000000000000000000000000000000');
  });

  it('returns em-dash for null values', () => {
    const field: Eip7730Field = { path: 'x', label: 'X', format: 'raw' };
    expect(formatEip7730Field(field, null, FORMAT_WITH_TOKEN, noopCtx)).toBe(
      '—',
    );
  });
});
