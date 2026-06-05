import { wcRequestToScanResult } from '../src/utils/walletConnect/requestAdapter';
import type { WCRequest } from '../src/providers/walletConnect/context';

function makeReq(method: string, params: unknown[]): WCRequest {
  return { id: 1, topic: 'topic', method, params };
}

function expectEthSignResult(result: ReturnType<typeof wcRequestToScanResult>) {
  expect(result.kind).toBe('eth-sign-request');
  if (result.kind !== 'eth-sign-request') {
    throw new Error('Expected eth-sign-request');
  }
  return result;
}

describe('wcRequestToScanResult — personal_sign', () => {
  const addr = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  const addressToPath = new Map([[addr.toLowerCase(), "m/44'/60'/0'/0/0"]]);

  it('standard order [message, address] → dataType=3', () => {
    const result = expectEthSignResult(
      wcRequestToScanResult(
        makeReq('personal_sign', ['0xdeadbeef', addr]),
        addressToPath,
      ),
    );
    expect(result.request.dataType).toBe(3);
    expect(result.request.signData).toBe('0xdeadbeef');
    expect(result.request.address).toBe(addr);
  });

  it('reversed order [address, message] → still correct', () => {
    const result = expectEthSignResult(
      wcRequestToScanResult(
        makeReq('personal_sign', [addr, '0xdeadbeef']),
        addressToPath,
      ),
    );
    expect(result.request.signData).toBe('0xdeadbeef');
    expect(result.request.address).toBe(addr);
  });

  it('hex-encodes plain UTF-8 message string', () => {
    const result = expectEthSignResult(
      wcRequestToScanResult(
        makeReq('personal_sign', ['Hello Keycard Pal', addr]),
        addressToPath,
      ),
    );
    // "Hello Keycard Pal" → hex
    expect(result.request.signData).toMatch(/^0x[0-9a-f]+$/);
    expect(result.request.signData).not.toBe('0x'); // non-empty
  });

  it('preserves 0x-prefixed message as-is', () => {
    const result = expectEthSignResult(
      wcRequestToScanResult(
        makeReq('personal_sign', ['0xabcd1234', addr]),
        addressToPath,
      ),
    );
    expect(result.request.signData).toBe('0xabcd1234');
  });

  it('sets derivationPath and origin', () => {
    const result = expectEthSignResult(
      wcRequestToScanResult(
        makeReq('personal_sign', ['0xdeadbeef', addr]),
        addressToPath,
      ),
    );
    expect(result.request.derivationPath).toBe("m/44'/60'/0'/0/0");
    expect(result.request.origin).toBe('WalletConnect');
  });
});

describe('wcRequestToScanResult — eth_signTypedData_v4', () => {
  const addr = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  const validPayload = JSON.stringify({
    domain: { name: 'Test', version: '1', chainId: 1 },
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
      ],
      Mail: [{ name: 'contents', type: 'string' }],
    },
    primaryType: 'Mail',
    message: { contents: 'hello' },
  });

  it('returns dataType=0 with 0x-prefixed digest', () => {
    const result = expectEthSignResult(
      wcRequestToScanResult(
        makeReq('eth_signTypedData_v4', [addr, validPayload]),
        new Map([[addr.toLowerCase(), "m/44'/60'/0'/0/0"]]),
      ),
    );
    expect(result.request.dataType).toBe(0);
    expect(result.request.signData).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('sets address and origin', () => {
    const result = expectEthSignResult(
      wcRequestToScanResult(
        makeReq('eth_signTypedData_v4', [addr, validPayload]),
        new Map([[addr.toLowerCase(), "m/44'/60'/0'/0/0"]]),
      ),
    );
    expect(result.request.address).toBe(addr);
    expect(result.request.origin).toBe('WalletConnect');
  });

  it('includes hex-encoded reviewData', () => {
    const result = expectEthSignResult(
      wcRequestToScanResult(
        makeReq('eth_signTypedData_v4', [addr, validPayload]),
        new Map([[addr.toLowerCase(), "m/44'/60'/0'/0/0"]]),
      ),
    );
    expect(result.request.reviewData).toMatch(/^0x/);
  });

  it('resolves derivation path from addressToPath map', () => {
    const map = new Map([[addr.toLowerCase(), "m/44'/60'/0'/0/1"]]);
    const result = expectEthSignResult(
      wcRequestToScanResult(
        makeReq('eth_signTypedData_v4', [addr, validPayload]),
        map,
      ),
    );
    expect(result.request.derivationPath).toBe("m/44'/60'/0'/0/1");
  });

  it('throws when no address map is provided', () => {
    expect(() =>
      wcRequestToScanResult(
        makeReq('eth_signTypedData_v4', [addr, validPayload]),
      ),
    ).toThrow('Missing WalletConnect address mapping');
  });

  it('throws when address is not in the map', () => {
    const map = new Map<string, string>();
    expect(() =>
      wcRequestToScanResult(
        makeReq('eth_signTypedData_v4', [addr, validPayload]),
        map,
      ),
    ).toThrow('not found in session');
  });

  it('throws when payload is not valid JSON', () => {
    expect(() =>
      wcRequestToScanResult(
        makeReq('eth_signTypedData_v4', [addr, 'not-json']),
      ),
    ).toThrow('JSON parse failed');
  });

  it('throws when domain/types/message missing', () => {
    expect(() =>
      wcRequestToScanResult(
        makeReq('eth_signTypedData_v4', [
          addr,
          JSON.stringify({ domain: {}, types: {} }),
        ]),
      ),
    ).toThrow('missing domain/types/message');
  });

  it('throws when hashing fails (invalid type reference)', () => {
    const bad = JSON.stringify({
      domain: {},
      types: { Foo: [{ name: 'bar', type: 'NonExistentType' }] },
      primaryType: 'Foo',
      message: { bar: 'x' },
    });
    expect(() =>
      wcRequestToScanResult(makeReq('eth_signTypedData_v4', [addr, bad])),
    ).toThrow('hashing failed');
  });
});

describe('wcRequestToScanResult — personal_sign path resolution', () => {
  it('resolves derivation path from addressToPath map', () => {
    const addr = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    const map = new Map([[addr.toLowerCase(), "m/44'/60'/0'/0/3"]]);
    const result = expectEthSignResult(
      wcRequestToScanResult(
        makeReq('personal_sign', ['0xdeadbeef', addr]),
        map,
      ),
    );
    expect(result.request.derivationPath).toBe("m/44'/60'/0'/0/3");
  });
});

describe('wcRequestToScanResult — unsupported methods', () => {
  it('throws for unknown method', () => {
    expect(() =>
      wcRequestToScanResult(makeReq('eth_sendTransaction', [{}])),
    ).toThrow('Unsupported method');
  });
});

describe('wcRequestToScanResult — invalid params', () => {
  it('throws when params array is too short', () => {
    expect(() =>
      wcRequestToScanResult(makeReq('personal_sign', ['only-one'])),
    ).toThrow('expected array of at least 2 strings');
  });

  it('throws when params contain non-string values', () => {
    expect(() =>
      wcRequestToScanResult(makeReq('personal_sign', [123, 456])),
    ).toThrow('expected strings');
  });

  it('throws when params do not contain a signer address', () => {
    expect(() =>
      wcRequestToScanResult(makeReq('personal_sign', ['message', 'payload'])),
    ).toThrow('signer address missing');
  });
});
