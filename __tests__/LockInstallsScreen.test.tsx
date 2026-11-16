import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import NFCBottomSheet from '../src/components/NFCBottomSheet';
import {
  ALREADY_LOCKED_TOAST,
  LOCK_INSTALLS_INTRO,
  LOCK_INSTALLS_POINTS,
  LOCK_NOT_CONFIRMED_HEADING,
  LOCK_NOT_FULLY_CHECKED_HEADING,
  lockFindingLines,
  lockFindingsHeading,
} from '../src/constants/installLock';
import LockInstallsScreen from '../src/screens/developerCards/LockInstallsScreen';
import { INSTALL_LOCK_PATH, LockFindings } from '../src/utils/installLock';

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

const findings = (found: Partial<LockFindings>): LockFindings => ({
  notSecured: null,
  otherDomains: [],
  otherKeyVersions: [],
  unchecked: [],
  ...found,
});

const EVERY_FINDING = findings({
  notSecured: 'INITIALIZED',
  otherDomains: [
    {
      aid: 'A0000001515350',
      securityDomain: true,
      privileges: ['Authorized Management', 'Global Delete'],
    },
  ],
  otherKeyVersions: [0x02, 0x30],
  unchecked: ['keys'],
});

function renderScreen(
  phase = 'idle',
  outcome: string | null = null,
  found?: LockFindings,
) {
  const result = outcome && {
    outcome,
    cardManagerKey: 'lock',
    ...(found && { findings: found }),
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
    ['something it found', EVERY_FINDING, LOCK_NOT_CONFIRMED_HEADING],
    [
      'only checks that failed',
      findings({ unchecked: ['domains', 'keys'] }),
      LOCK_NOT_FULLY_CHECKED_HEADING,
    ],
  ])('a lock with %s', (_, found, heading) => {
    it('stays on every finding under its heading, with no success mark', () => {
      renderScreen('done', 'unconfirmed', found);
      expect(navigation.reset).not.toHaveBeenCalled();
      expect(screen.getByRole('header').props.children).toBe(heading);
      for (const line of lockFindingLines(found)) {
        expect(screen.getByLabelText(line)).toBeTruthy();
      }
      expect(jest.mocked(NFCBottomSheet).mock.lastCall?.[0].showOnDone).toBe(
        false,
      );
    });

    it('leaves on Done with the heading as its toast', () => {
      renderScreen('done', 'unconfirmed', found);
      fireEvent.press(screen.getByTestId('lock-done'));
      expect(toastOfLastReset()).toBe(heading);
    });
  });

  it.each<[string, Partial<LockFindings>]>([
    ['a card left INITIALIZED', { notSecured: 'INITIALIZED' }],
    [
      'another domain',
      {
        otherDomains: [
          {
            aid: 'A0000001515350',
            securityDomain: true,
            privileges: ['Global Delete'],
          },
        ],
      },
    ],
    ['another keyset', { otherKeyVersions: [0x02] }],
    ['a state it could not check', { unchecked: ['state'] }],
    [
      'a finding beside a check that failed',
      { notSecured: 'OP_READY', unchecked: ['keys'] },
    ],
  ])('does not call the card locked for %s alone', (_, found) => {
    expect(lockFindingsHeading(findings(found))).toBe(
      LOCK_NOT_CONFIRMED_HEADING,
    );
  });

  it.each<[string, LockFindings['unchecked']]>([
    ['the keys', ['keys']],
    ['the domains', ['domains']],
    ['both', ['domains', 'keys']],
  ])(
    'calls the card locked, not fully checked, when only %s went unchecked',
    (_, unchecked) => {
      expect(lockFindingsHeading(findings({ unchecked }))).toBe(
        LOCK_NOT_FULLY_CHECKED_HEADING,
      );
    },
  );

  it('words each finding in GlobalPlatform terms', () => {
    expect(lockFindingLines(EVERY_FINDING)).toEqual([
      'The card manager is INITIALIZED, not SECURED.',
      'Security domain A0000001515350 can still manage applets: Authorized Management, Global Delete.',
      'The card manager also has keysets at key versions 0x02 and 0x30, which the lock did not replace.',
      "The card manager's keys could not be checked.",
    ]);
    expect(
      lockFindingLines(
        findings({
          otherDomains: [
            {
              aid: 'D2760000850101',
              securityDomain: false,
              privileges: ['Global Delete'],
            },
          ],
          otherKeyVersions: [0x02],
          unchecked: ['state', 'domains'],
        }),
      ),
    ).toEqual([
      'Application D2760000850101 can still manage applets: Global Delete.',
      'The card manager also has a keyset at key version 0x02, which the lock did not replace.',
      "The card manager's state could not be checked.",
      'The security domains could not be checked.',
    ]);
  });
});
