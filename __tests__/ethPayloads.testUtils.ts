import { RLP } from '@ethereumjs/rlp';

import type { EthPayload } from '../src/utils/ethPayload';

const TO = Buffer.from('d3cda913deb6f4967b2ef3aa68f5a843da74c4ef', 'hex');
const EMPTY = new Uint8Array(0);
const ONE = Uint8Array.of(1);
const GAS = Uint8Array.of(0x52, 0x08);

const typedTx = (type: number, fields: unknown[]) =>
  Buffer.concat([
    Buffer.from([type]),
    Buffer.from(RLP.encode(fields as Uint8Array[])),
  ]).toString('hex');

const utf8Hex = (text: string) => Buffer.from(text, 'utf8').toString('hex');

/** One signable request per payload kind on chain 1, plus one the classification refuses. */
export const PAYLOAD_REQUESTS: Record<
  EthPayload['kind'],
  { signData: string; dataType: number }
> = {
  'tx-legacy': {
    signData: Buffer.from(
      RLP.encode([EMPTY, ONE, GAS, TO, EMPTY, EMPTY, ONE, EMPTY, EMPTY]),
    ).toString('hex'),
    dataType: 1,
  },
  'tx-eip2930': {
    signData: typedTx(1, [ONE, EMPTY, ONE, GAS, TO, EMPTY, EMPTY, []]),
    dataType: 1,
  },
  'tx-eip1559': {
    signData: typedTx(2, [ONE, EMPTY, ONE, ONE, GAS, TO, EMPTY, EMPTY, []]),
    dataType: 4,
  },
  'personal-message': { signData: utf8Hex('hello'), dataType: 3 },
  'eip712-json': {
    signData: utf8Hex(
      JSON.stringify({
        types: { Mail: [{ name: 'contents', type: 'string' }] },
        primaryType: 'Mail',
        domain: { name: 'Test', chainId: 1 },
        message: { contents: 'hi' },
      }),
    ),
    dataType: 2,
  },
  'eip712-prehashed': {
    signData: '1901' + 'aa'.repeat(32) + 'bb'.repeat(32),
    dataType: 2,
  },
  'raw-digest': { signData: 'cd'.repeat(32), dataType: 0 },
  invalid: { signData: 'e8aabbccdd', dataType: 1 },
};
