import { buildSignKeycardParams } from '../src/utils/signNavigation';
import type { ScanResult } from '../src/types';

describe('buildSignKeycardParams', () => {
  it('returns eth params for eth-sign-request', () => {
    const result: ScanResult = {
      kind: 'eth-sign-request',
      request: {
        signData: 'aabbccdd',
        dataType: 1,
        derivationPath: "m/44'/60'/0'/0",
        chainId: 1,
        requestId: 'req-1',
      },
    };
    expect(buildSignKeycardParams(result)).toEqual({
      operation: 'sign',
      signMode: 'eth',
      signData: 'aabbccdd',
      derivationPath: "m/44'/60'/0'/0",
      chainId: 1,
      requestId: 'req-1',
      dataType: 1,
    });
  });

  it('returns btc params for crypto-psbt', () => {
    const result: ScanResult = {
      kind: 'crypto-psbt',
      request: { psbtHex: 'deadbeef' },
    };
    expect(buildSignKeycardParams(result)).toEqual({
      operation: 'sign',
      signMode: 'btc',
      psbtHex: 'deadbeef',
    });
  });

  it('returns btc-message params for btc-sign-request', () => {
    const result: ScanResult = {
      kind: 'btc-sign-request',
      request: {
        requestId: 'req-2',
        signDataHex: 'cafebabe',
        dataType: 1,
        derivationPath: "m/84'/0'/0'/0/0",
        address: 'bc1qexample',
        origin: 'Sparrow',
      },
    };
    expect(buildSignKeycardParams(result)).toEqual({
      operation: 'sign',
      signMode: 'btc-message',
      requestId: 'req-2',
      signDataHex: 'cafebabe',
      derivationPath: "m/84'/0'/0'/0/0",
      address: 'bc1qexample',
      origin: 'Sparrow',
    });
  });

  it('returns null for unsupported result', () => {
    const result: ScanResult = { kind: 'unsupported', type: 'something' };
    expect(buildSignKeycardParams(result)).toBeNull();
  });

  it('returns null for error result', () => {
    const result: ScanResult = { kind: 'error', message: 'oops' };
    expect(buildSignKeycardParams(result)).toBeNull();
  });
});
