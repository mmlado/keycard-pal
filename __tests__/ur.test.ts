import { CryptoPSBT } from '@keystonehq/bc-ur-registry';
import {
  CryptoKeypath,
  DataItem,
  PathComponent,
  RegistryTypes,
  encodeDataItem,
} from '@keystonehq/bc-ur-registry';
import { EthSignRequest } from '@keystonehq/bc-ur-registry-eth';
import { URDecoder } from '@ngraveio/bc-ur';

import { encodeToUR, handleUR } from '../src/utils/ur';
import { DATA_TYPE_LABELS } from '../src/types';

const VALID_EIP1559_TX_HEX =
  '02e80180843b9aca008504a817c8008252089400000000000000000000000000000000000000010180c0';

// ---------------------------------------------------------------------------
// Helper: build CBOR bytes from a properly encoded EthSignRequest UR
// ---------------------------------------------------------------------------

function buildCbor(
  signData: string,
  dataType: number,
  hdPath: string,
  opts: {
    xfp?: string;
    uuid?: string;
    chainId?: number;
    address?: string;
    origin?: string;
  } = {},
): Buffer {
  const req = EthSignRequest.constructETHRequest(
    Buffer.from(signData, 'hex'),
    dataType,
    hdPath,
    opts.xfp ?? '00000000',
    opts.uuid,
    opts.chainId,
    opts.address,
    opts.origin,
  );
  const decoder = new URDecoder();
  decoder.receivePart(req.toUREncoder(1000).nextPart());
  return decoder.resultUR().cbor;
}

function buildBtcSignRequestCbor(
  message: string,
  hdPath: string,
  opts: {
    xfp?: string;
    uuid?: string;
    dataType?: number;
    address?: string;
    origin?: string;
  } = {},
): Buffer {
  const components = hdPath
    .replace(/^m\//, '')
    .split('/')
    .map(component => {
      const hardened = component.endsWith("'");
      const index = Number.parseInt(component.replace(/'/g, ''), 10);
      return new PathComponent({ index, hardened });
    });
  const keypath = new CryptoKeypath(
    components,
    Buffer.from(opts.xfp ?? 'deadbeef', 'hex'),
  );
  const keypathItem = keypath.toDataItem();
  keypathItem.setTag(RegistryTypes.CRYPTO_KEYPATH.getTag());
  const map: Record<number, any> = {
    1: new DataItem(
      Buffer.from(
        (opts.uuid ?? '00112233-4455-6677-8899-aabbccddeeff').replace(/-/g, ''),
        'hex',
      ),
      RegistryTypes.UUID.getTag(),
    ),
    2: Buffer.from(message, 'utf8'),
    3: opts.dataType ?? 1,
    4: [keypathItem],
  };

  if (opts.address) {
    map[5] = [opts.address];
  }

  if (opts.origin) {
    map[6] = opts.origin;
  }

  return encodeDataItem(new DataItem(map));
}

// ---------------------------------------------------------------------------
// handleUR
// ---------------------------------------------------------------------------

describe('handleUR', () => {
  it('returns unsupported for an unrecognised UR type', () => {
    const result = handleUR('some-unknown-type', Buffer.alloc(0));
    expect(result).toEqual({ kind: 'unsupported', type: 'some-unknown-type' });
  });

  it('returns error when CBOR is invalid', () => {
    const result = handleUR('eth-sign-request', Buffer.from([0xff, 0xfe]));
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.message).toMatch(/Failed to parse sign request/);
    }
  });

  it('parses a minimal eth-sign-request (signData + dataType only)', () => {
    const cbor = buildCbor('deadbeef', 3, "m/44'/60'/0'/0");
    const result = handleUR('eth-sign-request', cbor);

    expect(result.kind).toBe('eth-sign-request');
    if (result.kind === 'eth-sign-request') {
      const { request } = result;
      expect(request.signData).toBe('deadbeef');
      expect(request.dataType).toBe(3);
      expect(request.requestId).toBeUndefined();
      expect(request.chainId).toBeUndefined();
      expect(request.address).toBeUndefined();
      expect(request.origin).toBeUndefined();
      expect(request.derivationPath).toBe("m/44'/60'/0'/0");
    }
  });

  it('parses a full eth-sign-request with all optional fields', () => {
    const cbor = buildCbor(VALID_EIP1559_TX_HEX, 4, "m/44'/60'/0'/0", {
      uuid: 'b3281a82-950d-4076-934b-1aa8b4f87492',
      chainId: 1,
      address: '0xabcdef1234567890abcdef1234567890abcdef12',
      origin: 'MetaMask',
    });
    const result = handleUR('eth-sign-request', cbor);

    expect(result.kind).toBe('eth-sign-request');
    if (result.kind === 'eth-sign-request') {
      const { request } = result;
      expect(request.signData).toBe(VALID_EIP1559_TX_HEX);
      expect(request.dataType).toBe(4);
      expect(request.chainId).toBe(1);
      expect(request.requestId).toBe('b3281a82950d4076934b1aa8b4f87492');
      expect(request.address).toBe(
        '0xabcdef1234567890abcdef1234567890abcdef12',
      );
      expect(request.origin).toBe('MetaMask');
      expect(request.derivationPath).toBe("m/44'/60'/0'/0");
    }
  });

  it('returns an error for an eth-sign-request with malformed EIP-1559 RLP', () => {
    const shiftedFieldsFromQrkitDemo =
      '02e80180843b9aca008504a817c800825208940000000000000000000000000000000000000000010180c0';
    const cbor = buildCbor(shiftedFieldsFromQrkitDemo, 4, "m/44'/60'/0'/0/0", {
      uuid: 'b3281a82-950d-4076-934b-1aa8b4f87492',
      address: '0xa786ec7488a340964fc4a0367144436beb7904ce',
      origin: 'QRKit Demo',
    });

    const result = handleUR('eth-sign-request', cbor);
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.message).toMatch(/Failed to parse sign request/);
    }
  });

  it('parses an EIP-2930 eth-sign-request encoded as ERC-4527 typed transaction', () => {
    const eip2930Tx =
      '01eb010285037e11d60082753094d3cda913deb6f4967b2ef3aa68f5a843da74c4ef8806f05b59d3b2000080c0';
    const cbor = buildCbor(eip2930Tx, 4, "m/44'/60'/0'/0/0", {
      uuid: 'b3281a82-950d-4076-934b-1aa8b4f87492',
      chainId: 1,
      address: '0xa786ec7488a340964fc4a0367144436beb7904ce',
      origin: 'ERC-4527 Wallet',
    });

    const result = handleUR('eth-sign-request', cbor);

    expect(result.kind).toBe('eth-sign-request');
    if (result.kind === 'eth-sign-request') {
      expect(result.request.signData).toBe(eip2930Tx);
      expect(result.request.dataType).toBe(4);
      expect(result.request.chainId).toBe(1);
      expect(result.request.origin).toBe('ERC-4527 Wallet');
    }
  });
});

// ---------------------------------------------------------------------------
// Derivation path parsing
// ---------------------------------------------------------------------------

describe('parseEthSignRequest – derivation paths', () => {
  it('formats hardened components with apostrophes', () => {
    const cbor = buildCbor('00', 3, "m/44'/60'/0'");
    const result = handleUR('eth-sign-request', cbor);
    expect(result.kind).toBe('eth-sign-request');
    if (result.kind === 'eth-sign-request') {
      expect(result.request.derivationPath).toBe("m/44'/60'/0'");
    }
  });

  it('formats non-hardened components without apostrophes', () => {
    const cbor = buildCbor('00', 3, 'm/0/1');
    const result = handleUR('eth-sign-request', cbor);
    expect(result.kind).toBe('eth-sign-request');
    if (result.kind === 'eth-sign-request') {
      expect(result.request.derivationPath).toBe('m/0/1');
    }
  });

  it('formats a mixed hardened/non-hardened path (standard Ethereum path)', () => {
    const cbor = buildCbor('00', 3, "m/44'/60'/0'/0/0");
    const result = handleUR('eth-sign-request', cbor);
    expect(result.kind).toBe('eth-sign-request');
    if (result.kind === 'eth-sign-request') {
      expect(result.request.derivationPath).toBe("m/44'/60'/0'/0/0");
    }
  });

  it('returns error when CBOR is malformed', () => {
    const result = handleUR('eth-sign-request', Buffer.from([0x00]));
    expect(result.kind).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// crypto-psbt
// ---------------------------------------------------------------------------

describe('handleUR – crypto-psbt', () => {
  function buildPsbtCbor(): Buffer {
    // Minimal valid PSBT: magic + empty global map
    const psbtBytes = Buffer.from(
      '70736274ff01000a0200000000000000000000',
      'hex',
    );
    return new CryptoPSBT(psbtBytes).toCBOR();
  }

  it('parses a valid crypto-psbt', () => {
    const cbor = buildPsbtCbor();
    const result = handleUR('crypto-psbt', cbor);
    expect(result.kind).toBe('crypto-psbt');
    if (result.kind === 'crypto-psbt') {
      expect(typeof result.request.psbtHex).toBe('string');
      expect(result.request.psbtHex.length).toBeGreaterThan(0);
    }
  });

  it('returns unsupported for unrecognised type (not crypto-psbt)', () => {
    const result = handleUR('unknown-type', Buffer.alloc(0));
    expect(result.kind).toBe('unsupported');
  });
});

describe('handleUR – btc-sign-request', () => {
  it('parses a valid btc-sign-request', () => {
    const cbor = buildBtcSignRequestCbor('hello btc', "m/84'/0'/0'/0/3", {
      address: 'bc1qexampleaddress',
      origin: 'Sparrow',
    });
    const result = handleUR('btc-sign-request', cbor);

    expect(result.kind).toBe('btc-sign-request');
    if (result.kind === 'btc-sign-request') {
      expect(result.request.requestId).toBe('00112233445566778899aabbccddeeff');
      expect(result.request.signDataHex).toBe(
        Buffer.from('hello btc', 'utf8').toString('hex'),
      );
      expect(result.request.derivationPath).toBe("m/84'/0'/0'/0/3");
      expect(result.request.address).toBe('bc1qexampleaddress');
      expect(result.request.origin).toBe('Sparrow');
    }
  });

  it('returns an error for malformed btc-sign-request CBOR', () => {
    const result = handleUR('btc-sign-request', Buffer.from([0xa0]));
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.message).toMatch(/Failed to parse BTC sign request/);
    }
  });

  it('returns an error for unsupported btc-sign-request data types', () => {
    const cbor = buildBtcSignRequestCbor('hello btc', "m/84'/0'/0'/0/3", {
      dataType: 2,
    });

    const result = handleUR('btc-sign-request', cbor);

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.message).toMatch(/Unsupported btc-sign-request data type/);
    }
  });
});

// ---------------------------------------------------------------------------
// encodeToUR
// ---------------------------------------------------------------------------

describe('encodeToUR', () => {
  it('returns a UR string with the given type prefix', () => {
    const cbor = new CryptoPSBT(
      Buffer.from('70736274ff01000a0200000000000000000000', 'hex'),
    ).toCBOR();
    const result = encodeToUR('crypto-psbt', cbor);
    expect(result).toMatch(/^ur:crypto-psbt\//i);
  });

  it('produces output decodable by URDecoder', () => {
    const cbor = new CryptoPSBT(
      Buffer.from('70736274ff01000a0200000000000000000000', 'hex'),
    ).toCBOR();
    const encoded = encodeToUR('crypto-psbt', cbor);
    const decoder = new URDecoder();
    decoder.receivePart(encoded);
    expect(decoder.isComplete()).toBe(true);
    expect(decoder.resultUR().type).toBe('crypto-psbt');
  });
});

// ---------------------------------------------------------------------------
// DATA_TYPE_LABELS
// ---------------------------------------------------------------------------

describe('DATA_TYPE_LABELS', () => {
  it('has correct labels for all ERC-4527 data types', () => {
    expect(DATA_TYPE_LABELS[1]).toBe('Legacy Transaction');
    expect(DATA_TYPE_LABELS[2]).toBe('EIP-712 Typed Data');
    expect(DATA_TYPE_LABELS[3]).toBe('Personal Message');
    expect(DATA_TYPE_LABELS[4]).toBe('Typed Transaction');
  });
});
