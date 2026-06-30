jest.mock('../src/data/eip7730.json', () => ({
  version: 1,
  generatedAt: '2024-01-01T00:00:00.000Z',
  contracts: {
    '1:0x000000000000000000000000000000000000beef': {
      '0xa9059cbb': {
        intent: 'Bundled transfer',
        fields: [{ path: 'to', label: 'To', format: 'addressName' }],
      },
    },
  },
  eip712: {
    '1:0x0000000000000000000000000000000000000777': {
      Permit: {
        intent: 'Bundled permit',
        fields: [],
      },
    },
  },
}));

import {
  getActiveIndex,
  lookupCalldata,
  lookupEip712,
  setRuntimeIndex,
} from '../src/utils/eip7730/lookup';

import type { Eip7730Index } from '../src/utils/eip7730/zip';

describe('eip7730 lookup', () => {
  afterEach(() => setRuntimeIndex(null));

  it('finds calldata entry by lowercased address + selector', () => {
    const entry = lookupCalldata(
      1,
      '0x000000000000000000000000000000000000BEEF',
      '0xA9059CBB',
    );
    expect(entry?.intent).toBe('Bundled transfer');
  });

  it('returns null for unknown chain', () => {
    expect(
      lookupCalldata(
        137,
        '0x000000000000000000000000000000000000beef',
        '0xa9059cbb',
      ),
    ).toBeNull();
  });

  it('returns null for unknown address', () => {
    expect(
      lookupCalldata(
        1,
        '0x000000000000000000000000000000000000dead',
        '0xa9059cbb',
      ),
    ).toBeNull();
  });

  it('returns null for unknown selector', () => {
    expect(
      lookupCalldata(
        1,
        '0x000000000000000000000000000000000000beef',
        '0xdeadbeef',
      ),
    ).toBeNull();
  });

  it('finds EIP-712 descriptor by chain + verifying contract + primary type', () => {
    const entry = lookupEip712(
      1,
      '0x0000000000000000000000000000000000000777',
      'Permit',
    );
    expect(entry?.intent).toBe('Bundled permit');
  });

  it('returns null for unknown primary type', () => {
    expect(
      lookupEip712(1, '0x0000000000000000000000000000000000000777', 'Other'),
    ).toBeNull();
  });

  it('runtime index overrides bundled when set', () => {
    const runtime: Eip7730Index = {
      version: 1,
      generatedAt: '2025-01-01T00:00:00.000Z',
      contracts: {
        '1:0x000000000000000000000000000000000000beef': {
          '0xa9059cbb': {
            intent: 'Runtime transfer',
            fields: [],
          },
        },
      },
      eip712: {},
    };
    setRuntimeIndex(runtime);
    expect(getActiveIndex()).toBe(runtime);
    expect(
      lookupCalldata(
        1,
        '0x000000000000000000000000000000000000beef',
        '0xa9059cbb',
      )?.intent,
    ).toBe('Runtime transfer');
  });

  it('clears runtime index when null', () => {
    setRuntimeIndex({
      version: 1,
      generatedAt: '',
      contracts: {},
      eip712: {},
    });
    setRuntimeIndex(null);
    expect(
      lookupCalldata(
        1,
        '0x000000000000000000000000000000000000beef',
        '0xa9059cbb',
      )?.intent,
    ).toBe('Bundled transfer');
  });

  it('returns null for invalid input', () => {
    expect(lookupCalldata(NaN, '0xabc', '0xdef')).toBeNull();
    expect(lookupCalldata(1, '', '0xdef')).toBeNull();
    expect(lookupCalldata(1, '0xabc', '')).toBeNull();
    expect(lookupEip712(NaN, '0xabc', 'Permit')).toBeNull();
  });
});
