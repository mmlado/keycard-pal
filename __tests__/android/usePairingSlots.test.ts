import { act, renderHook } from '@testing-library/react-native';

import { usePairingSlots } from '../../src/hooks/keycard/usePairingSlots';

import { mockIsNFCEnabled, resetFakeCard } from '../fakeCard.testUtils';

jest.mock(
  'react-native-keycard',
  () => require('../fakeCard.testUtils').bridgeModule,
);
jest.mock('keycard-sdk', () => require('../fakeCard.testUtils').sdkModule());

jest.mock('../../src/storage/pairingStorage', () => ({
  loadPairing: jest.fn(),
}));

jest.mock('react-native-encrypted-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

// The host takes the read as it is, so NFC off must reach it as Open NFC Settings.
it('carries the NFC settings action when a read finds NFC off', async () => {
  resetFakeCard();
  mockIsNFCEnabled.mockResolvedValue(false);
  const { result } = renderHook(() => usePairingSlots());
  await act(async () => {
    result.current.checkSlots();
  });
  expect(result.current.tap.phase).toBe('error');
  expect(typeof result.current.tap.openNFCSettings).toBe('function');
});
