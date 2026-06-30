import { strToU8, zipSync } from 'fflate';

import {
  buildIndexFromDescriptors,
  EIP7730_INDEX_VERSION,
  processLedgerRegistryZip,
} from '../src/utils/eip7730/zip';

function makeZip(files: Record<string, unknown>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    entries[name] =
      typeof content === 'string'
        ? strToU8(content)
        : strToU8(JSON.stringify(content));
  }
  return zipSync(entries);
}

const usdcContractDescriptor = {
  context: {
    contract: {
      deployments: [
        { chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
        { chainId: 137, address: '0xAAAAA1234567890aabBccDdEeFf001122334455' },
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

const permitEip712Descriptor = {
  context: {
    eip712: {
      deployments: [
        { chainId: 1, address: '0xPermit000000000000000000000000000000pErM' },
      ],
    },
  },
  display: {
    formats: {
      Permit: {
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

describe('processLedgerRegistryZip', () => {
  it('indexes calldata descriptors by chainId:address with normalised selector', () => {
    const zip = makeZip({ 'registry/usdc.json': usdcContractDescriptor });
    const index = processLedgerRegistryZip(zip);
    expect(index.version).toBe(EIP7730_INDEX_VERSION);
    const mainnetKey = '1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    expect(index.contracts[mainnetKey]).toBeDefined();
    expect(index.contracts[mainnetKey]['0xa9059cbb']).toBeDefined();
    expect(index.contracts[mainnetKey]['0xa9059cbb'].intent).toBe('Send USDC');
    expect(index.contracts[mainnetKey]['0xa9059cbb'].fields).toHaveLength(2);
  });

  it('normalises full signatures to 4-byte selectors', () => {
    const zip = makeZip({ 'registry/usdc.json': usdcContractDescriptor });
    const index = processLedgerRegistryZip(zip);
    const mainnetKey = '1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    // transferFrom selector
    expect(index.contracts[mainnetKey]['0x23b872dd']).toBeDefined();
    expect(index.contracts[mainnetKey]['0x23b872dd'].intent).toBe('Pull USDC');
  });

  it('inserts an entry for every deployment', () => {
    const zip = makeZip({ 'registry/usdc.json': usdcContractDescriptor });
    const index = processLedgerRegistryZip(zip);
    expect(
      index.contracts['137:0xaaaaa1234567890aabbccddeeff001122334455'][
        '0xa9059cbb'
      ],
    ).toBeDefined();
  });

  it('indexes EIP-712 descriptors by chainId:address and primary type', () => {
    const zip = makeZip({ 'registry/permit.json': permitEip712Descriptor });
    const index = processLedgerRegistryZip(zip);
    const key = '1:0xpermit000000000000000000000000000000perm';
    expect(index.eip712[key].Permit.intent).toBe('Sign permit');
    expect(index.eip712[key].Permit.fields[0].path).toBe('spender');
  });

  it('silently skips descriptors without context/display', () => {
    const zip = makeZip({
      'registry/garbage.json': garbageDescriptor,
      'registry/usdc.json': usdcContractDescriptor,
    });
    const index = processLedgerRegistryZip(zip);
    expect(Object.keys(index.contracts).length).toBeGreaterThan(0);
  });

  it('skips non-JSON files inside the zip', () => {
    const zip = makeZip({
      'registry/README.md': '# not a descriptor',
      'registry/usdc.json': usdcContractDescriptor,
    });
    const index = processLedgerRegistryZip(zip);
    expect(
      index.contracts['1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'],
    ).toBeDefined();
  });

  it('captures token metadata for tokenAmount formatting', () => {
    const zip = makeZip({ 'registry/usdc.json': usdcContractDescriptor });
    const index = processLedgerRegistryZip(zip);
    const entry =
      index.contracts['1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'][
        '0xa9059cbb'
      ];
    expect(entry.metadata?.tokens).toBeDefined();
    const tokenAddr = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    expect(entry.metadata?.tokens?.[tokenAddr].decimals).toBe(6);
    expect(entry.metadata?.tokens?.[tokenAddr].ticker).toBe('USDC');
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
