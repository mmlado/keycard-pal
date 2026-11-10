import { CUSTOM_TOKEN_CAPTION } from '../src/constants/customTokens';

import { setCustomTokens } from '../src/utils/customTokens';
import { displayDecodedCall } from '../src/utils/decodedCallDisplay';
import {
  displayDescriptor,
  type DisplayNode,
} from '../src/utils/eip7730/display';
import {
  buildArgsEachResolver,
  buildArgsPathResolver,
} from '../src/utils/eip7730/paths';
import type { Eip7730Field } from '../src/utils/eip7730/zip';

const RECIPIENT = '0xD3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const TOKEN = '0x000000000000000000000000000000000000dEaD';
const CUSTOM = {
  chainId: 1,
  address: TOKEN.toLowerCase(),
  symbol: 'FOO',
  decimals: 6,
};
const USDC_TAKEN =
  'Another token on Ethereum Mainnet uses the symbol USDC. Check the contract address.';

function fields(list: Eip7730Field[], args: Record<string, unknown>) {
  const container = { to: RECIPIENT, chainId: 1 };
  return displayDescriptor(
    {
      format: { fields: list },
      resolvePath: buildArgsPathResolver(args, container),
      resolveEach: buildArgsEachResolver(args, container),
      miscasedAt: () => false,
    },
    { chainId: 1, contract: undefined, depth: 0 },
  ).nodes;
}

const byLabel = (nodes: DisplayNode[], label: string) =>
  nodes.find(node => 'label' in node && node.label === label);

afterEach(() => setCustomTokens([]));

describe("the app's own ERC-20 sections", () => {
  const transfer = {
    kind: 'erc20-transfer' as const,
    to: RECIPIENT,
    amount: 1_500_000n,
  };

  it('offers to add an unknown token, on the chain of the call', () => {
    const nodes = displayDecodedCall(transfer, TOKEN.toLowerCase(), 10);
    expect(byLabel(nodes, 'Token contract')).toMatchObject({
      value: TOKEN,
      addToken: { chainId: 10, address: TOKEN },
    });
    expect(nodes.some(node => node.kind === 'token')).toBe(false);
  });

  it('shows a custom token with its caption, its exact amount and no offer', () => {
    setCustomTokens([CUSTOM]);
    const nodes = displayDecodedCall(transfer, TOKEN, 1);
    expect(nodes.find(node => node.kind === 'token')).toEqual({
      kind: 'token',
      token: { symbol: 'FOO', decimals: 6, custom: true },
      caption: CUSTOM_TOKEN_CAPTION,
      warnings: [],
    });
    expect(byLabel(nodes, 'Token contract')).not.toHaveProperty('addToken');
    expect(byLabel(nodes, 'Amount')).toMatchObject({ value: '1.5 FOO' });
  });

  it('warns when the custom symbol is a bundled one on the chain', () => {
    setCustomTokens([{ ...CUSTOM, symbol: 'USDC' }]);
    const nodes = displayDecodedCall(transfer, TOKEN, 1);
    expect(nodes.find(node => node.kind === 'token')).toMatchObject({
      warnings: [USDC_TAKEN],
    });
  });

  it('leaves a bundled token as it was', () => {
    const nodes = displayDecodedCall(transfer, USDC, 1);
    const token = nodes.find(node => node.kind === 'token');
    expect(token).toMatchObject({ warnings: [] });
    expect(token).not.toHaveProperty('caption');
    expect(byLabel(nodes, 'Token contract')).not.toHaveProperty('addToken');
  });
});

describe('a descriptor tokenAmount field', () => {
  const amount = (params: Record<string, unknown>): Eip7730Field => ({
    path: 'amount',
    label: 'Amount',
    format: 'tokenAmount',
    params,
  });

  it('offers to add an unknown token beside its contract', () => {
    const nodes = fields([amount({ token: TOKEN })], { amount: 7n });
    expect(byLabel(nodes, 'Token contract')).toMatchObject({
      value: TOKEN,
      addToken: { chainId: 1, address: TOKEN },
    });
  });

  it('offers the chain the descriptor names for the token, not the request', () => {
    const nodes = fields([amount({ token: TOKEN, chainIdPath: 'dstChain' })], {
      amount: 7n,
      dstChain: 8453n,
    });
    expect(byLabel(nodes, 'Token contract')).toMatchObject({
      addToken: { chainId: 8453, address: TOKEN },
    });
  });

  it('captions a custom token and keeps its contract in view', () => {
    setCustomTokens([CUSTOM]);
    const nodes = fields([amount({ token: TOKEN })], { amount: 7_000_000n });
    expect(byLabel(nodes, 'Amount')).toMatchObject({
      value: '7 FOO',
      caption: CUSTOM_TOKEN_CAPTION,
      warnings: [],
    });
    const contract = byLabel(nodes, 'Token contract');
    expect(contract).toMatchObject({ value: TOKEN });
    expect(contract).not.toHaveProperty('addToken');
  });

  it('adds the duplicate warning to the threshold message too', () => {
    setCustomTokens([{ ...CUSTOM, symbol: 'USDC' }]);
    const nodes = fields([amount({ token: TOKEN, threshold: '1000' })], {
      amount: 5000n,
    });
    expect(byLabel(nodes, 'Amount')).toMatchObject({
      value: 'Unlimited USDC',
      caption: CUSTOM_TOKEN_CAPTION,
    });
    expect(
      (byLabel(nodes, 'Amount') as { warnings: string[] }).warnings,
    ).toContain(USDC_TAKEN);
  });

  it('shows a bundled token with neither caption nor contract row', () => {
    const nodes = fields([amount({ token: USDC })], { amount: 1_500_000n });
    expect(byLabel(nodes, 'Amount')).toMatchObject({ value: '1.5 USDC' });
    expect(byLabel(nodes, 'Amount')).not.toHaveProperty('caption');
    expect(byLabel(nodes, 'Token contract')).toBeUndefined();
  });
});

describe('descriptor address fields that name a token', () => {
  const ticker: Eip7730Field = {
    path: 'token',
    label: 'Token',
    format: 'tokenTicker',
  };
  const tokenOnly: Eip7730Field = {
    path: 'token',
    label: 'Asset',
    format: 'addressName',
    params: { types: ['token'] },
  };

  it.each([
    ['tokenTicker', ticker, 'Token'],
    ['addressName for tokens only', tokenOnly, 'Asset'],
  ])('%s offers to add an unknown token', (_, field, label) => {
    expect(byLabel(fields([field], { token: TOKEN }), label)).toMatchObject({
      kind: 'address',
      addToken: { chainId: 1, address: TOKEN },
    });
  });

  it.each([
    ['tokenTicker', ticker, 'Token'],
    ['addressName for tokens only', tokenOnly, 'Asset'],
  ])('%s captions a custom token', (_, field, label) => {
    setCustomTokens([CUSTOM]);
    const row = byLabel(fields([field], { token: TOKEN }), label);
    expect(row).toMatchObject({
      token: { symbol: 'FOO', custom: true },
      caption: CUSTOM_TOKEN_CAPTION,
    });
    expect(row).not.toHaveProperty('addToken');
  });

  it('makes no offer for an address that may be a wallet', () => {
    const either: Eip7730Field = {
      ...tokenOnly,
      params: { types: ['token', 'wallet'] },
    };
    expect(
      byLabel(fields([either], { token: TOKEN }), 'Asset'),
    ).not.toHaveProperty('addToken');
  });
});
