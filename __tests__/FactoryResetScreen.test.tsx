import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import FactoryResetScreen, {
  dashboardEntry,
} from '../src/screens/FactoryResetScreen';
import NFCBottomSheet from '../src/components/NFCBottomSheet';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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
const MockNFCBottomSheet = NFCBottomSheet as jest.MockedFunction<
  typeof NFCBottomSheet
>;

jest.mock('../src/assets/icons', () => ({
  Icons: { nfcActivate: () => null },
}));

const mockStart = jest.fn();
const mockCancel = jest.fn();
const mockReset = jest.fn();
const mockUseFactoryReset = jest.fn();

jest.mock('../src/hooks/keycard/useFactoryReset', () => ({
  useFactoryReset: () => mockUseFactoryReset(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const navigation = {
  addListener: jest.fn(() => jest.fn()),
  goBack: jest.fn(),
  reset: jest.fn(),
  setOptions: jest.fn(),
} as any;

const route = { key: 'FactoryReset', name: 'FactoryReset' } as any;

function hookMock(phase: string) {
  return {
    phase,
    status: '',
    result: null,
    start: mockStart,
    cancel: mockCancel,
    reset: mockReset,
  };
}

function renderScreen(phase = 'idle') {
  mockUseFactoryReset.mockReturnValue(hookMock(phase));
  return render(<FactoryResetScreen navigation={navigation} route={route} />);
}

function pressableForText(text: string | RegExp) {
  let node: any = screen.getByText(text);
  while (node) {
    if (typeof node.props?.onPress === 'function') {
      return node;
    }
    node = node.parent;
  }
  throw new Error(`No pressable found for ${String(text)}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FactoryResetScreen', () => {
  beforeEach(() => {
    mockStart.mockClear();
    mockCancel.mockClear();
    mockReset.mockClear();
    MockNFCBottomSheet.mockClear();
    navigation.goBack.mockClear();
    navigation.reset.mockClear();
    navigation.setOptions.mockClear();
  });

  // -------------------------------------------------------------------------
  // Content when idle
  // -------------------------------------------------------------------------

  describe('idle content', () => {
    it('sets the header title to "Factory reset"', async () => {
      await renderScreen('idle');
      expect(navigation.setOptions).toHaveBeenCalledWith({
        title: 'Factory reset',
      });
    });

    it('shows the warning description', () => {
      renderScreen('idle');
      expect(
        screen.getByText(/Factory reset will permanently erase the keypair/),
      ).toBeTruthy();
      expect(
        screen.getByText(/backed up your recovery phrase before proceeding/),
      ).toBeTruthy();
    });

    it('shows the backup checkbox label', () => {
      renderScreen('idle');
      expect(screen.getByText(/I have a backup/)).toBeTruthy();
    });

    it('shows the "Factory reset Keycard" button', () => {
      renderScreen('idle');
      expect(screen.getByText('Factory reset Keycard')).toBeTruthy();
    });

    it('does not show the idle content when not idle', () => {
      renderScreen('nfc');
      expect(screen.queryByText('Factory reset Keycard')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Button state
  // -------------------------------------------------------------------------

  describe('button state', () => {
    it('the reset button is disabled initially', () => {
      renderScreen('idle');
      expect(pressableForText('Factory reset Keycard').props.disabled).toBe(
        true,
      );
    });

    it('the reset button becomes active after checking the checkbox', () => {
      renderScreen('idle');
      fireEvent.press(screen.getByText(/I have a backup/));
      expect(pressableForText('Factory reset Keycard').props.disabled).toBe(
        false,
      );
    });

    it('calls start() when reset button is pressed after checking checkbox', () => {
      renderScreen('idle');
      fireEvent.press(screen.getByText(/I have a backup/));
      fireEvent.press(screen.getByText('Factory reset Keycard'));
      expect(mockStart).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // NFCBottomSheet visibility
  // -------------------------------------------------------------------------

  describe('NFCBottomSheet visibility', () => {
    function lastProps() {
      const calls = MockNFCBottomSheet.mock.calls;
      return calls[calls.length - 1][0];
    }

    it('nfc.phase is idle when phase is idle', async () => {
      await renderScreen('idle');
      expect(lastProps().nfc.phase).toBe('idle');
    });

    it('nfc.phase is nfc when phase is nfc', async () => {
      await renderScreen('nfc');
      expect(lastProps().nfc.phase).toBe('nfc');
    });

    it('nfc.phase is error when phase is error', async () => {
      await renderScreen('error');
      expect(lastProps().nfc.phase).toBe('error');
    });

    it('nfc.phase is done and showOnDone is true when phase is done', async () => {
      await renderScreen('done');
      expect(lastProps().nfc.phase).toBe('done');
      expect(lastProps().showOnDone).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Navigation after done
  // -------------------------------------------------------------------------

  describe('navigation', () => {
    it('resets to Dashboard with toast when phase is done', async () => {
      await renderScreen('done');
      expect(navigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [
          { name: 'Dashboard', params: { toast: 'Factory reset done' } },
        ],
      });
    });

    it('does not navigate when phase is not done', async () => {
      await renderScreen('idle');
      expect(navigation.reset).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // dashboardEntry export
  // -------------------------------------------------------------------------

  describe('dashboardEntry', () => {
    it('has the correct label', () => {
      expect(dashboardEntry.label).toBe('Factory reset');
    });

    it('navigates to FactoryReset when invoked', () => {
      const nav = { navigate: jest.fn() } as any;
      dashboardEntry.navigate(nav);
      expect(nav.navigate).toHaveBeenCalledWith('FactoryReset');
    });
  });
});
