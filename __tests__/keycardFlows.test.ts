import { XPUB_EXPLAINER } from '../src/constants/exportKey';
import { signingDigest, classifyEthPayload } from '../src/utils/ethPayload';
import { prepareKeycardFlow } from '../src/utils/keycardFlows';

jest.mock('../src/utils/ethSignature', () => ({
  buildEthSignatureURFromResult: jest.fn(() => 'ur:eth-signature/mock'),
  buildRawEthHexSignature: jest.fn(() => '0xrawsig'),
}));

jest.mock('../src/utils/btcPsbt', () => ({
  BtcSigningSession: jest.fn(),
  buildCryptoPsbtUR: jest.fn(() => 'ur:crypto-psbt/mock'),
}));

jest.mock('../src/utils/btcMessage', () => ({
  hashBitcoinMessage: jest.fn(() => new Uint8Array(32).fill(0x77)),
  parseKeycardBtcMessageSignature: jest.fn(() => ({
    signature: Buffer.alloc(65, 0x11),
    publicKey: Buffer.alloc(33, 0x02),
  })),
  buildBtcSignatureUR: jest.fn(() => 'ur:btc-signature/mock'),
}));

jest.mock('../src/utils/keycardExport', () => ({
  exportKeysForTarget: jest.fn(),
  makeExportResumeCache: jest.fn(() => ({
    keyUid: null,
    masterFingerprint: null,
    parentFingerprints: new Map(),
    keys: new Map(),
  })),
}));

jest.mock('../src/utils/cryptoHdKey', () => ({
  buildCryptoHdKeyUR: jest.fn(() => 'ur:crypto-hdkey/mock'),
}));

const {
  buildEthSignatureURFromResult,
  buildRawEthHexSignature,
} = require('../src/utils/ethSignature');
const {
  BtcSigningSession,
  buildCryptoPsbtUR,
} = require('../src/utils/btcPsbt');
const {
  hashBitcoinMessage,
  parseKeycardBtcMessageSignature,
  buildBtcSignatureUR,
} = require('../src/utils/btcMessage');
const { exportKeysForTarget } = require('../src/utils/keycardExport');

const DIGEST_HEX = 'ab'.repeat(32);

const ethParams = {
  operation: 'sign',
  signMode: 'eth',
  signData: DIGEST_HEX,
  dataType: 2,
  derivationPath: "m/44'/60'/0'/0",
  chainId: 1,
  requestId: 'req-1',
} as any;

beforeEach(() => {
  jest.clearAllMocks();
  buildEthSignatureURFromResult.mockReturnValue('ur:eth-signature/mock');
  buildRawEthHexSignature.mockReturnValue('0xrawsig');
  buildCryptoPsbtUR.mockReturnValue('ur:crypto-psbt/mock');
  hashBitcoinMessage.mockReturnValue(new Uint8Array(32).fill(0x77));
  buildBtcSignatureUR.mockReturnValue('ur:btc-signature/mock');
});

describe('eth sign flow', () => {
  it('cardOp signs the classified payload digest with the derivation path', async () => {
    const flowRun = prepareKeycardFlow(ethParams);
    const checkOK = jest.fn();
    const signWithPath = jest.fn().mockResolvedValue({
      checkOK,
      data: new Uint8Array([0xde, 0xad]),
    });

    const result = await flowRun.cardOp({ signWithPath } as any, jest.fn());

    const expectedHash = signingDigest(
      classifyEthPayload(ethParams.signData, ethParams.dataType),
    );
    expect(signWithPath).toHaveBeenCalledWith(
      expectedHash,
      ethParams.derivationPath,
      false,
    );
    expect(checkOK).toHaveBeenCalled();
    expect(result).toEqual(new Uint8Array([0xde, 0xad]));
  });

  it('buildOutput returns a UR outcome wired to the same classification', () => {
    const flowRun = prepareKeycardFlow(ethParams);
    const cardResult = new Uint8Array(65).fill(0x01);

    const outcome = flowRun.buildOutput(cardResult);

    const expectedHash = signingDigest(
      classifyEthPayload(ethParams.signData, ethParams.dataType),
    );
    expect(buildEthSignatureURFromResult).toHaveBeenCalledWith(
      cardResult,
      expectedHash,
      'raw-digest',
      ethParams.chainId,
      ethParams.requestId,
    );
    expect(outcome).toEqual({
      kind: 'ur',
      urString: 'ur:eth-signature/mock',
      title: 'Show signature to the wallet',
      doneNavigation: 'sign',
    });
  });

  it('buildOutput returns a wc-signature outcome when wcContext is present', () => {
    const flowRun = prepareKeycardFlow({
      ...ethParams,
      wcContext: { id: 1, topic: 't' },
    });
    const cardResult = new Uint8Array(65).fill(0x02);

    const outcome = flowRun.buildOutput(cardResult);

    expect(buildRawEthHexSignature).toHaveBeenCalledWith(
      cardResult,
      expect.any(Uint8Array),
      'raw-digest',
      ethParams.chainId,
    );
    expect(outcome).toEqual({ kind: 'wc-signature', rawSig: '0xrawsig' });
    expect(buildEthSignatureURFromResult).not.toHaveBeenCalled();
  });

  it('prepare throws for a payload that classifies as invalid', () => {
    expect(() =>
      prepareKeycardFlow({ ...ethParams, signData: 'ab'.repeat(31) }),
    ).toThrow(/Cannot sign/);
  });
});

describe('btc PSBT flow', () => {
  it('prepare constructs the signing session before NFC and throws on a malformed PSBT', () => {
    BtcSigningSession.mockImplementationOnce(() => {
      throw new Error('Invalid PSBT payload');
    });
    expect(() =>
      prepareKeycardFlow({
        operation: 'sign',
        signMode: 'btc',
        psbtHex: 'not-a-psbt',
      } as any),
    ).toThrow('Invalid PSBT payload');
    expect(BtcSigningSession).toHaveBeenCalledWith('not-a-psbt');
  });

  it('cardOp signs with the prepared session; buildOutput encodes the signed PSBT', async () => {
    const signWithKeycard = jest
      .fn()
      .mockResolvedValue({ psbtHex: 'signed-hex' });
    BtcSigningSession.mockImplementationOnce(() => ({ signWithKeycard }));

    const flowRun = prepareKeycardFlow({
      operation: 'sign',
      signMode: 'btc',
      psbtHex: 'deadbeef',
    } as any);

    const setStatus = jest.fn();
    const cmdSet = {} as any;
    const result = await flowRun.cardOp(cmdSet, setStatus);
    expect(signWithKeycard).toHaveBeenCalledWith(cmdSet, setStatus);
    expect(result).toEqual({ psbtHex: 'signed-hex' });

    const outcome = flowRun.buildOutput(result);
    expect(buildCryptoPsbtUR).toHaveBeenCalledWith('signed-hex');
    expect(outcome).toEqual({
      kind: 'ur',
      urString: 'ur:crypto-psbt/mock',
      title: 'Show signature to the wallet',
      doneNavigation: 'sign',
    });
  });
});

describe('btc message flow', () => {
  const params = {
    operation: 'sign',
    signMode: 'btc-message',
    requestId: 'req-2',
    signDataHex: 'cafebabe',
    derivationPath: "m/84'/0'/0'/0/3",
  } as any;

  it('hashes at prepare time and signs the hash with the requested path', async () => {
    const flowRun = prepareKeycardFlow(params);
    expect(hashBitcoinMessage).toHaveBeenCalledWith('cafebabe');

    const checkOK = jest.fn();
    const signWithPath = jest.fn().mockResolvedValue({
      checkOK,
      data: new Uint8Array([0x99]),
    });
    await flowRun.cardOp({ signWithPath } as any, jest.fn());

    expect(signWithPath).toHaveBeenCalledWith(
      new Uint8Array(32).fill(0x77),
      params.derivationPath,
      false,
    );
    expect(checkOK).toHaveBeenCalled();
  });

  it('buildOutput parses the keycard signature against the prepared hash', () => {
    const flowRun = prepareKeycardFlow(params);
    const cardResult = new Uint8Array([0x99]);

    const outcome = flowRun.buildOutput(cardResult);

    expect(parseKeycardBtcMessageSignature).toHaveBeenCalledWith(
      new Uint8Array(32).fill(0x77),
      cardResult,
    );
    expect(buildBtcSignatureUR).toHaveBeenCalledWith({
      requestId: 'req-2',
      signature: Buffer.alloc(65, 0x11),
      publicKey: Buffer.alloc(33, 0x02),
    });
    expect(outcome).toEqual({
      kind: 'ur',
      urString: 'ur:btc-signature/mock',
      title: 'Show signature to the wallet',
      doneNavigation: 'sign',
    });
  });
});

describe('export key flow', () => {
  const params = { operation: 'export_key', target: 'ethereum' } as any;
  const { getExportTarget } = jest.requireActual('../src/utils/exportTargets');

  it("cardOp delegates to exportKeysForTarget with the target's plan", async () => {
    const exportResult = { masterFingerprint: 1, keys: [] };
    exportKeysForTarget.mockResolvedValue(exportResult);

    const flowRun = prepareKeycardFlow(params);
    const setStatus = jest.fn();
    const cmdSet = {} as any;

    await expect(flowRun.cardOp(cmdSet, setStatus)).resolves.toBe(exportResult);
    expect(exportKeysForTarget).toHaveBeenCalledWith(
      cmdSet,
      getExportTarget('ethereum').keys,
      setStatus,
      // The per-flow resume cache: created in prepare, reused across re-taps.
      expect.objectContaining({ keyUid: null }),
    );
  });

  it('reuses one resume cache across cardOp re-invocations (reconnect resume)', async () => {
    exportKeysForTarget.mockResolvedValue({ masterFingerprint: 1, keys: [] });
    const flowRun = prepareKeycardFlow(params);
    const setStatus = jest.fn();

    await flowRun.cardOp({} as any, setStatus);
    await flowRun.cardOp({} as any, setStatus);

    const firstCache = exportKeysForTarget.mock.calls[0][3];
    const secondCache = exportKeysForTarget.mock.calls[1][3];
    expect(firstCache).toBeDefined();
    expect(secondCache).toBe(firstCache);

    // A fresh prepare gets a fresh cache — resume never outlives the flow.
    const nextRun = prepareKeycardFlow(params);
    await nextRun.cardOp({} as any, setStatus);
    expect(exportKeysForTarget.mock.calls[2][3]).not.toBe(firstCache);
  });

  it("buildOutput builds the target's UR with the xpub explainer and export navigation", () => {
    const flowRun = prepareKeycardFlow(params);
    const exportResult = {
      masterFingerprint: 0xaa,
      keys: [
        {
          entry: { derivationPath: "m/44'/60'/0'", parentPath: "m/44'/60'" },
          exportRespData: new Uint8Array([1]),
          parentFingerprint: 0xbb,
        },
      ],
    };

    const outcome = flowRun.buildOutput(exportResult);

    // The ethereum target's buildUr feeds the mocked crypto-hdkey builder.
    const { buildCryptoHdKeyUR } = require('../src/utils/cryptoHdKey');
    expect(buildCryptoHdKeyUR).toHaveBeenCalledWith(
      new Uint8Array([1]),
      "m/44'/60'/0'",
      0xaa,
      0xbb,
      'account.standard',
    );
    expect(outcome).toEqual({
      kind: 'ur',
      urString: 'ur:crypto-hdkey/mock',
      title: 'Show key to the wallet',
      description: XPUB_EXPLAINER,
      doneNavigation: 'export',
    });
  });
});
