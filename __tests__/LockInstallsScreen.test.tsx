import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import NFCBottomSheet from '../src/components/NFCBottomSheet';
import {
  ALREADY_LOCKED_TOAST,
  KEYSETS_UNCHECKED_DETAIL,
  KEYSETS_UNCHECKED_HEADING,
  LOCK_INSTALLS_INTRO,
  LOCK_INSTALLS_POINTS,
  OTHER_KEYSETS_HEADING,
  otherKeysetsDetail,
  otherKeysetsToast,
} from '../src/constants/installLock';
import LockInstallsScreen from '../src/screens/developerCards/LockInstallsScreen';
import { INSTALL_LOCK_PATH } from '../src/utils/installLock';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/components/NFCBottomSheet', () => jest.fn(() => null));
jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

const mockStart = jest.fn();
const mockUseLockInstalls = jest.fn();

jest.mock('../src/hooks/keycard/useInstallLock', () => ({
  useLockInstalls: () => mockUseLockInstalls(),
}));

const navigation = {
  addListener: jest.fn(() => jest.fn()),
  goBack: jest.fn(),
  reset: jest.fn(),
  setOptions: jest.fn(),
} as any;
const route = { key: 'LockInstalls', name: 'LockInstalls' } as any;

function renderScreen(phase = 'idle', outcome: string | null = null) {
  const result = outcome && {
    outcome,
    cardManagerKey: 'lock',
    ...(outcome === 'otherKeysets' && { otherKeyVersions: [0x02, 0x30] }),
  };
  mockUseLockInstalls.mockReturnValue({
    phase,
    status: '',
    result,
    successMessage: 'Applet installs locked',
    start: mockStart,
    cancel: jest.fn(),
    reset: jest.fn(),
    retry: jest.fn(),
    userCancels: 0,
  });
  return render(<LockInstallsScreen navigation={navigation} route={route} />);
}

function toastOfLastReset(): string | undefined {
  const [state] = navigation.reset.mock.calls.at(-1);
  return state.routes[0].params.toast;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LockInstallsScreen', () => {
  it('says what the lock does and what it costs before any tap', () => {
    renderScreen();
    expect(screen.getByText(LOCK_INSTALLS_INTRO)).toBeTruthy();
    for (const point of LOCK_INSTALLS_POINTS) {
      expect(screen.getByText(point)).toBeTruthy();
    }
  });

  it('names the recovery path in full', () => {
    renderScreen();
    expect(
      screen.getByText(new RegExp(INSTALL_LOCK_PATH.replace(/[/']/g, '.'))),
    ).toBeTruthy();
  });

  it('starts the lock from an NFC-marked button', () => {
    renderScreen();
    expect(screen.getByTestId('icon-nfcActivate')).toBeTruthy();
    fireEvent.press(screen.getByTestId('lock-installs'));
    expect(mockStart).toHaveBeenCalledWith({ action: 'lock' });
  });

  it('hides the explanation once the tap is under way', () => {
    renderScreen('nfc');
    expect(screen.queryByText(LOCK_INSTALLS_INTRO)).toBeNull();
  });

  it('reads each point as one line, without the bullet', () => {
    renderScreen();
    for (const point of LOCK_INSTALLS_POINTS) {
      expect(screen.getByLabelText(point)).toBeTruthy();
    }
  });

  it('leaves with the lock toast', () => {
    renderScreen('done', 'locked');
    expect(toastOfLastReset()).toBe('Applet installs locked');
  });

  it('says so when the card was already locked', () => {
    renderScreen('done', 'alreadyLocked');
    expect(toastOfLastReset()).toBe(ALREADY_LOCKED_TOAST);
  });

  it('shows the success mark for a lock the key list confirms', () => {
    renderScreen('done', 'locked');
    expect(jest.mocked(NFCBottomSheet).mock.lastCall?.[0].showOnDone).toBe(
      true,
    );
  });

  describe.each([
    [
      'otherKeysets',
      OTHER_KEYSETS_HEADING,
      otherKeysetsDetail([0x02, 0x30]),
      otherKeysetsToast([0x02, 0x30]),
    ],
    [
      'keysetsUnchecked',
      KEYSETS_UNCHECKED_HEADING,
      KEYSETS_UNCHECKED_DETAIL,
      KEYSETS_UNCHECKED_HEADING,
    ],
  ])('a lock that ends as %s', (outcome, heading, detail, toast) => {
    it('stays on what the key list says, with no success mark', () => {
      renderScreen('done', outcome);
      expect(navigation.reset).not.toHaveBeenCalled();
      expect(screen.getByText(heading)).toBeTruthy();
      expect(screen.getByText(detail)).toBeTruthy();
      expect(jest.mocked(NFCBottomSheet).mock.lastCall?.[0].showOnDone).toBe(
        false,
      );
    });

    it('leaves on Done with its own toast', () => {
      renderScreen('done', outcome);
      fireEvent.press(screen.getByTestId('lock-done'));
      expect(toastOfLastReset()).toBe(toast);
    });
  });

  it('names every other keyset by its key version', () => {
    expect(otherKeysetsDetail([0x02])).toContain(
      'a keyset at key version 0x02',
    );
    expect(otherKeysetsToast([0x02, 0x30, 0xff])).toContain(
      'keysets at key versions 0x02, 0x30 and 0xFF',
    );
  });
});
