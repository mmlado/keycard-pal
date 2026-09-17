import React from 'react';
import { Linking, Platform, StyleSheet } from 'react-native';
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import NFCBottomSheet from '../src/components/NFCBottomSheet';
import type { NFCOperation } from '../src/components/NFCBottomSheet';
import type { KeycardPhase } from '../src/hooks/keycard/useKeycardOperation';
import {
  AFFILIATE_DISCLOSURE,
  BUY_KEYCARD_LABEL,
  KEYCARD_PURCHASE_URL,
} from '../src/constants/keycard';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };

let mockConnected = true;
jest.mock('../src/utils/connectivity.online', () => ({
  getNetworkConnected: () => mockConnected,
  subscribeNetworkConnected: () => () => {},
  isNetworkConnected: () => Promise.resolve(mockConnected),
}));

const mockNavigate = jest.fn();
jest.mock('../src/navigation/navigationRef', () => ({
  navigationRef: {
    isReady: () => true,
    navigate: (...args: any[]) => mockNavigate(...args),
  },
}));

const BUY_KEYCARD_LINK = "Don't have a Keycard?";
const PURCHASE_URL = KEYCARD_PURCHASE_URL;

async function pressBuyKeycardLink() {
  await act(async () => {
    fireEvent.press(screen.getByText(BUY_KEYCARD_LINK));
  });
}

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    useSafeAreaInsets: () => mockInsets,
    SafeAreaView: View,
  };
});

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/components/PinPad', () => {
  const { View } = require('react-native');
  return () => <View testID="pin-pad" />;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const onCancel = jest.fn();

function makeNfc(
  phase: KeycardPhase,
  extra: Partial<NFCOperation> = {},
): NFCOperation {
  return { phase, status: 'Ready', ...extra };
}

beforeEach(() => {
  onCancel.mockClear();
  mockNavigate.mockClear();
  mockConnected = true;
  mockInsets.bottom = 0;
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  (Linking.openURL as jest.Mock).mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

function renderSheet(nfc: NFCOperation, showOnDone?: boolean) {
  return render(
    <NFCBottomSheet nfc={nfc} onCancel={onCancel} showOnDone={showOnDone} />,
  );
}

// ---------------------------------------------------------------------------
// Android sheet tests (showSheet = Platform.OS === 'android')
// ---------------------------------------------------------------------------

describe('NFCBottomSheet — Android sheet', () => {
  let origOS: typeof Platform.OS;

  beforeAll(() => {
    origOS = Platform.OS;
    Platform.OS = 'android';
  });

  afterAll(() => {
    Platform.OS = origOS;
  });

  describe('status text', () => {
    it('renders the status string', () => {
      renderSheet(makeNfc('nfc', { status: 'Waiting for card…' }));
      expect(screen.getByText('Waiting for card…')).toBeTruthy();
    });

    it('shows the card name after it is read', () => {
      renderSheet(makeNfc('nfc', { cardName: 'Main card' }));
      expect(screen.getByText('Main card')).toBeTruthy();
    });

    it('shows unnamed placeholder for a blank card name', () => {
      renderSheet(makeNfc('nfc', { cardName: '' }));
      expect(screen.getByText('Unnamed card')).toBeTruthy();
    });
  });

  describe('Cancel button — phase nfc (scanning)', () => {
    it('shows the Cancel button', () => {
      renderSheet(makeNfc('nfc'));
      expect(screen.getByText('Cancel')).toBeTruthy();
    });

    it('calls onCancel when Cancel is pressed', () => {
      renderSheet(makeNfc('nfc'));
      fireEvent.press(screen.getByText('Cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cancel button — phase error', () => {
    it('shows the Cancel button', () => {
      renderSheet(makeNfc('error'));
      expect(screen.getByText('Cancel')).toBeTruthy();
    });

    it('calls onCancel when Cancel is pressed', () => {
      renderSheet(makeNfc('error'));
      fireEvent.press(screen.getByText('Cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('shows tap-again retry hint', () => {
      renderSheet(makeNfc('error', { status: 'Bad MAC' }));
      expect(screen.getByText('Tap your card to try again')).toBeTruthy();
    });
  });

  // T5: variant selection — phase always wins over presence, and an omitted
  // cardPresence behaves exactly as before the field existed.
  describe('cardPresence variant selection', () => {
    it('phase nfc + presence lost renders the disconnected hint', () => {
      renderSheet(makeNfc('nfc', { cardPresence: 'lost' }));
      expect(
        screen.getByText('Hold your Keycard against the phone again'),
      ).toBeTruthy();
    });

    it('phase nfc + presence connected renders no hints', () => {
      renderSheet(makeNfc('nfc', { cardPresence: 'connected' }));
      expect(screen.queryByText('Tap your card to try again')).toBeNull();
      expect(
        screen.queryByText('Hold your Keycard against the phone again'),
      ).toBeNull();
    });

    it('phase error + presence lost: error UI wins', () => {
      renderSheet(makeNfc('error', { cardPresence: 'lost' }));
      expect(screen.getByText('Tap your card to try again')).toBeTruthy();
      expect(
        screen.queryByText('Hold your Keycard against the phone again'),
      ).toBeNull();
    });

    it('phase error with retry: the sheet offers Try again and it fires', () => {
      const retry = jest.fn();
      renderSheet(makeNfc('error', { retry }));
      fireEvent.press(screen.getByText('Try again'));
      expect(retry).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Tap your card to try again')).toBeNull();
    });

    it('phase done + presence lost: success UI wins', () => {
      renderSheet(makeNfc('done', { cardPresence: 'lost' }), true);
      expect(
        screen.queryByText('Hold your Keycard against the phone again'),
      ).toBeNull();
      expect(screen.queryByText('Cancel')).toBeNull();
    });

    it('omitted cardPresence behaves as scanning (back-compat)', () => {
      renderSheet(makeNfc('nfc'));
      expect(screen.getByText('Cancel')).toBeTruthy();
      expect(
        screen.queryByText('Hold your Keycard against the phone again'),
      ).toBeNull();
    });
  });

  // #258: the no-card exit ends the session exactly like Cancel (which may
  // also leave the host screen) before opening the shop, so the sheet never
  // sits over the browser or the QR screen.
  describe('buy-a-Keycard link', () => {
    it('shows the link while waiting for a card', () => {
      renderSheet(makeNfc('nfc'));
      expect(screen.getByText(BUY_KEYCARD_LINK)).toBeTruthy();
      expect(screen.getByTestId('affiliate-disclosure')).toBeTruthy();
    });

    it('hides the link once a card is connected', () => {
      renderSheet(makeNfc('nfc', { cardPresence: 'connected' }));
      expect(screen.queryByText(BUY_KEYCARD_LINK)).toBeNull();
    });

    // An error raised with the card still on the antenna (wrong PIN, bad
    // MAC, uninitialised card) proves the user owns one: recovery only.
    it('hides the link on an error while the card is still present', () => {
      renderSheet(
        makeNfc('error', { cardPresence: 'connected', retry: jest.fn() }),
      );
      expect(screen.getByText('Try again')).toBeTruthy();
      expect(screen.queryByText(BUY_KEYCARD_LINK)).toBeNull();
    });

    it('hides the link on an error after the card was seen and lost', () => {
      renderSheet(makeNfc('error', { cardPresence: 'lost' }));
      expect(screen.queryByText(BUY_KEYCARD_LINK)).toBeNull();
    });

    it('keeps the link on an error before any card was seen', () => {
      renderSheet(makeNfc('error', { cardPresence: 'waiting' }));
      expect(screen.getByText(BUY_KEYCARD_LINK)).toBeTruthy();
    });

    // Settings keeps the user in place on cancel and already carries the
    // purchase link itself, so its sheet leaves this one out.
    it.each(['nfc', 'error'] as const)(
      'leaves the link out in phase %s when the host screen asks',
      phase => {
        render(
          <NFCBottomSheet
            nfc={makeNfc(phase, { cardPresence: 'waiting' })}
            onCancel={onCancel}
            hideNoCardExit
          />,
        );
        expect(screen.queryByText(BUY_KEYCARD_LINK)).toBeNull();
      },
    );

    it('cancels the session, then opens the browser when there is a network', async () => {
      renderSheet(makeNfc('nfc'));
      await pressBuyKeycardLink();
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(Linking.openURL).toHaveBeenCalledWith(PURCHASE_URL);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('cancels the session, then shows the QR screen without a network (always in the offline build)', async () => {
      mockConnected = false;
      renderSheet(makeNfc('error', { retry: jest.fn() }));
      await pressBuyKeycardLink();
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('UrlQR', {
        url: PURCHASE_URL,
        title: BUY_KEYCARD_LABEL,
        note: AFFILIATE_DISCLOSURE,
      });
      expect(Linking.openURL).not.toHaveBeenCalled();
    });
  });

  describe('Cancel button — phase done with showOnDone', () => {
    it('hides the Cancel button (success variant)', () => {
      renderSheet(makeNfc('done'), true);
      expect(screen.queryByText('Cancel')).toBeNull();
    });

    it('has no pressable elements', () => {
      renderSheet(makeNfc('done'), true);
      const pressables = screen.UNSAFE_queryAllByType(
        require('react-native').Pressable,
      );
      expect(pressables).toHaveLength(0);
    });
  });

  describe('genuine_warning phase', () => {
    const onProceed = jest.fn();

    beforeEach(() => {
      onProceed.mockClear();
    });

    it('shows the unverified title', () => {
      renderSheet(
        makeNfc('genuine_warning', { proceedWithNonGenuine: onProceed }),
      );
      expect(screen.getByText('Unverified Keycard')).toBeTruthy();
    });

    it('shows warning body text', () => {
      renderSheet(
        makeNfc('genuine_warning', { proceedWithNonGenuine: onProceed }),
      );
      expect(screen.queryByText(/could not be verified/)).toBeTruthy();
    });

    it('shows Cancel and Proceed Anyway buttons', () => {
      renderSheet(
        makeNfc('genuine_warning', { proceedWithNonGenuine: onProceed }),
      );
      expect(screen.getByText('Cancel')).toBeTruthy();
      expect(screen.getByText('Proceed Anyway')).toBeTruthy();
    });

    it('calls onCancel when Cancel is pressed', () => {
      renderSheet(
        makeNfc('genuine_warning', { proceedWithNonGenuine: onProceed }),
      );
      fireEvent.press(screen.getByTestId('cancel-button'));
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onProceed).not.toHaveBeenCalled();
    });

    it('calls proceedWithNonGenuine when Proceed Anyway is pressed', () => {
      renderSheet(
        makeNfc('genuine_warning', { proceedWithNonGenuine: onProceed }),
      );
      fireEvent.press(screen.getByTestId('proceed-button'));
      expect(onProceed).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('does not show the NFC icon area', () => {
      renderSheet(
        makeNfc('genuine_warning', { proceedWithNonGenuine: onProceed }),
      );
      expect(screen.queryByText('Tap your Keycard')).toBeNull();
    });
  });

  describe('pairing_password phase', () => {
    const submitPairingPassword = jest.fn();

    beforeEach(() => {
      submitPairingPassword.mockClear();
    });

    it('shows the pairing password title', () => {
      renderSheet(makeNfc('pairing_password', { submitPairingPassword }));
      expect(screen.getByText('Custom pairing password')).toBeTruthy();
    });

    it('shows Cancel and Continue buttons', () => {
      renderSheet(makeNfc('pairing_password', { submitPairingPassword }));
      expect(screen.getByText('Cancel')).toBeTruthy();
      expect(screen.getByText('Continue')).toBeTruthy();
    });

    it('calls onCancel when Cancel is pressed', () => {
      renderSheet(makeNfc('pairing_password', { submitPairingPassword }));
      fireEvent.press(screen.getByText('Cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('shows error message when pairingPasswordError is provided', () => {
      renderSheet(
        makeNfc('pairing_password', {
          submitPairingPassword,
          pairingPasswordError: 'Wrong pairing password. Try again.',
        }),
      );
      expect(
        screen.getByText('Wrong pairing password. Try again.'),
      ).toBeTruthy();
    });

    it('calls submitPairingPassword with the entered password', () => {
      renderSheet(makeNfc('pairing_password', { submitPairingPassword }));
      fireEvent.changeText(
        screen.getByPlaceholderText('Pairing password'),
        'mySecret',
      );
      fireEvent.press(screen.getByText('Continue'));
      expect(submitPairingPassword).toHaveBeenCalledWith('mySecret');
    });

    it('does not show the NFC icon area', () => {
      renderSheet(makeNfc('pairing_password', { submitPairingPassword }));
      expect(screen.queryByText('Tap your Keycard')).toBeNull();
    });
  });

  describe('pin_entry phase', () => {
    it('renders PinPad instead of the bottom sheet', () => {
      const submitPin = jest.fn();
      renderSheet(makeNfc('pin_entry', { submitPin }));
      expect(screen.getByTestId('pin-pad')).toBeTruthy();
    });

    it('does not show the NFC sheet content', () => {
      const submitPin = jest.fn();
      renderSheet(makeNfc('pin_entry', { submitPin }));
      expect(screen.queryByText('Tap your Keycard')).toBeNull();
    });

    // The PIN pad used to sit in a full-screen Modal, which covered the
    // navigator's header and so had to paint a fake one. It now fills only the
    // screen's content area, leaving the real header — and its real back
    // button and iOS swipe-back gesture — in place. Re-adding either of these
    // would mean the Modal is back.
    // The pad stays mounted through its slide-out so it does not vanish the
    // instant the phase flips; it is removed when that animation reports done.
    it('unmounts the pad once the exit animation finishes', async () => {
      const submitPin = jest.fn();
      const { rerender } = renderSheet(makeNfc('pin_entry', { submitPin }));
      expect(screen.getByTestId('pin-pad')).toBeTruthy();

      rerender(<NFCBottomSheet nfc={makeNfc('nfc')} onCancel={onCancel} />);
      await waitFor(() => expect(screen.queryByTestId('pin-pad')).toBeNull());
    });

    it('paints no title bar of its own', () => {
      const submitPin = jest.fn();
      renderSheet(makeNfc('pin_entry', { submitPin }));
      expect(screen.queryByText('Enter PIN')).toBeNull();
    });

    it('paints no back button of its own', () => {
      const submitPin = jest.fn();
      renderSheet(makeNfc('pin_entry', { submitPin }));
      expect(screen.queryByLabelText('Go back')).toBeNull();
    });

    // #282: the overlay is absolutely positioned, so Yoga anchors it to the
    // host container's padding box and the host's own bottom-inset padding is
    // covered rather than inherited. The overlay has to pad for the system
    // navigation bar itself or the bottom keypad row (the 0 key) lands under
    // it on edge-to-edge Android.
    it('pads the overlay by the bottom safe-area inset', () => {
      mockInsets.bottom = 48;
      renderSheet(makeNfc('pin_entry', { submitPin: jest.fn() }));
      const style = StyleSheet.flatten(
        screen.getByTestId('pin-overlay').props.style,
      );
      expect(style.paddingBottom).toBe(48);
    });
  });

  describe('pulse rings', () => {
    it('renders more elements when scanning than when done+showOnDone', () => {
      const { toJSON: scanningJSON } = renderSheet(makeNfc('nfc'));
      const { toJSON: successJSON } = renderSheet(makeNfc('done'), true);
      const scanningCount = JSON.stringify(scanningJSON()).length;
      const successCount = JSON.stringify(successJSON()).length;
      expect(scanningCount).toBeGreaterThan(successCount);
    });

    it('error has fewer elements than scanning (no pulse rings)', () => {
      const { toJSON: scanningJSON } = renderSheet(makeNfc('nfc'));
      const { toJSON: errorJSON } = renderSheet(makeNfc('error'));
      const scanningCount = JSON.stringify(scanningJSON()).length;
      const errorCount = JSON.stringify(errorJSON()).length;
      expect(errorCount).toBeLessThan(scanningCount);
    });
  });
});

// ---------------------------------------------------------------------------
// iOS error overlay tests (showIOSError = Platform.OS === 'ios' && phase === 'error')
// ---------------------------------------------------------------------------

describe('NFCBottomSheet — iOS error overlay', () => {
  let origOS: typeof Platform.OS;

  beforeAll(() => {
    origOS = Platform.OS;
    Platform.OS = 'ios';
  });

  afterAll(() => {
    Platform.OS = origOS;
  });

  it('shows NFCError overlay on iOS when phase is error', () => {
    renderSheet(makeNfc('error', { status: 'Invalid APDUResponse' }));
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Invalid APDUResponse')).toBeTruthy();
  });

  it('shows Cancel in the iOS error overlay', () => {
    renderSheet(makeNfc('error', { status: 'err' }));
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('calls onCancel when Cancel is pressed in iOS error overlay', () => {
    renderSheet(makeNfc('error', { status: 'err' }));
    fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows Try again button when retry prop is provided', () => {
    const onRetry = jest.fn();
    renderSheet(makeNfc('error', { status: 'err', retry: onRetry }));
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('hides Try again button when retry prop is absent', () => {
    renderSheet(makeNfc('error', { status: 'err' }));
    expect(screen.queryByText('Try again')).toBeNull();
  });

  it('offers the no-card exit and cancels before opening the shop', async () => {
    mockConnected = false;
    renderSheet(makeNfc('error', { status: 'Session timed out' }));
    await pressBuyKeycardLink();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('UrlQR', {
      url: PURCHASE_URL,
      title: BUY_KEYCARD_LABEL,
      note: AFFILIATE_DISCLOSURE,
    });
  });

  it('does not show iOS error overlay when phase is nfc', () => {
    renderSheet(makeNfc('nfc', { status: 'Tap your Keycard' }));
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('dismisses modal and shows error overlay when transitioning from genuine_warning to error', () => {
    const { rerender } = renderSheet(makeNfc('genuine_warning'));
    rerender(
      <NFCBottomSheet
        nfc={makeNfc('error', { status: 'Connection lost' })}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Connection lost')).toBeTruthy();
  });
});
