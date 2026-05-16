import { act, renderHook } from '@testing-library/react-native';
import type { BIP32KeyPair } from 'keycard-sdk/dist/bip32key';

import {
  deriveMnemonicKeyPair,
  useLoadKey,
} from '../src/hooks/keycard/useLoadKey';

const mockToBinarySeed = jest.fn().mockReturnValue(Buffer.from('seed'));
const mockFromBinarySeed = jest.fn().mockReturnValue({ type: 'keypair' });
type OperationFn = (cmdSet: any) => Promise<void>;

let capturedOperation: OperationFn | null = null;
let capturedOptions: {
  requiresPin?: boolean;
  requiresMasterKey?: boolean;
} | null = null;

const mockStart = jest.fn();

jest.mock('../src/hooks/keycard/useKeycardOperation', () => ({
  useKeycardOp: (
    fn: OperationFn,
    opts: { requiresPin?: boolean; requiresMasterKey?: boolean },
  ) => {
    capturedOperation = fn;
    capturedOptions = opts;
    return {
      phase: 'idle',
      status: '',
      result: null,
      start: mockStart,
      cancel: jest.fn(),
      reset: jest.fn(),
      submitPin: jest.fn(),
    };
  },
}));

jest.mock('keycard-sdk/dist/mnemonic', () => ({
  Mnemonic: { toBinarySeed: (...args: any[]) => mockToBinarySeed(...args) },
}));

jest.mock('keycard-sdk/dist/bip32key', () => ({
  BIP32KeyPair: {
    fromBinarySeed: (...args: any[]) => mockFromBinarySeed(...args),
  },
}));

const WORDS = [
  'word1',
  'word2',
  'word3',
  'word4',
  'word5',
  'word6',
  'word7',
  'word8',
  'word9',
  'word10',
  'word11',
  'word12',
];
const preparedKeyPair = { type: 'keypair' } as unknown as BIP32KeyPair;

describe('deriveMnemonicKeyPair', () => {
  beforeEach(() => {
    mockStart.mockClear();
    mockToBinarySeed.mockClear();
    mockFromBinarySeed.mockClear();
    mockFromBinarySeed.mockReturnValue({ type: 'keypair' });
    capturedOperation = null;
    capturedOptions = null;
  });

  it('derives a BIP32 key pair from words', () => {
    const keyPair = deriveMnemonicKeyPair(WORDS);

    expect(keyPair).toEqual({ type: 'keypair' });
    expect(mockToBinarySeed).toHaveBeenCalledWith(WORDS.join(' '), undefined);
    expect(mockFromBinarySeed).toHaveBeenCalledWith(Buffer.from('seed'));
  });

  it('passes passphrase to toBinarySeed when provided', () => {
    deriveMnemonicKeyPair(WORDS, 'my passphrase');

    expect(mockToBinarySeed).toHaveBeenCalledWith(
      WORDS.join(' '),
      'my passphrase',
    );
  });

  it('passes undefined passphrase to toBinarySeed when not provided', () => {
    deriveMnemonicKeyPair(WORDS);

    expect(mockToBinarySeed).toHaveBeenCalledWith(WORDS.join(' '), undefined);
  });
});

describe('useLoadKey', () => {
  beforeEach(() => {
    mockStart.mockClear();
    capturedOperation = null;
    capturedOptions = null;
  });

  it('requests PIN before loading the prepared keypair', async () => {
    const { result } = renderHook(() => useLoadKey());
    await act(async () => {
      result.current.start(preparedKeyPair);
    });

    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(capturedOptions).toEqual({
      requiresPin: true,
      requiresMasterKey: false,
    });
  });

  it('loads the prepared BIP32 keypair onto an empty card', async () => {
    const { result } = renderHook(() => useLoadKey());
    await act(async () => {
      result.current.start(preparedKeyPair);
    });
    const checkOK = jest.fn();
    const cmdSet = {
      applicationInfo: { hasMasterKey: () => false },
      loadBIP32KeyPair: jest.fn().mockResolvedValue({ checkOK }),
    };

    await capturedOperation!(cmdSet);

    expect(cmdSet.loadBIP32KeyPair).toHaveBeenCalledWith(preparedKeyPair);
    expect(checkOK).toHaveBeenCalledTimes(1);
  });

  it('rejects cards that already have a master key', async () => {
    const { result } = renderHook(() => useLoadKey());
    await act(async () => {
      result.current.start(preparedKeyPair);
    });

    await expect(
      capturedOperation!({
        applicationInfo: { hasMasterKey: () => true },
        loadBIP32KeyPair: jest.fn(),
      }),
    ).rejects.toThrow(/already has a key/);
  });
});
