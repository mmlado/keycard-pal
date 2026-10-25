// Real descriptors and no mocks, so a change to the bundled data or its parsing fails here.
import {
  encodeFunctionData,
  parseAbiItem,
  type AbiFunction,
  type AbiParameter,
} from 'viem';

import bundled from '../src/data/eip7730.json';
import { UNLIMITED_APPROVAL_WARNING } from '../src/constants/approval';
import { describeCall } from '../src/utils/callDescription';
import { encodeEip712Type } from '../src/utils/eip712';
import {
  formatEip7730Field,
  interpolateIntent,
} from '../src/utils/eip7730/format';
import * as lookup from '../src/utils/eip7730/lookup';
import {
  buildArgsPathResolver,
  decodeArgsBySignature,
  resolveEip712FieldValue,
} from '../src/utils/eip7730/paths';
import { shownFields } from '../src/utils/eip7730/visibility';
import type {
  Eip7730DisplayFormat,
  Eip7730Index,
} from '../src/utils/eip7730/zip';

// The bundled index answers at once; a promise here would make every review screen wait.
function now(result: lookup.FormatLookup): Eip7730DisplayFormat | null {
  if (result instanceof Promise)
    throw new Error('bundled lookup returned a promise');
  return result;
}
const lookupCalldata = (...args: Parameters<typeof lookup.lookupCalldata>) =>
  now(lookup.lookupCalldata(...args));
const lookupEip712 = (...args: Parameters<typeof lookup.lookupEip712>) =>
  now(lookup.lookupEip712(...args));

const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const AAVE_V2_POOL = '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9';
const ONEINCH_V5 = '0x1111111254eeb25477b68fb85ed929f73a960582';
const RECIPIENT = '0xd3cda913deb6f4967b2ef3aa68f5a843da74c4ef';
const AMOUNT = 1_500_000n;

const word = (v: string | bigint) =>
  typeof v === 'string'
    ? v.slice(2).padStart(64, '0')
    : v.toString(16).padStart(64, '0');

// The review's own answer for the call: the entry matched, decoded and fitted to the request.
function renderCalldata(
  to: string,
  data: string,
  chainId = 1,
): Record<string, string> {
  const described = describeCall({
    chainId,
    contract: to,
    data,
    value: '0',
    depth: 0,
  });
  if (described instanceof Promise)
    throw new Error('bundled lookup returned a promise');
  expect(described.view).toBe('descriptor');
  const { format, resolvePath } = described.descriptor!;
  return rows(format, { chainId, contractAddress: to, resolvePath });
}

function rows(
  descriptor: Eip7730DisplayFormat,
  ctx: Parameters<typeof formatEip7730Field>[3],
): Record<string, string> {
  return Object.fromEntries([
    ['intent', descriptor.intent ?? ''],
    ...descriptor.fields.map(f => [
      f.label,
      formatEip7730Field(f, ctx.resolvePath(f.path), descriptor, ctx).text,
    ]),
  ]);
}

describe('bundled EIP-7730 descriptors', () => {
  it('USDT transfer', () => {
    const out = renderCalldata(
      USDT,
      `0xa9059cbb${word(RECIPIENT)}${word(AMOUNT)}`,
    );
    expect(out.intent).toBe('Send');
    expect(out.Amount).toBe('1.5 USDT');
    expect(out.To.toLowerCase()).toBe(RECIPIENT);
  });

  it('USDT unlimited approval reads "Unlimited USDT"', () => {
    const out = renderCalldata(
      USDT,
      `0x095ea7b3${word(ONEINCH_V5)}${word(2n ** 256n - 1n)}`,
    );
    expect(out.intent).toBe('Approve');
    expect(out.Amount).toBe('Unlimited USDT');
    const descriptor = lookupCalldata(1, USDT, '0x095ea7b3')!;
    const amount = descriptor.fields.find(f => f.label === 'Amount')!;
    expect(
      formatEip7730Field(amount, (2n ** 256n - 1n).toString(), descriptor, {
        chainId: 1,
        contractAddress: USDT,
        resolvePath: () => USDT,
      }).warnings,
    ).toEqual([UNLIMITED_APPROVAL_WARNING]);
  });

  it('Aave v2 borrow resolves the token argument and the rate enum', () => {
    const out = renderCalldata(
      AAVE_V2_POOL,
      `0xa415bcad${word(USDT)}${word(AMOUNT)}${word(2n)}${word(0n)}${word(
        RECIPIENT,
      )}`,
    );
    expect(out.intent).toBe('Borrow');
    expect(out['Amount to borrow']).toBe('1.5 USDT');
    expect(out['Interest Rate mode']).toBe('variable');
  });

  it('Kiln vault: formats come through two includes, with constants and a fixed value', () => {
    const vault = '0x2a4e2dacc45186bed96d9f766cb6be6b0f8a26f1';
    const descriptor = lookupCalldata(1, vault, '0x6e553f65');
    expect(descriptor?.intent).toBe('Deposit');
    const out = renderCalldata(
      vault,
      '0x6e553f65' + word(AMOUNT) + word(RECIPIENT),
    );
    expect(out['Deposit asset']).toBe('1.5 USDC');
    expect(out['Send shares to'].toLowerCase()).toBe(RECIPIENT);
    expect(
      descriptor!.fields.find(f => f.label === 'Share ticker')?.value,
    ).toBe('kmmUSDC');
  });

  it('1inch v4 on BSC exists only through an include, its constants resolved', () => {
    const swap = lookupCalldata(
      56,
      '0x1111111254fb6c44bac0bed2854e76f90643097d',
      '0xbc80f1a8',
    );
    expect(swap?.intent).toBe('Swap');
    expect(JSON.stringify(swap)).not.toContain('$.metadata.constants');
    expect(swap!.fields[0].params?.nativeCurrencyAddress).toContain(
      '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    );
  });

  describe('USDC TransferWithAuthorization', () => {
    const types = {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    };
    const domain = {
      name: 'USD Coin',
      version: '2',
      chainId: 1,
      verifyingContract: USDC,
    };
    const message = {
      from: RECIPIENT,
      to: ONEINCH_V5,
      value: AMOUNT.toString(),
      validAfter: '0',
      validBefore: '1800000000',
      nonce: `0x${'11'.repeat(32)}`,
    };
    const encodedType = encodeEip712Type('TransferWithAuthorization', types)!;

    it('matches by encoded type and renders the amount', () => {
      const descriptor = lookupEip712(1, USDC, encodedType, domain);
      expect(descriptor?.intent).toBe('Authorize USDC transfer');
      const container = { to: USDC, value: '0', chainId: 1 };
      const out = rows(descriptor!, {
        chainId: 1,
        contractAddress: USDC,
        resolvePath: path => resolveEip712FieldValue(path, message, container),
      });
      expect(out.Amount).toBe('1.5 USDC');
    });

    it('does not match a message from another domain', () => {
      expect(
        lookupEip712(1, USDC, encodedType, { ...domain, name: 'Fake Coin' }),
      ).toBeNull();
    });
  });
});

// A value of any ABI type, so calldata can be built for every bundled signature.
function sample(param: AbiParameter, bytesLength = 400): unknown {
  const array = param.type.match(/^(.*)\[(\d*)\]$/);
  if (array) {
    const inner = { ...param, type: array[1] } as AbiParameter;
    return Array.from({ length: Number(array[2] || 2) }, () =>
      sample(inner, bytesLength),
    );
  }
  if (param.type === 'tuple' && 'components' in param) {
    return Object.fromEntries(
      param.components.map((c, i) => [
        c.name || String(i),
        sample(c, bytesLength),
      ]),
    );
  }
  if (param.type === 'address') return RECIPIENT;
  if (param.type === 'bool') return true;
  if (param.type === 'string') return 'x';
  // Long enough for every byte slice the registry takes.
  if (param.type === 'bytes') return `0x${'12'.repeat(bytesLength)}`;
  if (param.type.startsWith('bytes')) {
    return `0x${'11'.repeat(Number(param.type.slice(5)))}`;
  }
  return 1n;
}

describe('visibility rules', () => {
  const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';
  const encodedType =
    'Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)';
  const domain = { name: 'Dai Stablecoin', version: '1', chainId: 1 };

  it('hides a DAI permit expiry of zero and shows any other', () => {
    const descriptor = lookupEip712(1, DAI, encodedType, domain)!;
    const labels = (expiry: string) =>
      shownFields(descriptor, {
        resolvePath: path =>
          resolveEip712FieldValue(path, { spender: RECIPIENT, expiry }, {}),
      }).map(field => field.label);
    expect(labels('0')).not.toContain('Valid until');
    expect(labels('1800000000')).toContain('Valid until');
  });
});

describe('encrypted amounts', () => {
  const CUSDC = '0xe978f22157048e5db8e5d07971376e86671672b2';

  it('shows a confidential transfer amount as the placeholder, never the handle', () => {
    const handle = `0x${'ab'.repeat(32)}`;
    const selector = Object.keys(
      (bundled as unknown as Eip7730Index).contracts[CUSDC] ?? {},
    ).find(key => {
      const format = lookupCalldata(1, CUSDC, key);
      return format?.signature?.startsWith(
        'confidentialTransfer(address to,bytes32 amount)',
      );
    });
    expect(selector).toBeDefined();
    const descriptor = lookupCalldata(1, CUSDC, selector!)!;
    const resolvePath = buildArgsPathResolver(
      { to: RECIPIENT, amount: handle },
      { to: CUSDC, chainId: 1 },
    );
    const out = rows(descriptor, {
      chainId: 1,
      contractAddress: CUSDC,
      resolvePath,
    });
    expect(Object.values(out)).toContain('[Encrypted Amount]');
    expect(JSON.stringify(out)).not.toContain('abab');
  });
});

describe('sentences', () => {
  it('fills a real entry sentence the way its fields are shown', () => {
    const token = '0x004e9c3ef86bc1ca1f0bb5c7662861ee93350568';
    const data = '0xa9059cbb' + word(RECIPIENT) + word(150_000_000n);
    const descriptor = lookupCalldata(1, token, '0xa9059cbb')!;
    const args = decodeArgsBySignature(descriptor.signature!, data)!;
    const sentence = interpolateIntent(descriptor, {
      chainId: 1,
      contractAddress: token,
      resolvePath: buildArgsPathResolver(args, { to: token, chainId: 1 }),
    });
    expect(sentence).toBe(
      'Send 1.5 uniBTC to 0xD3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef',
    );
  });

  it('fills every bundled sentence from calldata built for its signature', () => {
    let filled = 0;
    for (const format of (bundled as unknown as Eip7730Index).formats) {
      if (!format.signature || !format.interpolatedIntent) continue;
      const item = parseAbiItem(`function ${format.signature}`) as AbiFunction;
      const data = encodeFunctionData({
        abi: [item],
        // An address-sized `bytes`: a 400-byte one is past the sentence's value limit.
        args: item.inputs.map(p => sample(p, 20)),
      });
      const resolvePath = buildArgsPathResolver(
        decodeArgsBySignature(format.signature, data)!,
        { from: RECIPIENT, to: USDT, value: '1', chainId: 1 },
      );
      const sentence = interpolateIntent(format, {
        chainId: 1,
        contractAddress: USDT,
        resolvePath,
      });
      // Slices and negative indices are not read yet.
      if (/\[-|\[\d*:/.test(JSON.stringify(format.fields))) continue;
      expect([format.interpolatedIntent, sentence]).not.toEqual([
        format.interpolatedIntent,
        null,
      ]);
      filled += 1;
    }
    expect(filled).toBeGreaterThan(150);
  });
});

describe('every bundled calldata descriptor', () => {
  const formats = (bundled as unknown as Eip7730Index).formats.filter(
    f => f.signature,
  );

  it('decodes calldata built for its own signature, and its field and param paths resolve', () => {
    let paths = 0;
    for (const format of formats) {
      const item = parseAbiItem(`function ${format.signature}`) as AbiFunction;
      const data = encodeFunctionData({
        abi: [item],
        args: item.inputs.map(p => sample(p)),
      });
      const args = decodeArgsBySignature(format.signature!, data);
      expect(args).not.toBeNull();
      const resolve = buildArgsPathResolver(args!, {
        from: RECIPIENT,
        to: USDT,
        value: '0',
        chainId: 1,
      });
      for (const field of format.fields) {
        // `$.` points into the descriptor.
        if (!field.path || field.path.startsWith('$.')) continue;
        expect([format.signature, field.path, resolve(field.path)]).not.toEqual(
          [format.signature, field.path, null],
        );
        paths += 1;
        for (const [key, value] of Object.entries(field.params ?? {})) {
          if (!key.endsWith('Path') || typeof value !== 'string') continue;
          if (value.startsWith('$.')) continue;
          expect([format.signature, key, resolve(value)]).not.toEqual([
            format.signature,
            key,
            null,
          ]);
          paths += 1;
        }
      }
    }
    expect(formats.length).toBeGreaterThan(800);
    expect(paths).toBeGreaterThan(2700);
  });
});
