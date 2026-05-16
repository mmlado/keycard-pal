/* eslint-disable no-bitwise */

import { act, renderHook } from '@testing-library/react-native';

import { useSetCardName } from '../src/hooks/keycard/useSetCardName';

type OperationFn = (cmdSet: any, helpers: any) => Promise<void>;

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
      cardName: null,
      result: null,
      start: mockStart,
      cancel: jest.fn(),
      reset: jest.fn(),
      submitPin: jest.fn(),
    };
  },
}));

describe('useSetCardName', () => {
  beforeEach(() => {
    mockStart.mockClear();
    capturedOperation = null;
    capturedOptions = null;
  });

  it('writes the encoded card name with PIN verification', async () => {
    const { result } = renderHook(() => useSetCardName());
    await act(async () => {
      result.current.start('Vault');
    });

    expect(capturedOptions).toEqual({
      requiresPin: true,
      requiresMasterKey: false,
    });

    const storeData = jest.fn().mockResolvedValue({ sw: 0x9000 });
    const getData = jest.fn().mockResolvedValue({
      sw: 0x9000,
      data: new Uint8Array([0x20 | 3, 0x6f, 0x6c, 0x64, 0x40, 0xaa]),
    });
    const setStatus = jest.fn();
    await capturedOperation!(
      {
        applicationInfo: { instanceUID: new Uint8Array([0xaa, 0xbb]) },
        getData,
        storeData,
      },
      { setStatus },
    );

    expect(setStatus).toHaveBeenCalledWith('Writing card name...');
    expect(storeData).toHaveBeenCalledWith(
      new Uint8Array([0x20 | 5, 0x56, 0x61, 0x75, 0x6c, 0x74, 0x40, 0xaa]),
      0x00,
    );
  });

  it('throws when reading current metadata fails', async () => {
    const { result } = renderHook(() => useSetCardName());
    await act(async () => {
      result.current.start('Vault');
    });

    await expect(
      capturedOperation!(
        {
          getData: jest.fn().mockResolvedValue({ sw: 0x6f00 }),
          storeData: jest.fn(),
        },
        { setStatus: jest.fn() },
      ),
    ).rejects.toThrow('GET DATA failed: 0x6F00');
  });

  it('throws when writing card metadata fails', async () => {
    const { result } = renderHook(() => useSetCardName());
    await act(async () => {
      result.current.start('Vault');
    });

    await expect(
      capturedOperation!(
        {
          getData: jest.fn().mockResolvedValue({
            sw: 0x9000,
            data: new Uint8Array([0x20]),
          }),
          storeData: jest.fn().mockResolvedValue({ sw: 0x6985 }),
        },
        { setStatus: jest.fn() },
      ),
    ).rejects.toThrow('STORE DATA failed: 0x6985');
  });

  it('throws before NFC when the name is too long', () => {
    const { result } = renderHook(() => useSetCardName());
    expect(() => result.current.start('x'.repeat(21))).toThrow(
      'Card name must be 20 bytes or fewer.',
    );
    expect(mockStart).not.toHaveBeenCalled();
  });
});
