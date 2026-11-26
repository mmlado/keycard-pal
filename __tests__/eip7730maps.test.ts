import { readFileSync } from 'fs';
import { join } from 'path';

import { withMapValues } from '../src/utils/eip7730/maps';
import { buildEip712Resolvers } from '../src/utils/eip7730/paths';
import {
  buildIndexFromDescriptors,
  type Eip7730DisplayFormat,
  type Eip7730Field,
} from '../src/utils/eip7730/zip';

const AAVE_V4 = JSON.parse(
  readFileSync(
    join(
      __dirname,
      'fixtures',
      'eip7730',
      'registry',
      'aave',
      'calldata-V4MainSpoke.json',
    ),
    'utf8',
  ),
);
const ADDRESS = '0x00000000000000000000000000000000000000aa';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const TRANSFER = 'transfer(address to,uint256 amount)';

function onlyFormat(descriptor: unknown): Eip7730DisplayFormat {
  const [format] = buildIndexFromDescriptors([descriptor]).formats;
  return format;
}

function transferDescriptor(
  maps: unknown,
  fields: unknown[],
): Record<string, unknown> {
  return {
    context: {
      contract: { deployments: [{ chainId: 1, address: ADDRESS }] },
    },
    metadata: { maps },
    display: { formats: { [TRANSFER]: { intent: 'Send', fields } } },
  };
}

function amountField(token: unknown): Record<string, unknown> {
  return {
    path: 'amount',
    label: 'Amount',
    format: 'tokenAmount',
    params: { token },
  };
}

describe('building an index with maps', () => {
  it('keeps the Aave V4 reserve map and points each amount at it', () => {
    const index = buildIndexFromDescriptors([AAVE_V4]);
    const supply = index.formats.find(f => f.intent === 'Supply')!;
    expect(supply.fields[0].params).toEqual({
      token: { map: 'reserveToken', keyPath: 'reserveId' },
    });
    expect(supply.metadata?.maps?.reserveToken['7']).toBe(USDC);
    expect(supply.metadata?.maps?.reserveToken['0']).toBe(WETH);
  });

  it('writes keys in lower case and drops a map whose keys differ only by case', () => {
    const format = onlyFormat(
      transferDescriptor(
        {
          byAddress: { values: { [USDC]: 'USDC' } },
          clash: { values: { '0xab': 1, '0xAB': 2 } },
          clashAfterObject: { values: { '0xcd': { nested: 1 }, '0xCD': 2 } },
        },
        [amountField({ map: '$.metadata.maps.byAddress', keyPath: 'to' })],
      ),
    );
    expect(format.metadata?.maps).toEqual({
      byAddress: { [USDC.toLowerCase()]: 'USDC' },
    });
  });

  it('keeps only constant values', () => {
    const format = onlyFormat(
      transferDescriptor(
        { m: { values: { 1: { nested: true }, 2: [USDC], 3: USDC, 4: 6 } } },
        [],
      ),
    );
    expect(format.metadata?.maps?.m).toEqual({ 3: USDC, 4: 6 });
  });

  it('keeps no map name for a reference that does not point into metadata.maps', () => {
    const format = onlyFormat(
      transferDescriptor({}, [
        amountField({ map: '$.metadata.constants.token', keyPath: 'to' }),
        { ...amountField({ map: 5, extra: 'x' }), label: 'Other' },
      ]),
    );
    expect(format.fields.map(f => f.params?.token)).toEqual([
      { map: '', keyPath: 'to' },
      { map: '', keyPath: '' },
    ]);
  });

  it('reads a relative keyPath inside a group from the group, and leaves a container path alone', () => {
    const format = onlyFormat(
      transferDescriptor({}, [
        {
          path: 'order',
          fields: [
            amountField({ map: '$.metadata.maps.m', keyPath: 'reserveId' }),
            {
              ...amountField({
                map: '$.metadata.maps.m',
                keyPath: '@.chainId',
              }),
              label: 'Chain amount',
            },
          ],
        },
      ]),
    );
    expect(format.fields.map(f => f.params?.token)).toEqual([
      { map: 'm', keyPath: 'order.reserveId' },
      { map: 'm', keyPath: '@.chainId' },
    ]);
  });
});

describe('withMapValues', () => {
  const field = (token: unknown, extra: Eip7730Field['params'] = {}) =>
    ({
      path: 'amount',
      label: 'Amount',
      format: 'tokenAmount',
      params: { token, ...extra },
    } as Eip7730Field);
  const format = (...fields: Eip7730Field[]): Eip7730DisplayFormat => ({
    intent: 'Supply',
    fields,
    metadata: {
      maps: { reserve: { '7': USDC, [USDC.toLowerCase()]: 'by address' } },
    },
  });
  const keys: Record<string, string> = { reserveId: '7', asset: USDC };
  const keyAt = (path: string) => keys[path] ?? null;

  it('replaces each reference with its value and keeps the other params', () => {
    const plain: Eip7730Field = { path: 'to', label: 'To', format: 'raw' };
    const resolved = withMapValues(
      format(
        plain,
        field({ map: 'reserve', keyPath: 'reserveId' }, { threshold: '10' }),
      ),
      keyAt,
    );
    expect(resolved?.fields[0]).toBe(plain);
    expect(resolved?.fields[1].params).toEqual({
      token: USDC,
      threshold: '10',
    });
  });

  it('matches a key without regard to case', () => {
    const resolved = withMapValues(
      format(field({ map: 'reserve', keyPath: 'asset' })),
      keyAt,
    );
    expect(resolved?.fields[0].params?.token).toBe('by address');
  });

  it('answers the same format when nothing refers to a map', () => {
    const plain = format(field(USDC));
    expect(withMapValues(plain, keyAt)).toBe(plain);
  });

  it.each([
    ['no key matches', { map: 'reserve', keyPath: 'other' }, { other: '8' }],
    ['the key cannot be read', { map: 'reserve', keyPath: 'missing' }, {}],
    ['the map does not exist', { map: 'nothing', keyPath: 'reserveId' }, {}],
    ['the reference named no map', { map: '', keyPath: 'reserveId' }, {}],
    [
      'the key is read from an array',
      { map: 'reserve', keyPath: 'ids.[]' },
      { 'ids.[]': '7' },
    ],
    ['the key path is empty', { map: 'reserve', keyPath: '' }, { '': '7' }],
  ])('answers null when %s', (_case, ref, extra) => {
    const at = (path: string) =>
      (extra as Record<string, string>)[path] ?? keyAt(path);
    expect(withMapValues(format(field(USDC), field(ref)), at)).toBeNull();
  });

  it('reads only a map of its own', () => {
    expect(
      withMapValues(
        format(field({ map: 'toString', keyPath: 'reserveId' })),
        keyAt,
      ),
    ).toBeNull();
    expect(
      withMapValues(format(field({ map: 'reserve', keyPath: 'proto' })), path =>
        path === 'proto' ? 'constructor' : null,
      ),
    ).toBeNull();
  });
});

describe('EIP-712 map keys', () => {
  const resolvers = buildEip712Resolvers(
    {
      types: {
        Order: [
          { name: 'reserveId', type: 'uint256' },
          { name: 'hexId', type: 'uint8' },
          { name: 'negative', type: 'int256' },
          { name: 'blank', type: 'uint256' },
          { name: 'enabled', type: 'bool' },
          { name: 'flag', type: 'bool' },
          { name: 'asset', type: 'address' },
          { name: 'label', type: 'string' },
        ],
      },
      primaryType: 'Order',
      message: {
        reserveId: 7,
        hexId: '0x07',
        negative: '-3',
        blank: '',
        enabled: true,
        flag: 'yes',
        asset: USDC.toLowerCase(),
        label: 'Main',
      },
    },
    { chainId: 10, to: USDC },
  );

  it.each([
    ['reserveId', '7'],
    ['hexId', '7'],
    ['negative', '-3'],
    ['blank', null],
    ['enabled', 'true'],
    ['flag', null],
    ['asset', USDC.toLowerCase()],
    ['label', 'Main'],
    ['@.chainId', '10'],
    ['@.to', USDC],
    ['missing', null],
  ])('reads %s as %p', (path, key) => {
    expect(resolvers.mapKeyAt(path)).toBe(key);
  });
});
