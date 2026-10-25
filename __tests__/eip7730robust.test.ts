/* eslint-disable no-bitwise */
// A downloaded registry is untrusted input: whatever it holds, building and rendering never throw.
import { readFileSync } from 'fs';
import { join } from 'path';
import { strToU8, zipSync } from 'fflate';

import bundled from '../src/data/eip7730.json';
import { displayDescriptor } from '../src/utils/eip7730/display';
import {
  formatEip7730Field,
  interpolateIntent,
} from '../src/utils/eip7730/format';
import {
  buildArgsPathResolver,
  decodeArgsBySignature,
  resolveEip712FieldValue,
} from '../src/utils/eip7730/paths';
import {
  buildIndexFromDescriptors,
  processRegistryZip,
  type Eip7730DisplayFormat,
  type Eip7730Index,
} from '../src/utils/eip7730/zip';

import { nested } from './eip7730Index.testUtils';

const ROOT = 'clear-signing-erc7730-registry-master';
const SCHEMA = `${ROOT}/specs/erc7730-v2.schema.json`;
const FIXTURES = join(__dirname, 'fixtures', 'eip7730');
const KILN = {
  [`${ROOT}/registry/kiln/calldata-Vault-USDC-Morpho-MEV-Capital.json`]:
    'registry/kiln/calldata-Vault-USDC-Morpho-MEV-Capital.json',
  [`${ROOT}/registry/kiln/common-KilnVaults.json`]:
    'registry/kiln/common-KilnVaults.json',
  [`${ROOT}/ercs/calldata-erc4626-vaults.json`]:
    'ercs/calldata-erc4626-vaults.json',
};
const ADDRESS = '0x00000000000000000000000000000000000000aa';

function zip(files: Record<string, unknown>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    entries[name] =
      content instanceof Uint8Array
        ? content
        : strToU8(
            typeof content === 'string' ? content : JSON.stringify(content),
          );
  }
  return zipSync(entries);
}

function kilnFiles(): Record<string, unknown> {
  const files: Record<string, unknown> = { [SCHEMA]: { version: '2.1.0' } };
  for (const [name, path] of Object.entries(KILN)) {
    files[name] = JSON.parse(readFileSync(join(FIXTURES, path), 'utf8'));
  }
  return files;
}

// Deterministic, so a failure reproduces from its seed.
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const ODD = [
  null,
  true,
  0,
  -1,
  1.5,
  1e308,
  '',
  '$.metadata.constants.missing',
  '$.display.definitions.missing',
  '0x',
  'constructor',
  '__proto__',
  [],
  ['a', 1, null],
  {},
  { fields: [{ fields: [] }] },
  '9'.repeat(90),
];

function mutate(node: unknown, rand: () => number): unknown {
  if (rand() < 0.08) return ODD[Math.floor(rand() * ODD.length)];
  if (Array.isArray(node)) return node.map(item => mutate(item, rand));
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (rand() < 0.05) continue;
      out[key] = mutate(value, rand);
    }
    return out;
  }
  return node;
}

function renderAll(index: Eip7730Index, rand: () => number): number {
  let rendered = 0;
  for (const format of index.formats) {
    for (const field of format.fields) {
      const value = rand() < 0.5 ? String(ODD[rendered % ODD.length]) : '1';
      const ctx = {
        chainId: 1,
        contractAddress: ADDRESS,
        resolvePath: () => value,
      };
      const { text } = formatEip7730Field(field, value, format, ctx);
      expect(typeof text).toBe('string');
      rendered += 1;
    }
    const value = String(ODD[rendered % ODD.length]);
    const sentence = interpolateIntent(format, {
      chainId: 1,
      contractAddress: ADDRESS,
      resolvePath: () => value,
    });
    expect(sentence === null || typeof sentence === 'string').toBe(true);
    // Every array empty, single or double, so blocks and inner calls get built too.
    const display = displayDescriptor(
      {
        format,
        resolvePath: () => value,
        resolveEach: () => Array(rendered % 3).fill(value),
        miscasedAt: () => rand() < 0.5,
      },
      { chainId: 1, contract: ADDRESS, depth: 0 },
    );
    expect(Array.isArray(display.nodes)).toBe(true);
  }
  return rendered;
}

describe('building an index from untrusted descriptors', () => {
  it('survives random damage to every part of a real include chain', () => {
    for (let seed = 1; seed <= 150; seed += 1) {
      const rand = random(seed);
      const files = kilnFiles();
      for (const name of Object.keys(KILN))
        files[name] = mutate(files[name], rand);
      expect(() =>
        renderAll(processRegistryZip(zip(files)), rand),
      ).not.toThrow();
    }
  });

  it('keeps the other descriptors when one cannot be read', () => {
    const broken = {};
    Object.defineProperty(broken, 'context', {
      enumerable: true,
      get() {
        throw new Error('unreadable');
      },
    });
    const index = buildIndexFromDescriptors([
      broken,
      {
        context: {
          contract: { deployments: [{ chainId: 1, address: ADDRESS }] },
        },
        display: {
          formats: {
            'transfer(address to,uint256 amount)': {
              intent: 'Send',
              fields: [],
            },
          },
        },
      },
    ]);
    expect(nested(index).contracts[`1:${ADDRESS}`]['0xa9059cbb'].intent).toBe(
      'Send',
    );
  });

  it('skips a descriptor whose includes nest past the stack', () => {
    const files: Record<string, unknown> = { ...kilnFiles() };
    for (let i = 0; i < 20000; i += 1) {
      files[`${ROOT}/registry/deep/${i}.json`] = {
        includes: `${i + 1}.json`,
        context: {
          contract: { deployments: [{ chainId: 1, address: ADDRESS }] },
        },
      };
    }
    expect(() => processRegistryZip(zip(files))).not.toThrow();
  });

  it('drops deployments that are not a real address on a real chain', () => {
    const index = buildIndexFromDescriptors([
      {
        context: {
          contract: {
            deployments: [
              { chainId: 1, address: '0x1234' },
              { chainId: 1, address: '../../outside' },
              { chainId: 0, address: ADDRESS },
              { chainId: -1, address: ADDRESS },
              { chainId: 1.5, address: ADDRESS },
              { chainId: 'abc', address: ADDRESS },
              {
                chainId: '10',
                address: ADDRESS.toUpperCase().replace('0X', '0x'),
              },
            ],
          },
        },
        display: { formats: { '0xa9059cbb': { intent: 'Send', fields: [] } } },
      },
    ]);
    expect(Object.keys(nested(index).contracts)).toEqual([`10:${ADDRESS}`]);
  });

  it('never lets a descriptor key reach Object.prototype', () => {
    // JSON.parse keeps "__proto__" as an own key, as a downloaded file would.
    const descriptor = JSON.parse(`{
      "context": { "eip712": {
        "deployments": [{ "chainId": 1, "address": "${ADDRESS}" }],
        "domain": { "__proto__": { "polluted": "domain" } }
      } },
      "metadata": { "enums": { "__proto__": { "1": "enum" } } },
      "display": { "formats": {
        "__proto__": { "intent": "Proto", "fields": [] },
        "constructor": { "intent": "Constructor", "fields": [] },
        "Mail(address to)": { "intent": "Mail", "fields": [
          { "path": "to", "label": "To", "format": "raw",
            "params": { "__proto__": { "polluted": "params" } } }
        ] }
      } }
    }`);
    try {
      const index = buildIndexFromDescriptors([descriptor]);
      expect(Object.prototype.hasOwnProperty.call(Object.prototype, '1')).toBe(
        false,
      );
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      expect(index.formats.map(f => f.intent)).toEqual(['Mail']);
    } finally {
      delete (Object.prototype as Record<string, unknown>)['1'];
    }
  });

  it('shows an intent given as labels and values on one line', () => {
    const intentOf = (intent: unknown, fields: unknown[] = []) =>
      buildIndexFromDescriptors([
        {
          context: {
            contract: { deployments: [{ chainId: 1, address: ADDRESS }] },
          },
          display: { formats: { '0xa9059cbb': { intent, fields } } },
        },
      ]).formats[0]?.intent;
    const field = { path: 'to', label: 'To', format: 'raw' };
    expect(
      intentOf({ 'Native Staking': 'Withdraw', Rewards: 'Consensus & Exec' }),
    ).toBe('Native Staking: Withdraw, Rewards: Consensus & Exec');
    expect(intentOf({ Action: { nested: 'x' } }, [field])).toBeUndefined();
    expect(intentOf({}, [field])).toBeUndefined();
    expect(intentOf({ Action: 'x' }, [])).toBe('Action: x');
  });

  it('keeps token decimals only when they fit a uint8', () => {
    const decimalsOf = (decimals: unknown) =>
      buildIndexFromDescriptors([
        {
          context: {
            contract: { deployments: [{ chainId: 1, address: ADDRESS }] },
          },
          metadata: { token: { decimals, ticker: 'TKN' } },
          display: {
            formats: { '0xa9059cbb': { intent: 'Send', fields: [] } },
          },
        },
      ]).formats[0].metadata?.tokens?.['*']?.decimals;
    expect(decimalsOf(6)).toBe(6);
    expect(decimalsOf(255)).toBe(255);
    for (const odd of [-1, 256, 1e12, 1.5, '6'])
      expect(decimalsOf(odd)).toBeUndefined();
  });
});

describe('reading a registry zip', () => {
  it('refuses a zip whose JSON would unpack past the limit', () => {
    const huge = new Uint8Array(9 * 1024 * 1024).fill(32);
    expect(() =>
      processRegistryZip(
        zip({ ...kilnFiles(), [`${ROOT}/registry/huge.json`]: huge }),
      ),
    ).toThrow(/more than a registry/);
  });

  it('never unpacks files the parser does not read', () => {
    const huge = new Uint8Array(9 * 1024 * 1024).fill(32);
    const index = processRegistryZip(
      zip({
        ...kilnFiles(),
        [`${ROOT}/images/logo.png`]: huge,
        [`${ROOT}/huge.json`]: huge,
      }),
    );
    expect(Object.keys(index.contracts).length).toBeGreaterThan(0);
  });
});

describe('rendering untrusted formats', () => {
  it('renders every bundled format with odd values without throwing', () => {
    const index = bundled as unknown as Eip7730Index;
    expect(renderAll(index, random(7))).toBeGreaterThan(1000);
  });

  it('falls back to the raw value when a format cannot be applied', () => {
    const unreadable = () => {
      throw new Error('not what the parser builds');
    };
    const format = {
      fields: [],
      metadata: {
        tokens: new Proxy(
          {},
          {
            get: unreadable,
            has: unreadable,
            getOwnPropertyDescriptor: unreadable,
          },
        ),
      },
    } as unknown as Eip7730DisplayFormat;
    const field = {
      path: 'a',
      label: 'A',
      format: 'tokenAmount' as const,
      params: { token: ADDRESS },
    };
    const ctx = {
      chainId: 1,
      contractAddress: ADDRESS,
      resolvePath: () => '5',
    };
    expect(formatEip7730Field(field, '5', format, ctx)).toEqual({ text: '5' });
  });

  it('shows the raw value for an enum key that is not the enum’s own', () => {
    const format: Eip7730DisplayFormat = {
      fields: [],
      metadata: { enums: { side: { '0': 'Buy' } } },
    };
    const field = {
      path: 'a',
      label: 'A',
      format: 'enum' as const,
      params: { $ref: '$.metadata.enums.side' },
    };
    const ctx = { chainId: 1, resolvePath: () => null };
    for (const key of ['constructor', 'toString', '__proto__']) {
      expect(formatEip7730Field(field, key, format, ctx).text).toBe(key);
    }
    expect(formatEip7730Field(field, '0', format, ctx).text).toBe('Buy');
  });

  it('reads only what a message holds itself', () => {
    const message = { owner: '0xabc', nested: { amount: '5' } };
    expect(resolveEip712FieldValue('constructor', message)).toBeNull();
    expect(resolveEip712FieldValue('nested.toString', message)).toBeNull();
    expect(resolveEip712FieldValue('__proto__', message)).toBeNull();
    expect(resolveEip712FieldValue('nested.amount', message)).toBe('5');
    const resolve = buildArgsPathResolver({ amount: 5n });
    expect(resolve('constructor')).toBeNull();
    expect(resolve('amount.toString')).toBeNull();
  });
});

describe('decoding untrusted calldata by an untrusted signature', () => {
  it('answers null for damaged calldata and odd signatures, and never throws', () => {
    const index = bundled as unknown as Eip7730Index;
    const signatures = index.formats
      .map(f => f.signature)
      .filter((sig): sig is string => typeof sig === 'string')
      .slice(0, 120)
      .concat([
        '',
        'f(',
        'f(uint256',
        'f(tuple)',
        'f(uint7 x)',
        'x'.repeat(5000),
      ]);
    const rand = random(11);
    for (const signature of signatures) {
      for (let i = 0; i < 4; i += 1) {
        const hex = Array.from({ length: Math.floor(rand() * 200) }, () =>
          Math.floor(rand() * 16).toString(16),
        ).join('');
        expect(() =>
          decodeArgsBySignature(signature, `0x${hex}`),
        ).not.toThrow();
      }
      expect(decodeArgsBySignature(signature, '0x')).toBeNull();
    }
  });
});
