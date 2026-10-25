import { encodeFunctionData, parseAbiItem, type AbiFunction } from 'viem';

import { UNLIMITED_APPROVAL_WARNING } from '../src/constants/approval';
import { MISCASED_ADDRESS_WARNING } from '../src/constants/eip712';
import { DESCRIPTOR_CHECK_FAILED_WARNING } from '../src/constants/eip7730';

import {
  describeCall,
  type CallDescription,
  type MatchedDescriptor,
} from '../src/utils/callDescription';
import { displayDecodedCall } from '../src/utils/decodedCallDisplay';
import {
  displayCallSection,
  displayDescriptor,
  displayInnerCall,
  displayMessage,
  ENCRYPTED_VALUE_LABEL,
  MESSAGE_SECTION,
  SIGNER_CAPTION,
  type DisplayNode,
} from '../src/utils/eip7730/display';
import {
  NOT_SIGNER_WARNING,
  SENDER_TEXT,
  UNKNOWN_TOKEN_WARNING,
} from '../src/utils/eip7730/format';
import * as eip7730Lookup from '../src/utils/eip7730/lookup';
import {
  buildArgsEachResolver,
  buildArgsPathResolver,
  buildEip712Resolvers,
} from '../src/utils/eip7730/paths';
import { NOT_REVIEWED_TEXT } from '../src/utils/eip7730/source';
import type {
  Eip7730DisplayFormat,
  Eip7730Field,
} from '../src/utils/eip7730/zip';
import { checksumEthAddress } from '../src/utils/ethereumAddress';

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const RECIPIENT = '0xD3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef';
// Mixed case, not the EIP-55 form of RECIPIENT.
const MISCASED = '0xd3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef';
const UNKNOWN = '0x000000000000000000000000000000000000dEaD';
const OTHER_TOKEN = '0x00000000000000000000000000000000000Beef0';
const SOME_CONTRACT = '0x000000000000000000000000000000000000c0DE';
const AAVE_WETH_GATEWAY = '0xD01607c3C5eCABa394D8be377a08590149325722';
const AAVE_V2_POOL = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';
const ZERO = '0x0000000000000000000000000000000000000000';
const MAX_160 = '0xffffffffffffffffffffffffffffffffffffffff';
const CYFRIN = '0x3846c3A30E62075Fa916216b35EF04B8F53931f6';
const HANDLE = `0x${'ab'.repeat(32)}`;

function encode(signature: string, args: unknown[]): string {
  return encodeFunctionData({
    abi: [parseAbiItem(`function ${signature}`) as AbiFunction],
    args,
  });
}

const transfer = encode('transfer(address to, uint256 amount)', [
  RECIPIENT,
  1_500_000n,
]);

function now(description: CallDescription | Promise<CallDescription>) {
  if (description instanceof Promise) throw new Error('waited for a slice');
  return description;
}

// Rows as `label: value`, a token as [SYMBOL], warnings and captions under their row,
// blocks indented under their title; an inner call is described as the review describes it.
function outline(nodes: DisplayNode[], indent = ''): string[] {
  return nodes.flatMap((node): string[] => {
    switch (node.kind) {
      case 'text':
      case 'address': {
        const marks = [
          node.token && `[${node.token.symbol}]`,
          node.kind === 'address' && !node.ens && '(no ENS)',
        ].filter(Boolean);
        return [
          [`${indent}${node.label}: ${node.value}`, ...marks].join(' '),
          ...(node.caption ? [`${indent}  (${node.caption})`] : []),
          ...node.warnings.map(w => `${indent}  ! ${w}`),
        ];
      }
      case 'warning':
        return [`${indent}! ${node.text}`];
      case 'section':
        return [`${indent}# ${node.title}`];
      case 'item':
        return [
          `${indent}${node.title ?? '-'}`,
          ...outline(node.nodes, `${indent}  `),
        ];
      case 'call':
        return outline(
          displayInnerCall(node.request, now(describeCall(node.request))),
          indent,
        );
      case 'token':
        return [`${indent}token ${node.token.symbol}`];
      case 'entry':
        return [
          `${indent}= ${node.display.heading}`,
          ...outline(node.display.nodes, indent),
        ];
      case 'group':
        return [`${indent}group`, ...outline(node.rows, `${indent}  `)];
    }
  });
}

function descriptorFor(
  format: Eip7730DisplayFormat,
  args: Record<string, unknown>,
  container: { from?: string; to?: string; value?: string } = {},
): MatchedDescriptor {
  const withChain = { to: RECIPIENT, chainId: 1, ...container };
  return {
    format,
    resolvePath: buildArgsPathResolver(args, withChain),
    resolveEach: buildArgsEachResolver(args, withChain),
    miscasedAt: () => false,
  };
}

function show(
  fields: Eip7730Field[],
  args: Record<string, unknown>,
  from?: string,
): string[] {
  const display = displayDescriptor(descriptorFor({ fields }, args, { from }), {
    chainId: 1,
    contract: undefined,
    depth: 0,
  });
  return outline(display.nodes);
}

function kindsOf(
  fields: Eip7730Field[],
  args: Record<string, unknown>,
  from?: string,
): string[] {
  return displayDescriptor(descriptorFor({ fields }, args, { from }), {
    chainId: 1,
    contract: undefined,
    depth: 0,
  }).nodes.map(node => node.kind);
}

const permitBatch: Eip7730Field[] = [
  { path: 'spender', label: 'Spender', format: 'raw' },
  {
    path: 'details.[].amount',
    label: 'Amount allowance',
    format: 'tokenAmount',
    params: {
      tokenPath: 'details.[].token',
      threshold: MAX_160,
      message: 'Unlimited',
    },
  },
  { path: 'details.[].expiration', label: 'Approval expires', format: 'raw' },
];

describe('displayDescriptor: arrays', () => {
  it('shows every element in its own block, each amount with its own token', () => {
    expect(
      show(permitBatch, {
        spender: RECIPIENT,
        details: [
          { token: USDC, amount: 1_000_000n, expiration: 1n },
          { token: WETH, amount: BigInt(MAX_160), expiration: 2n },
        ],
      }),
    ).toEqual([
      `Spender: ${RECIPIENT}`,
      'Item 1 of 2',
      '  Amount allowance: 1 USDC',
      '  Approval expires: 1',
      'Item 2 of 2',
      '  Amount allowance: Unlimited WETH',
      `    ! ${UNLIMITED_APPROVAL_WARNING}`,
      '  Approval expires: 2',
    ]);
  });

  it('shows a single element as plain rows', () => {
    expect(
      show(permitBatch, {
        spender: RECIPIENT,
        details: [{ token: USDC, amount: 1_000_000n, expiration: 1n }],
      }),
    ).toEqual([
      `Spender: ${RECIPIENT}`,
      'Amount allowance: 1 USDC',
      'Approval expires: 1',
    ]);
  });

  it('shows a dash for each field over an empty array', () => {
    expect(show(permitBatch, { spender: RECIPIENT, details: [] })).toEqual([
      `Spender: ${RECIPIENT}`,
      'Amount allowance: —',
      'Approval expires: —',
    ]);
  });

  it('nests blocks for an array inside an array', () => {
    expect(
      show([{ path: 'swaps.[].route.[].pool', label: 'Pool', format: 'raw' }], {
        swaps: [
          { route: [{ pool: 'a' }, { pool: 'b' }] },
          { route: [{ pool: 'c' }] },
        ],
      }),
    ).toEqual([
      'Item 1 of 2',
      '  Item 1 of 2',
      '    Pool: a',
      '  Item 2 of 2',
      '    Pool: b',
      'Item 2 of 2',
      '  Pool: c',
    ]);
  });

  it('applies a visibility rule to each element', () => {
    expect(
      show(
        [
          {
            path: 'orders.[].expiry',
            label: 'Expires',
            format: 'raw',
            visible: { ifNotIn: ['0'] },
          },
        ],
        { orders: [{ expiry: 0n }, { expiry: 7n }] },
      ),
    ).toEqual(['Item 1 of 2', 'Item 2 of 2', '  Expires: 7']);
  });

  it('shows the last element of an array, an address read out of its word', () => {
    const packed = 0x80n * 2n ** 248n + BigInt(RECIPIENT);
    expect(
      show(
        [{ path: 'pools.[-1]', label: 'Last pool', format: 'addressName' }],
        {
          pools: [1n, packed],
        },
      ),
    ).toEqual([`Last pool: ${RECIPIENT}`]);
  });

  it('reads a slice of bytes as one value', () => {
    expect(
      show(
        [
          {
            path: 'creds.[12:32]',
            label: 'Withdrawal address',
            format: 'addressName',
          },
          { path: 'creds.[:1]', label: 'Type', format: 'raw' },
        ],
        {
          creds: `0x01${'00'.repeat(11)}${RECIPIENT.slice(2).toLowerCase()}`,
        },
      ),
    ).toEqual([`Withdrawal address: ${RECIPIENT}`, 'Type: 0x01']);
  });
});

describe('displayDescriptor: addresses', () => {
  const tokenType: Eip7730Field = {
    path: 'asset',
    label: 'Maker asset',
    format: 'addressName',
    params: { types: ['token'] },
  };

  it('names a known token beside its address', () => {
    const [row] = displayDescriptor(
      descriptorFor({ fields: [tokenType] }, { asset: USDC }),
      { chainId: 1, contract: undefined, depth: 0 },
    ).nodes;
    expect(row).toMatchObject({
      kind: 'address',
      label: 'Maker asset',
      value: USDC,
      ens: true,
      token: { symbol: 'USDC' },
      warnings: [],
    });
  });

  it('warns about an address that is no known token', () => {
    expect(show([tokenType], { asset: UNKNOWN })).toEqual([
      `Maker asset: ${UNKNOWN}`,
      `  ! ${UNKNOWN_TOKEN_WARNING}`,
    ]);
  });

  it('warns when a wallet-only address is not the signer', () => {
    const from: Eip7730Field = {
      path: 'from',
      label: 'From',
      format: 'addressName',
      params: { types: ['wallet'] },
    };
    expect(show([from], { from: UNKNOWN }, RECIPIENT)).toEqual([
      `From: ${UNKNOWN}`,
      `  ! ${NOT_SIGNER_WARNING}`,
    ]);
  });

  it('keeps ENS off where the sources leave it out', () => {
    expect(
      show(
        [
          {
            path: 'spender',
            label: 'Spender',
            format: 'addressName',
            params: { sources: ['local'] },
          },
        ],
        { spender: USDT },
      ),
    ).toEqual([`Spender: ${USDT} (no ENS)`]);
  });

  it('shows the signer for a sender address', () => {
    const beneficiary: Eip7730Field = {
      path: 'beneficiary',
      label: 'Beneficiary',
      format: 'addressName',
      params: { senderAddress: ZERO },
    };
    expect(show([beneficiary], { beneficiary: ZERO }, RECIPIENT)).toEqual([
      `Beneficiary: ${RECIPIENT}`,
      `  (${SIGNER_CAPTION})`,
    ]);
    expect(kindsOf([beneficiary], { beneficiary: ZERO }, RECIPIENT)).toEqual([
      'address',
    ]);
  });

  it('says Sender when the request does not name its signer', () => {
    const [row] = displayDescriptor(
      descriptorFor(
        {
          fields: [
            {
              path: 'beneficiary',
              label: 'Beneficiary',
              format: 'addressName',
              params: { senderAddress: [ZERO] },
            },
          ],
        },
        { beneficiary: ZERO },
      ),
      { chainId: 1, contract: undefined, depth: 0 },
    ).nodes;
    expect(row).toEqual({
      kind: 'text',
      label: 'Beneficiary',
      value: SENDER_TEXT,
      warnings: [],
    });
  });

  it('names a token beside its address, or warns about one nothing knows', () => {
    const tokenField: Eip7730Field = {
      path: 'token',
      label: 'Token',
      format: 'tokenTicker',
    };
    expect(show([tokenField], { token: USDC })).toEqual([
      `Token: ${USDC} [USDC]`,
    ]);
    expect(kindsOf([tokenField], { token: USDC })).toEqual(['address']);
    expect(show([tokenField], { token: UNKNOWN })).toEqual([
      `Token: ${UNKNOWN}`,
      `  ! ${UNKNOWN_TOKEN_WARNING}`,
    ]);
  });

  it('shows an interoperable address as its name, as text with no ENS lookup', () => {
    const value = `0x00010000010114${RECIPIENT.slice(2).toLowerCase()}`;
    const [row] = displayDescriptor(
      descriptorFor(
        {
          fields: [
            { path: 'to', label: 'To', format: 'interoperableAddressName' },
          ],
        },
        { to: value },
      ),
      { chainId: 1, contract: undefined, depth: 0 },
    ).nodes;
    expect(row).toMatchObject({ kind: 'text', label: 'To' });
    expect(row.kind === 'text' && row.value).toMatch(
      new RegExp(`^${RECIPIENT}@eip155:1#[0-9A-F]{8}$`),
    );
  });

  it('names a chain from its ID', () => {
    expect(
      show([{ path: 'dst', label: 'Destination', format: 'chainId' }], {
        dst: 1n,
      }),
    ).toEqual(['Destination: Ethereum Mainnet']);
  });
});

describe('displayDescriptor: encrypted fields', () => {
  it('shows the placeholder and the ciphertext handle, never an amount', () => {
    expect(
      show(
        [
          {
            path: 'amount',
            label: 'Amount',
            format: 'tokenAmount',
            params: { token: USDC },
            encryption: {
              scheme: 'fhevm',
              fallbackLabel: '[Encrypted Amount]',
            },
          },
        ],
        { amount: HANDLE },
      ),
    ).toEqual([
      'Amount: [Encrypted Amount]',
      `${ENCRYPTED_VALUE_LABEL}: ${HANDLE}`,
    ]);
  });

  it('treats an encrypted address as a handle, not an address', () => {
    const nodes = displayDescriptor(
      descriptorFor(
        {
          fields: [
            { path: 'to', label: 'To', format: 'addressName', encryption: {} },
          ],
        },
        { to: HANDLE },
      ),
      { chainId: 1, contract: undefined, depth: 0 },
    ).nodes;
    expect(nodes.map(node => node.kind)).toEqual(['text', 'text']);
    expect(outline(nodes)[0]).toBe('To: [Encrypted]');
  });
});

describe('displayDescriptor: groups and separators', () => {
  const calls = [
    { to: USDT, value: 1n },
    { to: USDC, value: 2n },
  ];

  it("shows a group's label once, before its fields", () => {
    const group = { id: 0, label: 'Account action' };
    expect(
      show(
        [
          { path: 'calls.[].to', label: 'To', format: 'raw', group },
          { path: 'calls.[].value', label: 'Value', format: 'raw', group },
        ],
        { calls },
      ),
    ).toEqual([
      '# Account action',
      'Item 1 of 2',
      `  To: ${USDT}`,
      '  Value: 1',
      'Item 2 of 2',
      `  To: ${USDC}`,
      '  Value: 2',
    ]);
  });

  it('bundles different arrays by position in a bundled group', () => {
    const group = { id: 0, iteration: 'bundled' as const };
    expect(
      show(
        [
          { path: 'tokens.[]', label: 'Token', format: 'raw', group },
          { path: 'amounts.[]', label: 'Amount', format: 'raw', group },
        ],
        { tokens: ['a', 'b'], amounts: [1n, 2n] },
      ),
    ).toEqual([
      'Item 1 of 2',
      '  Token: a',
      '  Amount: 1',
      'Item 2 of 2',
      '  Token: b',
      '  Amount: 2',
    ]);
  });

  it('lists each array on its own in a sequential group', () => {
    const group = { id: 0, iteration: 'sequential' as const };
    expect(
      show(
        [
          { path: 'calls.[].to', label: 'To', format: 'raw', group },
          { path: 'calls.[].value', label: 'Value', format: 'raw', group },
        ],
        { calls },
      ),
    ).toEqual([
      'Item 1 of 2',
      `  To: ${USDT}`,
      'Item 2 of 2',
      `  To: ${USDC}`,
      'Item 1 of 2',
      '  Value: 1',
      'Item 2 of 2',
      '  Value: 2',
    ]);
  });

  const legs = (separator: string): Eip7730Field[] => [
    { path: 'legs.[]', label: 'Leg', format: 'raw', separator },
  ];

  it('titles each element with the separator, its index filled in', () => {
    expect(show(legs('Swap {index}:'), { legs: ['x', 'y'] })).toEqual([
      'Swap 0:',
      '  Leg: x',
      'Swap 1:',
      '  Leg: y',
    ]);
  });

  it('titles a single element too', () => {
    expect(show(legs('Swap {index}'), { legs: ['x'] })).toEqual([
      'Swap 0',
      '  Leg: x',
    ]);
  });

  it('falls back to the plain title for a separator naming anything else', () => {
    expect(show(legs('Swap {legs}'), { legs: ['x', 'y'] })[0]).toBe(
      'Item 1 of 2',
    );
  });
});

describe('displayDescriptor: values', () => {
  const TOKEN = '0x000000000000000000000000000000000000feed';
  const amountOf = (amount: bigint) => ({ to: RECIPIENT, amount });

  function rowsFor(
    format: Eip7730DisplayFormat,
    args: Record<string, unknown>,
    contract?: string,
    container?: { value?: string },
  ): string[] {
    return outline(
      displayDescriptor(
        descriptorFor(format, args, { to: contract, ...container }),
        { chainId: 1, contract, depth: 0 },
      ).nodes,
    );
  }

  it("formats an amount with the token the entry's own metadata names", () => {
    expect(
      rowsFor(
        {
          fields: [
            {
              path: 'amount',
              label: 'Amount',
              format: 'tokenAmount',
              params: { tokenPath: '@.to' },
            },
          ],
          metadata: { tokens: { '*': { decimals: 6, ticker: 'USDC' } } },
        },
        amountOf(1_500_000n),
        TOKEN,
      ),
    ).toEqual(['Amount: 1.5 USDC']);
  });

  it('warns when the token is unknown, both warnings for an unlimited amount', () => {
    const field: Eip7730Field = {
      path: 'amount',
      label: 'Amount',
      format: 'tokenAmount',
      params: { threshold: '1000' },
    };
    expect(rowsFor({ fields: [field] }, amountOf(5n), TOKEN)).toEqual([
      'Amount: 5',
      `  ! ${UNKNOWN_TOKEN_WARNING}`,
    ]);
    expect(
      rowsFor({ fields: [field] }, amountOf(2n ** 256n - 1n), TOKEN),
    ).toEqual([
      'Amount: Unlimited',
      `  ! ${UNLIMITED_APPROVAL_WARNING}`,
      `  ! ${UNKNOWN_TOKEN_WARNING}`,
    ]);
  });

  it('names an unknown token contract the descriptor points at, unless the review already shows it', () => {
    const format: Eip7730DisplayFormat = {
      fields: [
        {
          path: 'amount',
          label: 'Amount',
          format: 'tokenAmount',
          params: { token: UNKNOWN },
        },
      ],
    };
    const descriptor = descriptorFor(format, amountOf(7n));
    const at = (shownContract?: string) =>
      outline(
        displayDescriptor(descriptor, {
          chainId: 1,
          contract: undefined,
          depth: 0,
          shownContract,
        }).nodes,
      );
    expect(at()).toEqual([
      'Amount: 7',
      `  ! ${UNKNOWN_TOKEN_WARNING}`,
      `Token contract: ${UNKNOWN}`,
    ]);
    expect(at(UNKNOWN)).toEqual(['Amount: 7', `  ! ${UNKNOWN_TOKEN_WARNING}`]);
  });

  it('formats the transaction value from the container', () => {
    expect(
      rowsFor(
        { fields: [{ path: '@.value', label: 'Value', format: 'amount' }] },
        {},
        undefined,
        { value: '2000000000000000' },
      ),
    ).toEqual(['Value: 0.002 ETH']);
  });

  it('shows a fixed value without reading the call, and a dash for a path that resolves to nothing', () => {
    expect(
      rowsFor(
        {
          fields: [
            {
              path: '',
              label: 'Share ticker',
              format: 'raw',
              value: 'kmmUSDC',
            },
            { path: 'missingField', label: 'Missing', format: 'raw' },
          ],
        },
        {},
      ),
    ).toEqual(['Share ticker: kmmUSDC', 'Missing: —']);
  });

  it('leaves out the fields its visibility rules hide', () => {
    const format: Eip7730DisplayFormat = {
      fields: [
        {
          path: 'amount',
          label: 'Amount',
          format: 'raw',
          visible: { ifNotIn: ['0'] },
        },
        {
          path: 'to',
          label: 'To',
          format: 'raw',
          visible: { mustMatch: [RECIPIENT] },
        },
      ],
    };
    expect(rowsFor(format, amountOf(0n))).toEqual([]);
    expect(rowsFor(format, amountOf(5n))).toEqual(['Amount: 5']);
  });
});

describe('displayDescriptor: heading and lines', () => {
  const at = (format: Eip7730DisplayFormat, args: object, depth = 0) =>
    displayDescriptor(descriptorFor(format, { ...args }), {
      chainId: 1,
      contract: undefined,
      depth,
    });

  it('heads the entry with its sentence, or its intent when the sentence does not fill', () => {
    const format: Eip7730DisplayFormat = {
      intent: 'Send',
      interpolatedIntent: 'Send {amount} to {to}',
      fields: [
        { path: 'to', label: 'To', format: 'addressName' },
        { path: 'amount', label: 'Amount', format: 'raw' },
      ],
    };
    expect(at(format, { to: RECIPIENT, amount: 7n })).toMatchObject({
      heading: `Send 7 to ${RECIPIENT}`,
      interpolated: true,
    });
    expect(at(format, { amount: 7n })).toMatchObject({
      heading: 'Send',
      interpolated: false,
    });
  });

  it('says where the entry came from at the top level only, and who reviewed it at every level', () => {
    const reviewed: Eip7730DisplayFormat = {
      intent: 'Send',
      fields: [],
      reviewedBy: [CYFRIN],
    };
    expect(at(reviewed, {})).toMatchObject({
      source: true,
      review: 'Reviewed by Cyfrin',
    });
    expect(at({ intent: 'Send', fields: [] }, {}, 1)).toMatchObject({
      source: false,
      review: NOT_REVIEWED_TEXT,
    });
  });
});

describe('displayDescriptor: inner calls', () => {
  const callsField: Eip7730Field = {
    path: 'calls.[].data',
    label: 'Calls',
    format: 'calldata',
    params: { calleePath: 'calls.[].to', amountPath: 'calls.[].value' },
  };
  const unlimitedApprove = encode('approve(address spender, uint256 amount)', [
    RECIPIENT,
    2n ** 256n - 1n,
  ]);
  const unknownCall =
    '0xdeadbeef0000000000000000000000000000000000000000000000000000000000000001';

  function calls(
    field: Eip7730Field,
    args: Record<string, unknown>,
    depth = 0,
  ): string[] {
    return outline(
      displayDescriptor(
        descriptorFor({ fields: [field] }, args, { to: SOME_CONTRACT }),
        { chainId: 1, contract: SOME_CONTRACT, depth },
      ).nodes,
    );
  }

  it('shows every call, each with its entry, the app decoding or the raw call', () => {
    expect(
      calls(callsField, {
        calls: [
          { to: USDT, data: transfer, value: 0n },
          { to: OTHER_TOKEN, data: unlimitedApprove, value: 0n },
          { to: SOME_CONTRACT, data: unknownCall, value: 0n },
        ],
      }),
    ).toEqual([
      '# Calls',
      'Call 1 of 3',
      '  token USDT',
      `  Token contract: ${USDT}`,
      '  = Send',
      '  Amount: 1.5 USDT',
      `  To: ${RECIPIENT}`,
      'Call 2 of 3',
      '  # ERC-20 Approve',
      `  Token contract: ${checksumEthAddress(OTHER_TOKEN)}`,
      `  Spender: ${RECIPIENT}`,
      '  Allowance: Unlimited',
      `    ! ${UNLIMITED_APPROVAL_WARNING}`,
      'Call 3 of 3',
      `  Contract: ${SOME_CONTRACT}`,
      '  Contract call: 0xdeadbeef',
      `  Data: ${unknownCall}`,
    ]);
  });

  it('gives one callee to every call', () => {
    const field: Eip7730Field = {
      path: 'data.[]',
      label: 'Calls',
      format: 'calldata',
      params: { callee: USDT },
    };
    expect(
      calls(field, { data: [transfer, transfer] }).filter(l =>
        l.includes('= Send'),
      ),
    ).toHaveLength(2);
  });

  it("passes the call's amount to the inner entry as its @.value", () => {
    const deposit = encode(
      'depositETH(address lendingPool, address onBehalfOf, uint16 referralCode)',
      [AAVE_V2_POOL, RECIPIENT, 0],
    );
    const lines = calls(callsField, {
      calls: [{ to: AAVE_WETH_GATEWAY, data: deposit, value: 5n * 10n ** 17n }],
    });
    expect(lines).toContain('  Amount to supply: 0.5 ETH');
    expect(lines[1]).toBe('-');
  });

  it('pairs each call with its own callee, chain, amount, spender and selector', () => {
    const field: Eip7730Field = {
      path: 'calls.[].data',
      label: 'Calls',
      format: 'calldata',
      params: {
        calleePath: 'calls.[].to',
        amountPath: 'calls.[].value',
        spenderPath: 'calls.[].from',
        chainIdPath: 'calls.[].chain',
        selector: transfer.slice(0, 10),
      },
    };
    const args = `0x${transfer.slice(10)}`;
    const display = displayDescriptor(
      descriptorFor(
        { fields: [field] },
        {
          calls: [
            { to: USDT, data: args, value: 1n, from: RECIPIENT, chain: 10n },
            { to: USDC, data: transfer, value: 2n, from: UNKNOWN, chain: 1n },
          ],
        },
      ),
      { chainId: 1, contract: SOME_CONTRACT, depth: 1 },
    );
    const requests = display.nodes.flatMap(node =>
      node.kind === 'item' ? node.nodes : [],
    );
    expect(requests).toEqual([
      {
        kind: 'call',
        request: {
          chainId: 10,
          contract: USDT,
          data: transfer,
          from: RECIPIENT,
          value: '1',
          depth: 2,
        },
      },
      {
        kind: 'call',
        request: {
          chainId: 1,
          contract: USDC,
          data: transfer,
          from: UNKNOWN,
          value: '2',
          depth: 2,
        },
      },
    ]);
  });

  it('shows only the callee and the raw call past three levels', () => {
    expect(
      calls(
        callsField,
        { calls: [{ to: USDT, data: transfer, value: 0n }] },
        3,
      ),
    ).toEqual([
      '# Calls',
      '-',
      `  Contract: ${USDT}`,
      `  Contract call: ${transfer.slice(0, 10)}`,
      `  Data: ${transfer}`,
    ]);
  });

  it('shows a dash for a field that holds no calls, and reads a fixed call', () => {
    expect(calls(callsField, { calls: [] })).toEqual(['Calls: —']);
    const fixed: Eip7730Field = {
      path: '',
      label: 'Action',
      format: 'calldata',
      params: { callee: USDT },
      value: transfer,
    };
    expect(calls(fixed, {})).toContain('  = Send');
  });

  it("drops an inner call's entry when its mustMatch check fails, and says so", () => {
    const spy = jest.spyOn(eip7730Lookup, 'lookupCalldata').mockReturnValue({
      intent: 'Send',
      signature: 'transfer(address to, uint256 amount)',
      fields: [
        {
          path: 'to',
          label: 'To',
          format: 'raw',
          visible: { mustMatch: [USDT] },
        },
      ],
    });
    try {
      expect(
        calls(callsField, { calls: [{ to: USDT, data: transfer, value: 0n }] }),
      ).toEqual([
        '# Calls',
        '-',
        `  ! ${DESCRIPTOR_CHECK_FAILED_WARNING}`,
        '  # ERC-20 Transfer',
        '  token USDT',
        `  Token contract: ${USDT}`,
        `  Recipient: ${RECIPIENT}`,
        '  Amount: 1.5 USDT',
      ]);
    } finally {
      spy.mockRestore();
    }
  });

  it('says so above the raw call when nothing else knows it', () => {
    const spy = jest.spyOn(eip7730Lookup, 'lookupCalldata').mockReturnValue({
      intent: 'Poke',
      signature: 'poke(uint256 n)',
      fields: [
        { path: 'n', label: 'N', format: 'raw', visible: { mustMatch: ['2'] } },
      ],
    });
    try {
      const poke = encode('poke(uint256 n)', [1n]);
      expect(
        calls(callsField, {
          calls: [{ to: SOME_CONTRACT, data: poke, value: 0n }],
        }),
      ).toEqual([
        '# Calls',
        '-',
        `  ! ${DESCRIPTOR_CHECK_FAILED_WARNING}`,
        `  Contract: ${SOME_CONTRACT}`,
        `  Contract call: ${poke.slice(0, 10)}`,
        `  Data: ${poke}`,
      ]);
    } finally {
      spy.mockRestore();
    }
  });

  it('puts a selector given apart back in front of its arguments, and leaves data that has it alone', () => {
    const apart: Eip7730Field = {
      path: 'call',
      label: 'Call',
      format: 'calldata',
      params: { callee: USDT, selector: transfer.slice(0, 10) },
    };
    expect(calls(apart, { call: `0x${transfer.slice(10)}` })).toContain(
      '  Amount: 1.5 USDT',
    );
    const together: Eip7730Field = {
      path: 'call',
      label: 'Call',
      format: 'calldata',
      params: { callee: USDT, selectorPath: 'sel' },
    };
    expect(
      calls(together, { call: transfer, sel: transfer.slice(0, 10) }),
    ).toContain('  Amount: 1.5 USDT');
  });

  it('shows data that is not whole bytes as written, never decoded', () => {
    const odd = transfer.slice(0, -1);
    expect(
      calls(callsField, { calls: [{ to: USDT, data: odd, value: 0n }] }),
    ).toEqual(['# Calls', '-', `  Contract: ${USDT}`, `  Data: ${odd}`]);
  });

  it('shows a call with no data by its contract alone', () => {
    expect(
      calls(callsField, {
        calls: [{ to: SOME_CONTRACT, data: '0x', value: 5n }],
      }),
    ).toEqual(['# Calls', '-', `  Contract: ${SOME_CONTRACT}`, '  Data: —']);
  });

  it('keeps an array of inner calls alone as its list of calls, and puts each with the fields over its array', () => {
    const data: Eip7730Field = {
      path: 'calls.[].data',
      label: 'Call',
      format: 'calldata',
      params: { calleePath: 'calls.[].to', amountPath: 'calls.[].value' },
    };
    const twoCalls = {
      calls: [
        { to: USDT, value: 0n, data: transfer },
        { to: USDT, value: 5n, data: transfer },
      ],
    };
    const alone = calls(data, twoCalls);
    expect(alone.slice(0, 2)).toEqual(['# Call', 'Call 1 of 2']);
    expect(alone.some(line => line.includes('Item'))).toBe(false);

    const together = outline(
      displayDescriptor(
        descriptorFor(
          {
            fields: [
              { path: 'calls.[].value', label: 'Value', format: 'raw' },
              data,
            ],
          },
          twoCalls,
        ),
        { chainId: 1, contract: SOME_CONTRACT, depth: 0 },
      ).nodes,
    );
    expect(together.slice(0, 4)).toEqual([
      'Item 1 of 2',
      '  Value: 0',
      '  # Call',
      '  -',
    ]);
    expect(together.filter(line => line.endsWith('= Send'))).toHaveLength(2);
    expect(together.some(line => line.includes('Call 1 of'))).toBe(false);
  });
});

describe('displayCallSection', () => {
  const place = (contract: string) => ({ chainId: 1, contract, depth: 0 });
  const section = (contract: string, data: string) =>
    outline(
      displayCallSection(
        now(describeCall({ ...place(contract), data })),
        place(contract),
      ),
    );
  // An entry that reads its token from the contract it is called on.
  const amountAtTo = (signature: string) => ({
    intent: 'Approve',
    signature,
    fields: [
      {
        path: 'amount',
        label: 'Amount',
        format: 'tokenAmount' as const,
        params: { tokenPath: '@.to' },
      },
    ],
  });

  afterEach(() => jest.restoreAllMocks());

  it("puts a token call's own rows above the registry's entry", () => {
    expect(section(USDT.toLowerCase(), transfer)).toEqual([
      'token USDT',
      `Token contract: ${USDT}`,
      '= Send',
      'Amount: 1.5 USDT',
      `To: ${RECIPIENT}`,
    ]);
  });

  it('names an unknown token contract once on a token call', () => {
    jest
      .spyOn(eip7730Lookup, 'lookupCalldata')
      .mockReturnValue(amountAtTo('approve(address spender, uint256 amount)'));
    const lines = section(
      UNKNOWN,
      encode('approve(address spender, uint256 amount)', [RECIPIENT, 7n]),
    );
    expect(lines).toEqual([
      `Token contract: ${UNKNOWN}`,
      '= Approve',
      'Amount: 7',
      `  ! ${UNKNOWN_TOKEN_WARNING}`,
    ]);
  });

  it("keeps the entry's own token contract row on any other call", () => {
    const signature = 'keycardPalPull(uint256 amount)';
    jest
      .spyOn(eip7730Lookup, 'lookupCalldata')
      .mockReturnValue(amountAtTo(signature));
    expect(section(UNKNOWN, encode(signature, [7n]))).toEqual([
      '= Approve',
      'Amount: 7',
      `  ! ${UNKNOWN_TOKEN_WARNING}`,
      `Token contract: ${UNKNOWN}`,
    ]);
  });

  it("shows the app's own section when no entry describes the call, and nothing for a call shown as written", () => {
    expect(
      section(
        UNKNOWN,
        encode('transfer(address to, uint256 amount)', [RECIPIENT, 7n]),
      ),
    ).toEqual([
      '# ERC-20 Transfer',
      `Token contract: ${UNKNOWN}`,
      `Recipient: ${RECIPIENT}`,
      'Amount (raw units): 7',
    ]);
    expect(section(UNKNOWN, '0xdeadbeef')).toEqual([]);
  });
});

describe('displayDecodedCall', () => {
  it('lists a transferFrom with both addresses, in raw units for a token nothing knows', () => {
    expect(
      outline(
        displayDecodedCall(
          {
            kind: 'erc20-transferFrom',
            from: UNKNOWN,
            to: RECIPIENT,
            amount: 5n,
          },
          UNKNOWN,
          1,
        ),
      ),
    ).toEqual([
      '# ERC-20 Transfer From',
      `Token contract: ${UNKNOWN}`,
      `From: ${UNKNOWN}`,
      `Recipient: ${RECIPIENT}`,
      'Amount (raw units): 5',
    ]);
  });

  it('names a known token in an approval, unlimited or not', () => {
    const approve = (amount: bigint) =>
      outline(
        displayDecodedCall(
          { kind: 'erc20-approve', spender: RECIPIENT, amount },
          USDT,
          1,
        ),
      );
    expect(approve(2n ** 256n - 1n)).toEqual([
      '# ERC-20 Approve',
      'token USDT',
      `Token contract: ${USDT}`,
      `Spender: ${RECIPIENT}`,
      'Allowance: Unlimited USDT',
      `  ! ${UNLIMITED_APPROVAL_WARNING}`,
    ]);
    expect(approve(1_500_000n).slice(-1)).toEqual(['Allowance: 1.5 USDT']);
  });

  it('lists a contract call with its arguments, an address as an address row, and warns about a high-risk one', () => {
    const nodes = displayDecodedCall(
      {
        kind: 'contract-call',
        selector: '0xa22cb465',
        functionName: 'setApprovalForAll',
        signature: 'setApprovalForAll(address,bool)',
        args: [
          { name: 'operator', type: 'address', value: RECIPIENT },
          { name: 'approved', type: 'bool', value: 'true' },
        ],
        highRisk: true,
      },
      UNKNOWN,
      1,
    );
    expect(outline(nodes)).toEqual([
      '# Contract Call',
      'Function: setApprovalForAll(address,bool)',
      `operator (address): ${RECIPIENT}`,
      'approved (bool): true',
      '! High-risk approval: review this contract permission carefully',
    ]);
    expect(nodes.map(node => node.kind)).toEqual([
      'section',
      'text',
      'address',
      'text',
      'warning',
    ]);
  });

  it('keeps each Universal Router command with its arguments in one group', () => {
    expect(
      outline(
        displayDecodedCall(
          {
            kind: 'universal-router-execute',
            deadline: '1800000000',
            error: 'Commands and inputs differ in length',
            commands: [
              {
                index: 0,
                command: '0x0b',
                name: 'Wrap ETH',
                allowRevert: true,
                args: [
                  { name: 'recipient', type: 'address', value: RECIPIENT },
                ],
              },
              {
                index: 1,
                command: '0x21',
                name: 'Unknown',
                allowRevert: false,
                args: [],
                error: 'Unsupported command',
                rawInput: '0xdead',
              },
            ],
          },
          undefined,
          1,
        ),
      ),
    ).toEqual([
      '# Uniswap Universal Router',
      'Deadline: 1800000000',
      '! Commands and inputs differ in length',
      'group',
      '  Command 1: Wrap ETH (allow revert)',
      `  recipient (address): ${RECIPIENT}`,
      'group',
      '  Command 2: Unknown',
      '  Decode: Unsupported command',
      '  Input: 0xdead',
    ]);
  });

  it('names a selector nothing decodes', () => {
    expect(
      outline(
        displayDecodedCall(
          { kind: 'unknown-call', selector: '0xdeadbeef' },
          undefined,
          1,
        ),
      ),
    ).toEqual(['Contract call: 0xdeadbeef']);
  });
});

describe('displayMessage', () => {
  const ORDER_TYPES = {
    Order: [
      { name: 'maker', type: 'address' },
      { name: 'takers', type: 'address[]' },
      { name: 'note', type: 'string' },
      { name: 'amount', type: 'uint256' },
    ],
  };
  const message = {
    maker: MISCASED,
    takers: [RECIPIENT, MISCASED],
    note: MISCASED,
    amount: '7',
  };
  const descriptor = (fields: Eip7730Field[]): MatchedDescriptor => ({
    format: { intent: 'Fill', fields },
    ...buildEip712Resolvers({
      primaryType: 'Order',
      types: ORDER_TYPES,
      message,
    }),
  });
  const domain = { chainId: 1, verifyingContract: UNKNOWN };

  it('warns under a field holding an address the request wrote with a wrong checksum', () => {
    const display = displayMessage(
      descriptor([
        { path: 'maker', label: 'Maker', format: 'addressName' },
        { path: 'takers.[]', label: 'Taker', format: 'raw' },
        { path: 'note', label: 'Note', format: 'raw' },
        { path: 'maker', value: MISCASED, label: 'Fixed', format: 'raw' },
      ]),
      domain,
    );
    // The maker and the second taker; never the string or the descriptor's constant.
    expect(outline(display.nodes)).toEqual([
      `# ${MESSAGE_SECTION}`,
      `Maker: ${RECIPIENT}`,
      `  ! ${MISCASED_ADDRESS_WARNING}`,
      'Item 1 of 2',
      `  Taker: ${RECIPIENT}`,
      'Item 2 of 2',
      `  Taker: ${RECIPIENT}`,
      `    ! ${MISCASED_ADDRESS_WARNING}`,
      `Note: ${MISCASED}`,
      `Fixed: ${MISCASED}`,
    ]);
  });

  it('heads the fields with Message only when one shows', () => {
    const hidden: Eip7730Field = {
      path: 'amount',
      label: 'Amount',
      format: 'raw',
      visible: { ifNotIn: ['7'] },
    };
    expect(displayMessage(descriptor([hidden]), domain).nodes).toEqual([]);
  });

  it('does not repeat the verifying contract as an unknown token contract', () => {
    const amount: Eip7730Field = {
      path: 'amount',
      label: 'Amount',
      format: 'tokenAmount',
      params: { token: UNKNOWN },
    };
    expect(outline(displayMessage(descriptor([amount]), domain).nodes)).toEqual(
      [`# ${MESSAGE_SECTION}`, 'Amount: 7', `  ! ${UNKNOWN_TOKEN_WARNING}`],
    );
  });
});
