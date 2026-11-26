import { readFileSync } from 'fs';
import { join } from 'path';
import { strToU8, zipSync } from 'fflate';

import {
  buildIndexFromDescriptors,
  EIP7730_INDEX_VERSION,
  indexedFormat,
  interpolationParts,
  isEmptyIndex,
  processRegistryZip,
  sliceIndex,
  sliceName,
} from '../src/utils/eip7730/zip';

import { nested } from './eip7730Index.testUtils';

const SCHEMA = 'specs/erc7730-v2.schema.json';

function rawZip(files: Record<string, unknown>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    entries[name] =
      typeof content === 'string'
        ? strToU8(content)
        : strToU8(JSON.stringify(content));
  }
  return zipSync(entries);
}

// Gives every descriptor a `$schema` pointing at a v2 schema file, as the registry does.
function makeZip(files: Record<string, unknown>): Uint8Array {
  const withSchema: Record<string, unknown> = {
    [SCHEMA]: { version: '2.1.0' },
  };
  for (const [name, content] of Object.entries(files)) {
    const isDescriptor =
      typeof content === 'object' &&
      content !== null &&
      !('$schema' in content);
    withSchema[name] = isDescriptor
      ? {
          $schema: `${'../'.repeat(name.split('/').length - 1)}${SCHEMA}`,
          ...content,
        }
      : content;
  }
  return rawZip(withSchema);
}

const usdcContractDescriptor = {
  context: {
    contract: {
      deployments: [
        { chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
        { chainId: 137, address: '0xAAAAA1234567890aabBccDdEeFf0011223344556' },
      ],
    },
  },
  metadata: {
    token: {
      ticker: 'USDC',
      decimals: 6,
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    },
    info: { legalName: 'Circle Internet Financial' },
  },
  display: {
    formats: {
      '0xa9059cbb': {
        intent: 'Send USDC',
        fields: [
          { path: 'to', label: 'To', format: 'addressName' },
          {
            path: 'amount',
            label: 'Amount',
            format: 'tokenAmount',
            params: { tokenPath: '@.to' },
          },
        ],
      },
      'transferFrom(address,address,uint256)': {
        intent: 'Pull USDC',
        fields: [{ path: 'from', label: 'From', format: 'addressName' }],
      },
    },
  },
};

const PERMIT_TYPE = 'Permit(address spender,uint256 value)';

const permitEip712Descriptor = {
  context: {
    eip712: {
      deployments: [
        { chainId: 1, address: '0x000000000022D473030F116dDEE9F6B43aC78BA3' },
      ],
    },
  },
  display: {
    formats: {
      [PERMIT_TYPE]: {
        intent: 'Sign permit',
        fields: [{ path: 'spender', label: 'Spender', format: 'addressName' }],
      },
    },
  },
};

const garbageDescriptor = {
  context: { something: 'else' },
  display: {},
};

describe('processRegistryZip', () => {
  it('indexes calldata descriptors by chainId:address with normalised selector', () => {
    const zip = makeZip({ 'registry/usdc.json': usdcContractDescriptor });
    const index = processRegistryZip(zip);
    expect(index.version).toBe(EIP7730_INDEX_VERSION);
    const mainnetKey = '1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    expect(nested(index).contracts[mainnetKey]).toBeDefined();
    expect(nested(index).contracts[mainnetKey]['0xa9059cbb']).toBeDefined();
    expect(nested(index).contracts[mainnetKey]['0xa9059cbb'].intent).toBe(
      'Send USDC',
    );
    expect(
      nested(index).contracts[mainnetKey]['0xa9059cbb'].fields,
    ).toHaveLength(2);
  });

  it('normalises full signatures to 4-byte selectors', () => {
    const zip = makeZip({ 'registry/usdc.json': usdcContractDescriptor });
    const index = processRegistryZip(zip);
    const mainnetKey = '1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    // transferFrom selector
    expect(nested(index).contracts[mainnetKey]['0x23b872dd']).toBeDefined();
    expect(nested(index).contracts[mainnetKey]['0x23b872dd'].intent).toBe(
      'Pull USDC',
    );
  });

  it('inserts an entry for every deployment', () => {
    const zip = makeZip({ 'registry/usdc.json': usdcContractDescriptor });
    const index = processRegistryZip(zip);
    expect(
      nested(index).contracts['137:0xaaaaa1234567890aabbccddeeff0011223344556'][
        '0xa9059cbb'
      ],
    ).toBeDefined();
  });

  it('indexes EIP-712 descriptors by chainId:address and encodeType', () => {
    const zip = makeZip({ 'registry/permit.json': permitEip712Descriptor });
    const index = processRegistryZip(zip);
    const key = '1:0x000000000022d473030f116ddee9f6b43ac78ba3';
    expect(nested(index).eip712[key][PERMIT_TYPE].intent).toBe('Sign permit');
    expect(nested(index).eip712[key][PERMIT_TYPE].fields[0].path).toBe(
      'spender',
    );
  });

  it('stores the EIP-712 domain constraint on every format', () => {
    const zip = makeZip({
      'registry/permit.json': {
        ...permitEip712Descriptor,
        context: {
          eip712: {
            ...permitEip712Descriptor.context.eip712,
            domain: { name: 'Permit2', chainId: 1, nested: { x: 1 } },
          },
        },
      },
    });
    const index = processRegistryZip(zip);
    const key = '1:0x000000000022d473030f116ddee9f6b43ac78ba3';
    expect(nested(index).eip712[key][PERMIT_TYPE].domain).toEqual({
      name: 'Permit2',
      chainId: '1',
    });
  });

  it('leaves the domain out when the descriptor has none', () => {
    const index = processRegistryZip(
      makeZip({ 'registry/permit.json': permitEip712Descriptor }),
    );
    const key = '1:0x000000000022d473030f116ddee9f6b43ac78ba3';
    expect(nested(index).eip712[key][PERMIT_TYPE].domain).toBeUndefined();
  });

  it('skips an EIP-712 descriptor bound by a domain separator', () => {
    const zip = makeZip({
      'registry/permit.json': {
        ...permitEip712Descriptor,
        context: {
          eip712: {
            ...permitEip712Descriptor.context.eip712,
            domainSeparator: `0x${'ab'.repeat(32)}`,
          },
        },
      },
    });
    expect(processRegistryZip(zip).eip712).toEqual({});
  });

  it('keeps string enum entries and drops the rest', () => {
    const index = processRegistryZip(
      makeZip({
        'registry/usdc.json': {
          ...usdcContractDescriptor,
          metadata: {
            enums: {
              rate: { 1: 'stable', 2: 'variable', 3: 7 },
              broken: 'not a map',
            },
          },
        },
      }),
    );
    const entry =
      nested(index).contracts['1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'][
        '0xa9059cbb'
      ];
    expect(entry.metadata?.enums).toEqual({
      rate: { 1: 'stable', 2: 'variable' },
    });
  });

  it('skips a format key that is neither a selector nor a signature', () => {
    const index = processRegistryZip(
      makeZip({
        'registry/usdc.json': {
          ...usdcContractDescriptor,
          display: {
            formats: {
              'not a signature': { intent: 'Never', fields: [] },
            },
          },
        },
      }),
    );
    expect(index.contracts).toEqual({});
  });

  it('skips a .json file that is not valid JSON', () => {
    const index = processRegistryZip(
      makeZip({
        'registry/broken.json': '{ not json',
        'registry/usdc.json': usdcContractDescriptor,
      }),
    );
    expect(
      nested(index).contracts['1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'],
    ).toBeDefined();
  });

  it('tolerates malformed fields, deployments and metadata', () => {
    const index = buildIndexFromDescriptors([
      {
        context: {
          contract: {
            deployments: [
              'not an object',
              {
                chainId: '10',
                address: '0x00000000000000000000000000000000000000aa',
              },
              { chainId: 1 },
              {
                chainId: 'x',
                address: '0x00000000000000000000000000000000000000bb',
              },
            ],
          },
        },
        metadata: { token: { decimals: 18 }, info: { legalName: 7 } },
        display: {
          formats: {
            '0xa9059cbb': {
              fields: [
                'not an object',
                { path: 'to', format: 'raw' },
                { path: 'amount', label: 'Amount' },
                { path: 'x', label: 'X', format: 'raw', params: 'bad' },
              ],
            },
            '0x095ea7b3': { fields: [] },
          },
        },
      },
    ]);
    const formats =
      nested(index).contracts['10:0x00000000000000000000000000000000000000aa'];
    expect(Object.keys(nested(index).contracts)).toEqual([
      '10:0x00000000000000000000000000000000000000aa',
    ]);
    expect(formats['0x095ea7b3']).toBeUndefined();
    expect(formats['0xa9059cbb'].fields).toEqual([
      { path: 'to', label: 'to', format: 'raw', params: undefined },
      { path: 'x', label: 'X', format: 'raw', params: undefined },
    ]);
    expect(formats['0xa9059cbb'].metadata).toEqual({
      tokens: { '*': { decimals: 18, ticker: undefined } },
    });
  });

  it('skips descriptors without deployments or formats', () => {
    const index = buildIndexFromDescriptors([
      'not an object',
      { context: { contract: { deployments: [] } }, display: { formats: {} } },
      { context: { eip712: {} }, display: { formats: { A: { intent: 'a' } } } },
      { context: { contract: {} }, display: { notFormats: true } },
      { context: { other: {} }, display: { formats: { A: { intent: 'a' } } } },
    ]);
    expect(index.contracts).toEqual({});
    expect(index.eip712).toEqual({});
  });

  it('silently skips descriptors without context/display', () => {
    const zip = makeZip({
      'registry/garbage.json': garbageDescriptor,
      'registry/usdc.json': usdcContractDescriptor,
    });
    const index = processRegistryZip(zip);
    expect(Object.keys(index.contracts).length).toBeGreaterThan(0);
  });

  it('skips non-JSON files inside the zip', () => {
    const zip = makeZip({
      'registry/README.md': '# not a descriptor',
      'registry/usdc.json': usdcContractDescriptor,
    });
    const index = processRegistryZip(zip);
    expect(
      nested(index).contracts['1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'],
    ).toBeDefined();
  });

  it('captures token metadata for tokenAmount formatting', () => {
    const zip = makeZip({ 'registry/usdc.json': usdcContractDescriptor });
    const index = processRegistryZip(zip);
    const entry =
      nested(index).contracts['1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'][
        '0xa9059cbb'
      ];
    expect(entry.metadata?.tokens).toBeDefined();
    expect(entry.metadata?.tokens).toEqual({
      '*': { decimals: 6, ticker: 'USDC' },
    });
  });
});

describe('buildIndexFromDescriptors', () => {
  it('returns an index with the current version + ISO timestamp', () => {
    const index = buildIndexFromDescriptors([]);
    expect(index.version).toBe(EIP7730_INDEX_VERSION);
    expect(() => new Date(index.generatedAt).toISOString()).not.toThrow();
    expect(index.contracts).toEqual({});
    expect(index.eip712).toEqual({});
  });
});

const ADDR = '0x00000000000000000000000000000000000000aa';
const KEY = `1:${ADDR}`;
const TRANSFER = 'transfer(address to,uint256 amount)';
const TRANSFER_SELECTOR = '0xa9059cbb';

function contract(extra: Record<string, unknown> = {}) {
  return {
    context: { contract: { deployments: [{ chainId: 1, address: ADDR }] } },
    ...extra,
  };
}

function transferFormat(
  fields: unknown[],
  extra: Record<string, unknown> = {},
) {
  return {
    display: { formats: { [TRANSFER]: { intent: 'Send', fields } }, ...extra },
  };
}

function fieldsOf(files: Record<string, unknown>) {
  const index = processRegistryZip(makeZip(files));
  return nested(index).contracts[KEY]?.[TRANSFER_SELECTOR]?.fields;
}

describe('schema version', () => {
  const descriptor = {
    ...contract(),
    ...transferFormat([{ path: 'to', label: 'To', format: 'raw' }]),
  };
  const schemaFile = (version: string) => ({ [SCHEMA]: { version } });

  it.each(['2.0.0', '2.1.0', '2.9.3'])('accepts schema %s', version => {
    const index = processRegistryZip(
      rawZip({
        ...schemaFile(version),
        'registry/a.json': { $schema: `../${SCHEMA}`, ...descriptor },
      }),
    );
    expect(nested(index).contracts[KEY]).toBeDefined();
  });

  it.each(['1.0.0', '3.0.0-next', '3.0.0'])('rejects schema %s', version => {
    const index = processRegistryZip(
      rawZip({
        ...schemaFile(version),
        'registry/a.json': { $schema: `../${SCHEMA}`, ...descriptor },
      }),
    );
    expect(index.contracts).toEqual({});
  });

  it('rejects a descriptor without a $schema, or whose schema is missing or unversioned', () => {
    const index = processRegistryZip(
      rawZip({
        [SCHEMA]: { title: 'no version key' },
        'registry/none.json': descriptor,
        'registry/missing.json': {
          $schema: '../specs/gone.json',
          ...descriptor,
        },
        'registry/unversioned.json': { $schema: `../${SCHEMA}`, ...descriptor },
      }),
    );
    expect(index.contracts).toEqual({});
  });

  it('finds a schema given as a URL in the zip specs folder', () => {
    const index = processRegistryZip(
      rawZip({
        'repo/specs/erc7730-v2.schema.json': { version: '2.1.0' },
        'repo/registry/a.json': {
          $schema:
            'https://eips.ethereum.org/assets/eip-7730/erc7730-v2.schema.json',
          ...descriptor,
        },
      }),
    );
    expect(nested(index).contracts[KEY]).toBeDefined();
  });
});

describe('which files are descriptors', () => {
  const descriptor = {
    ...contract(),
    ...transferFormat([{ path: 'to', label: 'To', format: 'raw' }]),
  };

  it('reads registry/ and ercs/, ignoring tests, specs and other folders', () => {
    for (const name of [
      'registry/acme/tests/a.json',
      'registry/acme/testsv2/a.json',
      'specs/templates/a.json',
      'tools/a.json',
      'a.json',
    ]) {
      expect(
        processRegistryZip(makeZip({ [name]: descriptor })).contracts,
      ).toEqual({});
    }
    expect(
      nested(processRegistryZip(makeZip({ 'ercs/a.json': descriptor })))
        .contracts[KEY],
    ).toBeDefined();
  });
});

describe('includes', () => {
  it('merges the real kiln chain: vault, kiln common file, ERC-4626 interface', () => {
    const root = 'clear-signing-erc7730-registry-master';
    const fixtures = join(__dirname, 'fixtures', 'eip7730');
    const file = (path: string) => readFileSync(join(fixtures, path), 'utf8');
    const index = processRegistryZip(
      rawZip({
        [`${root}/specs/erc7730-v2.schema.json`]: { version: '2.1.0' },
        [`${root}/registry/kiln/calldata-Vault-USDC-Morpho-MEV-Capital.json`]:
          file('registry/kiln/calldata-Vault-USDC-Morpho-MEV-Capital.json'),
        [`${root}/registry/kiln/common-KilnVaults.json`]: file(
          'registry/kiln/common-KilnVaults.json',
        ),
        [`${root}/ercs/calldata-erc4626-vaults.json`]: file(
          'ercs/calldata-erc4626-vaults.json',
        ),
      }),
    );
    const vault =
      nested(index).contracts['1:0x2a4e2dacc45186bed96d9f766cb6be6b0f8a26f1'];
    expect(Object.keys(vault)).toHaveLength(4);
    const deposit = Object.values(vault).find(f => f.intent === 'Deposit')!;
    expect(deposit.fields).toEqual([
      {
        path: 'assets',
        label: 'Deposit asset',
        format: 'tokenAmount',
        params: { token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
      },
      { path: '', label: 'Share ticker', format: 'raw', value: 'kmmUSDC' },
      {
        path: 'receiver',
        label: 'Send shares to',
        format: 'addressName',
        params: { types: ['eoa', 'contract'] },
      },
    ]);
  });

  const included = {
    metadata: { owner: 'Base', info: { legalName: 'Base Inc' } },
    ...transferFormat([
      {
        path: 'amount',
        label: 'Amount',
        format: 'tokenAmount',
        params: { tokenPath: '@.to', threshold: '0xff', message: 'Unlimited' },
      },
      { label: 'Note', format: 'raw', value: 'fixed' },
      { path: 'to', label: 'To', format: 'addressName' },
    ]),
  };

  it('lets the including file win and merges a field override param by param', () => {
    const fields = fieldsOf({
      'registry/acme/base.json': included,
      'registry/acme/token.json': {
        includes: 'base.json',
        ...contract(),
        metadata: { info: { legalName: 'Acme' } },
        ...transferFormat([
          { path: 'amount', params: { threshold: '0xffff' } },
          { path: 'memo', label: 'Memo', format: 'raw' },
        ]),
      },
    });
    expect(fields).toEqual([
      {
        path: 'amount',
        label: 'Amount',
        format: 'tokenAmount',
        params: {
          tokenPath: '@.to',
          threshold: '0xffff',
          message: 'Unlimited',
        },
      },
      { path: '', label: 'Note', format: 'raw', value: 'fixed' },
      { path: 'to', label: 'To', format: 'addressName' },
      { path: 'memo', label: 'Memo', format: 'raw' },
    ]);
    const index = processRegistryZip(
      makeZip({
        'registry/acme/base.json': included,
        'registry/acme/token.json': { includes: 'base.json', ...contract() },
      }),
    );
    expect(
      nested(index).contracts[KEY][TRANSFER_SELECTOR].metadata?.owner,
    ).toBe('Base Inc');
  });

  it('skips a descriptor whose include is missing or circular', () => {
    expect(
      fieldsOf({
        'registry/a.json': {
          includes: 'gone.json',
          ...contract(),
          ...included,
        },
      }),
    ).toBeUndefined();
    expect(
      fieldsOf({
        'registry/a.json': { includes: 'b.json', ...contract() },
        'registry/b.json': { includes: 'a.json', ...included },
      }),
    ).toBeUndefined();
  });
});

describe('field expansion', () => {
  it('fills a field from its definition, the field winning', () => {
    const fields = fieldsOf({
      'registry/a.json': {
        ...contract(),
        ...transferFormat(
          [
            {
              path: 'amount',
              $ref: '$.display.definitions.amount',
              params: { message: 'All' },
            },
            { path: 'to', $ref: '$.display.definitions.missing' },
          ],
          {
            definitions: {
              amount: {
                label: 'Amount',
                format: 'tokenAmount',
                params: { tokenPath: '@.to', message: 'Unlimited' },
              },
            },
          },
        ),
      },
    });
    expect(fields).toEqual([
      {
        path: 'amount',
        label: 'Amount',
        format: 'tokenAmount',
        params: { tokenPath: '@.to', message: 'All' },
      },
    ]);
  });

  it('flattens groups, prefixing relative paths only', () => {
    const fields = fieldsOf({
      'registry/a.json': {
        ...contract(),
        ...transferFormat([
          {
            path: 'order',
            label: 'Order',
            fields: [
              { path: 'amount', label: 'Amount', format: 'raw' },
              { path: '@.to', label: 'Contract', format: 'raw' },
              { fields: [{ path: 'maker', label: 'Maker', format: 'raw' }] },
            ],
          },
          { fields: [{ path: 'to', label: 'To', format: 'raw' }] },
        ]),
      },
    });
    expect(fields?.map(f => f.path)).toEqual([
      'order.amount',
      '@.to',
      'order.maker',
      'to',
    ]);
  });

  it("reads a group's relative param paths inside the group", () => {
    const fields = fieldsOf({
      'registry/a.json': {
        ...contract(),
        ...transferFormat([
          {
            path: '#.uniData',
            fields: [
              {
                path: 'fromAmount',
                label: 'Amount',
                format: 'tokenAmount',
                params: {
                  tokenPath: 'srcToken',
                  threshold: '0xff',
                  message: 'All',
                },
              },
              {
                path: 'toAmount',
                label: 'Min',
                format: 'tokenAmount',
                params: { tokenPath: '@.to' },
              },
            ],
          },
          {
            path: 'top',
            label: 'Top',
            format: 'tokenAmount',
            params: { tokenPath: 'token' },
          },
        ]),
      },
    });
    expect(fields?.map(f => f.params)).toEqual([
      { tokenPath: '#.uniData.srcToken', threshold: '0xff', message: 'All' },
      { tokenPath: '@.to' },
      { tokenPath: 'token' },
    ]);
  });

  it('substitutes constants in params and values', () => {
    const fields = fieldsOf({
      'registry/a.json': {
        ...contract(),
        metadata: {
          constants: {
            usdc: '0xusdc',
            eth: '0xeth',
            max: '0xff',
            name: 'kUSDC',
            n: 7,
          },
        },
        ...transferFormat([
          {
            path: 'amount',
            label: 'Amount',
            format: 'tokenAmount',
            params: {
              token: '$.metadata.constants.usdc',
              nativeCurrencyAddress: ['$.metadata.constants.eth', '0xother'],
              threshold: '$.metadata.constants.max',
              base: '$.metadata.constants.unknown',
            },
          },
          {
            label: 'Ticker',
            format: 'raw',
            value: '$.metadata.constants.name',
          },
          { label: 'Count', format: 'raw', value: '$.metadata.constants.n' },
          {
            label: 'Gone',
            format: 'raw',
            value: '$.metadata.constants.unknown',
          },
        ]),
      },
    });
    expect(fields).toEqual([
      {
        path: 'amount',
        label: 'Amount',
        format: 'tokenAmount',
        params: {
          token: '0xusdc',
          nativeCurrencyAddress: ['0xeth', '0xother'],
          threshold: '0xff',
          base: '$.metadata.constants.unknown',
        },
      },
      { path: '', label: 'Ticker', format: 'raw', value: 'kUSDC' },
      { path: '', label: 'Count', format: 'raw', value: '7' },
    ]);
  });

  it('drops never-visible fields and keeps mustMatch and ifNotIn ones', () => {
    const fields = fieldsOf({
      'registry/a.json': {
        ...contract(),
        ...transferFormat([
          { path: 'a', label: 'A', format: 'raw', visible: 'never' },
          {
            path: 'b',
            label: 'B',
            format: 'raw',
            visible: { mustMatch: ['0x0'] },
          },
          { path: 'c', label: 'C', format: 'raw', visible: { ifNotIn: ['0'] } },
          { path: 'd', label: 'D', format: 'raw', visible: 'optional' },
        ]),
      },
    });
    expect(fields?.map(f => f.path)).toEqual(['b', 'c', 'd']);
    expect(fields?.map(f => f.visible)).toEqual([
      { mustMatch: ['0x0'] },
      { ifNotIn: ['0'] },
      undefined,
    ]);
  });

  it('keeps list entries as text, once each, constants substituted', () => {
    const fields = fieldsOf({
      'registry/a.json': {
        ...contract(),
        metadata: { constants: { zero: 0 } },
        ...transferFormat([
          {
            path: 'a',
            label: 'A',
            format: 'raw',
            visible: { ifNotIn: [0, '0', true, { x: 1 }, null] },
          },
          {
            path: 'b',
            label: 'B',
            format: 'raw',
            visible: { mustMatch: ['$.metadata.constants.zero', 1] },
          },
        ]),
      },
    });
    expect(fields?.map(f => f.visible)).toEqual([
      { ifNotIn: ['0', 'true'] },
      { mustMatch: ['0', '1'] },
    ]);
  });

  it('keeps a mustMatch field without a format, to check it', () => {
    const fields = fieldsOf({
      'registry/a.json': {
        ...contract(),
        ...transferFormat([
          { path: 'op', visible: { mustMatch: [0] } },
          { path: 'other', visible: { ifNotIn: [0] } },
        ]),
      },
    });
    expect(fields).toEqual([
      { path: 'op', label: 'op', format: 'raw', visible: { mustMatch: ['0'] } },
    ]);
  });

  it('fails a mustMatch list it cannot read closed and ignores unknown rules', () => {
    const fields = fieldsOf({
      'registry/a.json': {
        ...contract(),
        ...transferFormat([
          { path: 'a', label: 'A', format: 'raw', visible: { mustMatch: 0 } },
          { path: 'b', label: 'B', format: 'raw', visible: { future: [0] } },
        ]),
      },
    });
    expect(fields?.map(f => f.visible)).toEqual([{ mustMatch: [] }, undefined]);
  });
});

describe('encryption, separators and groups', () => {
  it('keeps encryption from a definition, its strings only', () => {
    const fields = fieldsOf({
      'registry/a.json': {
        ...contract(),
        ...transferFormat(
          [
            { path: 'amount', $ref: '$.display.definitions.secret' },
            {
              path: 'to',
              label: 'To',
              format: 'raw',
              encryption: { scheme: 7, fallbackLabel: '[Hidden]' },
            },
            { path: 'memo', label: 'Memo', format: 'raw', encryption: 'yes' },
          ],
          {
            definitions: {
              secret: {
                label: 'Amount',
                format: 'tokenAmount',
                encryption: {
                  scheme: 'fhevm',
                  plaintextType: 'uint64',
                  fallbackLabel: '[Encrypted Amount]',
                },
              },
            },
          },
        ),
      },
    });
    expect(fields?.map(f => f.encryption)).toEqual([
      {
        scheme: 'fhevm',
        plaintextType: 'uint64',
        fallbackLabel: '[Encrypted Amount]',
      },
      { fallbackLabel: '[Hidden]' },
      undefined,
    ]);
  });

  it('keeps a string separator', () => {
    const fields = fieldsOf({
      'registry/a.json': {
        ...contract(),
        ...transferFormat([
          { path: 'a.[]', label: 'A', format: 'raw', separator: 'Leg {index}' },
          { path: 'b.[]', label: 'B', format: 'raw', separator: 3 },
        ]),
      },
    });
    expect(fields?.map(f => f.separator)).toEqual(['Leg {index}', undefined]);
  });

  it('keeps the group a field sits in only when it has a label or an iteration mode', () => {
    const fields = fieldsOf({
      'registry/a.json': {
        ...contract(),
        ...transferFormat([
          {
            path: 'calls.[]',
            label: 'Account action',
            fields: [
              { path: 'to', label: 'To', format: 'raw' },
              { path: 'value', label: 'Value', format: 'raw' },
            ],
          },
          {
            iteration: 'bundled',
            fields: [
              { path: 'tokens.[]', label: 'Token', format: 'raw' },
              {
                fields: [
                  { path: 'amounts.[]', label: 'Amount', format: 'raw' },
                ],
              },
            ],
          },
          {
            iteration: 'sideways',
            fields: [{ path: 'x', label: 'X', format: 'raw' }],
          },
          { fields: [{ path: 'y', label: 'Y', format: 'raw' }] },
        ]),
      },
    });
    expect(fields?.map(f => [f.path, f.group])).toEqual([
      ['calls.[].to', { id: 0, label: 'Account action' }],
      ['calls.[].value', { id: 0, label: 'Account action' }],
      ['tokens.[]', { id: 1, iteration: 'bundled' }],
      ['amounts.[]', { id: 1, iteration: 'bundled' }],
      ['x', undefined],
      ['y', undefined],
    ]);
  });

  it('drops an entry with a factory beside its deployments, which the app cannot check', () => {
    const index = buildIndexFromDescriptors([
      {
        context: {
          contract: {
            deployments: [{ chainId: 1, address: ADDR }],
            factory: {
              deployEvent: 'event Deployed(address)',
              deployments: [],
            },
          },
        },
        ...transferFormat([{ path: 'to', label: 'To', format: 'raw' }]),
      },
    ]);
    expect(isEmptyIndex(index)).toBe(true);
  });

  it('drops an entry whose keys share one type-only signature, as the spec says', () => {
    const descriptor = (keys: string[]) => ({
      context: { contract: { deployments: [{ chainId: 1, address: ADDR }] } },
      display: {
        formats: Object.fromEntries(
          keys.map(k => [k, { intent: 'Send', fields: [] }]),
        ),
      },
    });
    expect(
      isEmptyIndex(
        buildIndexFromDescriptors([
          descriptor([
            'transfer(address to,uint256 amount)',
            'transfer(address dst,uint256 wad)',
          ]),
        ]),
      ),
    ).toBe(true);
    expect(
      isEmptyIndex(
        buildIndexFromDescriptors([
          descriptor(['transfer(address to,uint256 amount)', '0x095ea7b3']),
        ]),
      ),
    ).toBe(false);
  });

  it('never binds an entry only a factory deploys, which needs chain data to verify', () => {
    const index = buildIndexFromDescriptors([
      {
        context: {
          contract: {
            factory: {
              deployEvent: 'event Deployed(address)',
              deployments: [{ chainId: 1, address: ADDR }],
            },
          },
        },
        ...transferFormat([{ path: 'to', label: 'To', format: 'raw' }]),
      },
    ]);
    expect(isEmptyIndex(index)).toBe(true);
  });
});

describe('index shape', () => {
  it('is version 11', () => {
    expect(EIP7730_INDEX_VERSION).toBe(11);
  });

  it('stores each key once per contract, its chains under it', () => {
    const index = buildIndexFromDescriptors([
      {
        context: {
          contract: {
            deployments: [
              { chainId: 1, address: ADDR },
              { chainId: 10, address: ADDR },
            ],
          },
        },
        ...transferFormat([{ path: 'to', label: 'To', format: 'raw' }]),
      },
    ]);
    expect(index.contracts).toEqual({
      [ADDR.toLowerCase()]: { [TRANSFER_SELECTOR]: { 1: 0, 10: 0 } },
    });
  });

  it('stores a format once, however many deployments and descriptors share it', () => {
    const transfer = transferFormat([
      { path: 'to', label: 'To', format: 'raw' },
    ]);
    const deployments = [
      { chainId: 1, address: '0x00000000000000000000000000000000000000aa' },
      { chainId: 10, address: '0x00000000000000000000000000000000000000aa' },
    ];
    const index = buildIndexFromDescriptors([
      { context: { contract: { deployments } }, ...transfer },
      {
        context: {
          contract: {
            deployments: [
              {
                chainId: 1,
                address: '0x00000000000000000000000000000000000000bb',
              },
            ],
          },
        },
        ...transfer,
      },
    ]);
    expect(index.formats).toHaveLength(1);
    const keys = Object.keys(nested(index).contracts);
    expect(keys).toHaveLength(3);
    for (const key of keys) {
      const [chainId, address] = key.split(':');
      expect(
        indexedFormat(
          index,
          'contracts',
          Number(chainId),
          address,
          TRANSFER_SELECTOR,
        ),
      ).toBe(index.formats[0]);
    }
  });

  it('keeps the function signature a format is keyed by, and none for a bare selector', () => {
    const index = buildIndexFromDescriptors([
      {
        ...contract(),
        display: {
          formats: {
            [TRANSFER]: { intent: 'Send', fields: [] },
            '0x095ea7b3': { intent: 'Approve', fields: [] },
          },
        },
      },
    ]);
    expect(
      indexedFormat(index, 'contracts', 1, ADDR, TRANSFER_SELECTOR)?.signature,
    ).toBe(TRANSFER);
    expect(
      indexedFormat(index, 'contracts', 1, ADDR, '0x095ea7b3')?.signature,
    ).toBeUndefined();
  });

  it('finds nothing for an unknown deployment or key', () => {
    const index = buildIndexFromDescriptors([
      {
        ...contract(),
        ...transferFormat([{ path: 'to', label: 'To', format: 'raw' }]),
      },
    ]);
    expect(
      indexedFormat(index, 'contracts', 1, '0xdead', TRANSFER_SELECTOR),
    ).toBeNull();
    expect(indexedFormat(index, 'contracts', 1, ADDR, '0x00000000')).toBeNull();
    expect(indexedFormat(index, 'eip712', 1, ADDR, 'Permit()')).toBeNull();
  });

  it('tells an empty index apart', () => {
    expect(isEmptyIndex(buildIndexFromDescriptors([]))).toBe(true);
    expect(
      isEmptyIndex(
        buildIndexFromDescriptors([
          {
            ...contract(),
            ...transferFormat([{ path: 'to', label: 'To', format: 'raw' }]),
          },
        ]),
      ),
    ).toBe(false);
  });
});

describe('slices', () => {
  const A = '0xab00000000000000000000000000000000000001';
  const B = '0xAB00000000000000000000000000000000000002';
  const C = '0x0100000000000000000000000000000000000003';

  it("names a slice by the address's first byte", () => {
    expect(sliceName(A)).toBe('ab');
    expect(sliceName(B)).toBe('ab');
    expect(sliceName(C)).toBe('01');
  });

  it('puts every deployment in its slice with only the formats it uses', () => {
    const send = { intent: 'Send', fields: [] };
    const sign = { intent: 'Sign', fields: [] };
    const index = buildIndexFromDescriptors([
      {
        context: {
          contract: {
            deployments: [
              { chainId: 1, address: A },
              { chainId: 10, address: A },
              { chainId: 1, address: C },
            ],
          },
        },
        display: { formats: { [TRANSFER]: send } },
      },
      {
        context: { eip712: { deployments: [{ chainId: 1, address: B }] } },
        display: { formats: { 'Mail(string body)': sign } },
      },
    ]);
    const slices = sliceIndex(index);

    expect([...slices.keys()].sort()).toEqual(['01', 'ab']);
    const ab = slices.get('ab')!;
    expect(ab.formats.map(f => f.intent)).toEqual(['Send', 'Sign']);
    expect(ab.contracts).toEqual({
      [A.toLowerCase()]: { [TRANSFER_SELECTOR]: { 1: 0, 10: 0 } },
    });
    expect(
      indexedFormat(ab, 'eip712', 1, B.toLowerCase(), 'Mail(string body)')
        ?.intent,
    ).toBe('Sign');
    expect(slices.get('01')!.formats.map(f => f.intent)).toEqual(['Send']);
  });

  it('gives an empty index no slices', () => {
    expect(sliceIndex(buildIndexFromDescriptors([])).size).toBe(0);
  });
});

describe('interpolatedIntent', () => {
  const sentenceFor = (
    interpolatedIntent: string,
    fields: Record<string, unknown>[],
  ) =>
    indexedFormat(
      buildIndexFromDescriptors([
        {
          ...contract(),
          display: {
            formats: {
              [TRANSFER]: { intent: 'Send', interpolatedIntent, fields },
            },
          },
        },
      ]),
      'contracts',
      1,
      ADDR,
      TRANSFER_SELECTOR,
    )?.interpolatedIntent;
  const to = { path: 'to', label: 'To', format: 'addressName' };
  const amount = { path: '#.amount', label: 'Amount', format: 'raw' };

  it('keeps a sentence whose placeholders all name always-visible fields', () => {
    expect(sentenceFor('Send {amount} to {#.to}', [to, amount])).toBe(
      'Send {amount} to {#.to}',
    );
    expect(
      sentenceFor('Send {@.value}', [
        { path: '@.value', label: 'Value', format: 'amount' },
      ]),
    ).toBe('Send {@.value}');
    expect(sentenceFor('Run {{f}} once', [])).toBe('Run {{f}} once');
  });

  it('drops a sentence the app could not fill as the spec asks', () => {
    expect(
      sentenceFor('Send {amount} to {nobody}', [to, amount]),
    ).toBeUndefined();
    expect(
      sentenceFor('Send {amount}', [{ ...amount, visible: 'optional' }]),
    ).toBeUndefined();
    expect(
      sentenceFor('Send {amount}', [
        { ...amount, visible: { ifNotIn: ['0'] } },
      ]),
    ).toBeUndefined();
    expect(
      sentenceFor('Do {to}', [{ ...to, format: 'calldata' }]),
    ).toBeUndefined();
    expect(sentenceFor('Send {amount', [amount])).toBeUndefined();
    expect(sentenceFor('Send amount}', [amount])).toBeUndefined();
    expect(sentenceFor('Send {}', [amount])).toBeUndefined();
  });

  it('splits a sentence into text and placeholders, escapes included', () => {
    expect(interpolationParts('Send {#.amount} to {to}')).toEqual([
      { text: 'Send ' },
      { path: '#.amount' },
      { text: ' to ' },
      { path: 'to' },
    ]);
    expect(interpolationParts('Run {{f}} with {x}')).toEqual([
      { text: 'Run {f} with ' },
      { path: 'x' },
    ]);
    expect(interpolationParts('a {b{c}')).toBeNull();
  });
});
