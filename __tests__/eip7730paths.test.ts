import {
  buildCalldataPathResolver,
  resolveEip712FieldValue,
} from '../src/utils/eip7730/paths';

import type { DecodedCall } from '../src/utils/txParser';

describe('buildCalldataPathResolver', () => {
  it('resolves erc20-transfer fields by canonical name', () => {
    const call: DecodedCall = {
      kind: 'erc20-transfer',
      to: '0xaaaa',
      amount: 123n,
    };
    const r = buildCalldataPathResolver(call);
    expect(r('to')).toBe('0xaaaa');
    expect(r('amount')).toBe('123');
    expect(r('_value')).toBe('123');
  });

  it('resolves contract-call args by name', () => {
    const call: DecodedCall = {
      kind: 'contract-call',
      selector: '0xdeadbeef',
      functionName: 'doStuff',
      signature: 'doStuff(address)',
      args: [{ name: 'target', type: 'address', value: '0xbeef' }],
    };
    const r = buildCalldataPathResolver(call);
    expect(r('target')).toBe('0xbeef');
    expect(r('other')).toBeNull();
  });

  it('strips @. and #. path prefixes', () => {
    const call: DecodedCall = {
      kind: 'erc20-approve',
      spender: '0xccc',
      amount: 7n,
    };
    const r = buildCalldataPathResolver(call);
    expect(r('@.spender')).toBe('0xccc');
    expect(r('#.amount')).toBe('7');
  });
});

describe('resolveEip712FieldValue', () => {
  const msg = {
    spender: '0xspender',
    details: {
      amount: '1000',
      token: '0xtoken',
    },
    items: [{ name: 'foo' }, { name: 'bar' }],
  };

  it('resolves top-level keys', () => {
    expect(resolveEip712FieldValue('spender', msg)).toBe('0xspender');
  });

  it('resolves nested dot paths', () => {
    expect(resolveEip712FieldValue('details.amount', msg)).toBe('1000');
    expect(resolveEip712FieldValue('details.token', msg)).toBe('0xtoken');
  });

  it('resolves indexed array paths', () => {
    expect(resolveEip712FieldValue('items[0].name', msg)).toBe('foo');
    expect(resolveEip712FieldValue('items[1].name', msg)).toBe('bar');
  });

  it('treats [] as first item', () => {
    expect(resolveEip712FieldValue('items[].name', msg)).toBe('foo');
  });

  it('returns null for missing paths', () => {
    expect(resolveEip712FieldValue('missing', msg)).toBeNull();
    expect(resolveEip712FieldValue('details.missing', msg)).toBeNull();
    expect(resolveEip712FieldValue('items[99].name', msg)).toBeNull();
  });

  it('strips @. and #. prefixes', () => {
    expect(resolveEip712FieldValue('@.spender', msg)).toBe('0xspender');
    expect(resolveEip712FieldValue('#.details.amount', msg)).toBe('1000');
  });

  it('handles primitive values', () => {
    expect(resolveEip712FieldValue('x', { x: 42 })).toBe('42');
    expect(resolveEip712FieldValue('x', { x: true })).toBe('true');
  });
});
