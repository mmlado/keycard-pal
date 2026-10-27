import { act, renderHook } from '@testing-library/react-native';

import { usePairingSlots } from '../../src/hooks/keycard/usePairingSlots';

jest.mock('react-native-keycard', () => ({
  __esModule: true,
  default: {
    Core: {
      onKeycardConnected: () => ({ remove: jest.fn() }),
      onKeycardDisconnected: () => ({ remove: jest.fn() }),
      onNFCUserCancelled: () => ({ remove: jest.fn() }),
      onNFCTimeout: () => ({ remove: jest.fn() }),
      startNFC: () => Promise.resolve(),
      stopNFC: () => Promise.resolve(),
      isNFCEnabled: () => Promise.resolve(false),
      openNFCSettings: () => Promise.resolve(true),
      setNFCMessage: () => Promise.resolve(true),
    },
    NFCCardChannel: class {},
  },
}));

jest.mock('keycard-sdk', () => ({
  __esModule: true,
  default: { Commandset: jest.fn() },
}));

jest.mock('../../src/storage/pairingStorage', () => ({
  loadPairing: jest.fn(),
}));

jest.mock('react-native-encrypted-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

// The host takes the read as it is, so NFC off must reach it as Open NFC Settings.
it('carries the NFC settings action when a read finds NFC off', async () => {
  const { result } = renderHook(() => usePairingSlots());
  await act(async () => {
    result.current.checkSlots();
  });
  expect(result.current.tap.phase).toBe('error');
  expect(typeof result.current.tap.openNFCSettings).toBe('function');
});
