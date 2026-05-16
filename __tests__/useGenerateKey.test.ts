import { act, renderHook } from '@testing-library/react-native';

import { useGenerateKey } from '../src/hooks/keycard/useGenerateKey';

type OperationFn = (cmdSet: any) => Promise<string[]>;

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

jest.mock('keycard-sdk/dist/constants', () => ({
  Constants: {
    GENERATE_MNEMONIC_12_WORDS: 12,
    GENERATE_MNEMONIC_24_WORDS: 24,
  },
}));

const mockGetWords = jest.fn().mockReturnValue(['word1', 'word2']);
const mockSetWordlist = jest.fn();
jest.mock('keycard-sdk/dist/mnemonic', () => ({
  Mnemonic: jest.fn().mockImplementation(() => ({
    setWordlist: mockSetWordlist,
    getWords: mockGetWords,
  })),
}));

jest.mock('@scure/bip39/wordlists/english.js', () => ({
  wordlist: ['english', 'wordlist'],
}));

describe('useGenerateKey', () => {
  beforeEach(() => {
    mockStart.mockClear();
    capturedOperation = null;
    capturedOptions = null;
  });

  it('does not require PIN or master key', async () => {
    const { result } = renderHook(() => useGenerateKey(12));
    await act(async () => {
      result.current.start();
    });

    expect(capturedOptions).toEqual({
      requiresPin: false,
      requiresMasterKey: false,
    });
  });

  it('uses 12-word checksum constant for size 12', async () => {
    const { result } = renderHook(() => useGenerateKey(12));
    await act(async () => {
      result.current.start();
    });

    const checkOK = jest.fn();
    const data = new Uint8Array([1, 2, 3]);
    const words = await capturedOperation!({
      generateMnemonic: jest.fn().mockResolvedValue({ data, checkOK }),
    });

    expect(checkOK).toHaveBeenCalledTimes(1);
    expect(mockSetWordlist).toHaveBeenCalledWith(['english', 'wordlist']);
    expect(words).toEqual(['word1', 'word2']);
  });

  it('uses 24-word checksum constant for size 24', async () => {
    const { result } = renderHook(() => useGenerateKey(24));
    await act(async () => {
      result.current.start();
    });

    const generateMnemonic = jest
      .fn()
      .mockResolvedValue({ data: new Uint8Array(), checkOK: jest.fn() });
    await capturedOperation!({ generateMnemonic });

    expect(generateMnemonic).toHaveBeenCalledWith(24);
  });
});
