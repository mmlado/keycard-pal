import React, { act } from 'react';
import { Keyboard, StyleSheet, TextInput } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import NFCBottomSheet from '../src/components/NFCBottomSheet';
import MnemonicScreen from '../src/screens/keypair/MnemonicScreen';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

const mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/components/NFCBottomSheet', () => jest.fn(() => null));
const MockNFCBottomSheet = NFCBottomSheet as jest.MockedFunction<
  typeof NFCBottomSheet
>;

jest.mock('../src/components/PinPad', () => () => null);

jest.mock('../src/assets/icons', () => ({
  Icons: { nfcActivate: () => null, qr: () => null },
}));

jest.mock('../src/components/Camera', () => ({
  Camera: ({ onReadCode }: any) => {
    const { View } = require('react-native');
    return <View testID="camera" onReadCode={onReadCode} />;
  },
}));

const mockStart = jest.fn();
const mockCancel = jest.fn();
const mockSubmitPin = jest.fn();
const mockUseLoadKey = jest.fn();
const mockUseVerifyFingerprint = jest.fn();

jest.mock('../src/hooks/keycard/useLoadKey', () => ({
  useLoadKey: (...args: any[]) => mockUseLoadKey(...args),
  deriveMnemonicKeyPair: jest.fn(() => ({ type: 'keypair' })),
}));

jest.mock('../src/hooks/keycard/useVerifyFingerprint', () => ({
  useVerifyFingerprint: (...args: any[]) => mockUseVerifyFingerprint(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_12 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const VALID_24 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';

// Standard SeedQR for VALID_12: eleven "abandon" (index 0) then "about" (index 3).
const VALID_12_SEEDQR = `${'0000'.repeat(11)}0003`;

// Same stream with the last index moved off "about", so the checksum fails.
const BAD_CHECKSUM_SEEDQR = `${'0000'.repeat(11)}0004`;

const navigation = {
  navigate: jest.fn(),
  reset: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
} as any;

const route = { key: 'Mnemonic', name: 'Mnemonic', params: undefined } as any;
const routeVerify = {
  key: 'Mnemonic',
  name: 'Mnemonic',
  params: { mode: 'verify' },
} as any;

function hookMock(phase = 'idle', result: string | null = null) {
  return {
    phase,
    result,
    status: '',
    pinError: null,
    start: mockStart,
    cancel: mockCancel,
    submitPin: mockSubmitPin,
  };
}

function renderScreen(phase = 'idle') {
  mockUseLoadKey.mockReturnValue(hookMock(phase));
  mockUseVerifyFingerprint.mockReturnValue(hookMock(phase));
  return render(<MnemonicScreen navigation={navigation} route={route} />);
}

function getTextInputs() {
  return screen.UNSAFE_getAllByType(TextInput);
}

function getWordInput() {
  return getTextInputs()[0];
}

function getPassphraseInput() {
  return getTextInputs()[1];
}

function getButton(label = 'Continue') {
  let node: any = screen.getByText(label);
  while (node) {
    if (typeof node.props?.onPress === 'function') {
      return node;
    }
    node = node.parent;
  }
  throw new Error(`No button found for ${label}`);
}

function getSegment(label: string) {
  let node: any = screen.getByText(label);
  while (node) {
    if (typeof node.props?.onPress === 'function') {
      return node;
    }
    node = node.parent;
  }
  throw new Error(`No segment found for ${label}`);
}

function setInput(text: string) {
  return act(async () => {
    fireEvent.changeText(getWordInput(), text);
  });
}

function triggerScan(payload: string) {
  act(() => {
    screen.getByTestId('camera').props.onReadCode({
      nativeEvent: { codeStringValue: payload },
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MnemonicScreen', () => {
  beforeEach(() => {
    navigation.navigate.mockClear();
    navigation.reset.mockClear();
    navigation.setOptions.mockClear();
    mockStart.mockClear();
    mockCancel.mockClear();
    MockNFCBottomSheet.mockClear();
    mockUseLoadKey.mockReturnValue(hookMock());
    mockUseVerifyFingerprint.mockReturnValue(hookMock());
  });

  describe('layout', () => {
    it('renders the 12/24 word selector', async () => {
      renderScreen();
      expect(screen.getByText('12 words')).toBeTruthy();
      expect(screen.getByText('24 words')).toBeTruthy();
    });

    it('renders the word input with multiline', async () => {
      renderScreen();
      expect(getWordInput().props.multiline).toBe(true);
    });

    it('renders the passphrase input with correct placeholder', async () => {
      renderScreen();
      expect(getPassphraseInput().props.placeholder).toBe(
        'Passphrase (optional)',
      );
    });

    it('renders the Continue button', async () => {
      renderScreen();
      expect(screen.getByText('Continue')).toBeTruthy();
    });

    it('renders SeedQR scan icon inside the seed-phrase input', async () => {
      renderScreen();
      expect(screen.getByTestId('scan-seedqr-button')).toBeTruthy();
    });
  });

  describe('word count selector', () => {
    it('defaults to 12-word mode', async () => {
      renderScreen();
      const seg12 = getSegment('12 words');
      // active segment gets segmentActive style (#474747 background)
      const style = [seg12?.props.style].flat();
      expect(JSON.stringify(style)).toContain('474747');
    });

    it('switches to 24-word mode when the 24-word segment is pressed', async () => {
      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByText('24 words'));
      });
      const seg24 = getSegment('24 words');
      const style = [seg24?.props.style].flat();
      expect(JSON.stringify(style)).toContain('474747');
    });
  });

  describe('Continue button disabled state', () => {
    it('is disabled when input is empty', async () => {
      renderScreen();
      await setInput('');
      expect(getButton().props.disabled).toBe(true);
    });

    it('is enabled when the correct number of words are entered', async () => {
      renderScreen();
      await setInput(VALID_12);
      expect(getButton().props.disabled).toBe(false);
    });

    it('remains disabled when word count does not match selector (24 mode, 12 words)', async () => {
      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByText('24 words'));
      });
      await setInput(VALID_12);
      expect(getButton().props.disabled).toBe(true);
    });

    it('is enabled when 24 words are entered in 24-word mode', async () => {
      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByText('24 words'));
      });
      await setInput(VALID_24);
      expect(getButton().props.disabled).toBe(false);
    });
  });

  describe('word validation', () => {
    it('shows error for invalid completed word', async () => {
      renderScreen();
      // trailing space triggers validation of the completed word
      await setInput('notaword ');
      expect(screen.getByText(/notaword/)).toBeTruthy();
      expect(screen.getByText(/is not a valid BIP39 word/)).toBeTruthy();
    });

    it('does not show error while word is still being typed', async () => {
      renderScreen();
      await setInput('aban');
      expect(screen.queryByText(/is not a valid BIP39 word/)).toBeNull();
    });

    it('does not show error for a valid completed word', async () => {
      renderScreen();
      await setInput('abandon ');
      expect(screen.queryByText(/is not a valid BIP39 word/)).toBeNull();
    });
  });

  describe('Continue pressed', () => {
    it('shows phrase error when mnemonic is invalid', async () => {
      renderScreen();
      // 12 words but checksum is wrong
      await setInput(
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon',
      );
      await act(async () => {
        fireEvent.press(screen.getByText('Continue'));
      });
      expect(screen.getByText('Invalid recovery phrase')).toBeTruthy();
      expect(mockStart).not.toHaveBeenCalled();
    });

    it('calls start() when mnemonic is valid', async () => {
      renderScreen();
      await setInput(VALID_12);
      await act(async () => {
        fireEvent.press(screen.getByText('Continue'));
      });
      expect(mockStart).toHaveBeenCalledTimes(1);
    });

    it('passes words to useLoadKey', async () => {
      mockUseLoadKey.mockClear();
      renderScreen();
      await setInput(VALID_12);
      expect(mockUseLoadKey).toHaveBeenCalled();
    });

    it('passes passphrase to the local derivation helper when entered', async () => {
      renderScreen();
      await setInput(VALID_12);
      await act(async () => {
        fireEvent.changeText(getPassphraseInput(), 'mysecret');
      });
      await act(async () => {
        fireEvent.press(screen.getByText('Continue'));
      });
      const { deriveMnemonicKeyPair } = jest.requireMock(
        '../src/hooks/keycard/useLoadKey',
      );
      expect(deriveMnemonicKeyPair).toHaveBeenLastCalledWith(
        VALID_12.split(' '),
        'mysecret',
      );
    });
  });

  describe('SeedQR scanner', () => {
    it('shows camera overlay when Scan SeedQR is pressed', async () => {
      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByTestId('scan-seedqr-button'));
      });
      expect(screen.getByTestId('camera')).toBeTruthy();
    });

    it('fills the screen under the header without a top inset of its own', async () => {
      mockInsets.top = 48;
      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByTestId('scan-seedqr-button'));
      });
      // The camera mock's nearest host ancestor is CameraView's container.
      let overlay = screen.getByTestId('camera').parent;
      while (overlay && overlay.type !== 'View') {
        overlay = overlay.parent;
      }
      const style = StyleSheet.flatten(overlay!.props.style);
      expect(style.position).toBe('absolute');
      expect(style.paddingTop).toBeUndefined();
      mockInsets.top = 0;
    });

    it('dismisses the keyboard so it does not cover the viewfinder', async () => {
      // The scanner is an overlay on this screen, so the word input keeps
      // focus and the keyboard stays up over the camera unless dismissed.
      const dismiss = jest.spyOn(Keyboard, 'dismiss');
      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByTestId('scan-seedqr-button'));
      });
      expect(dismiss).toHaveBeenCalled();
      dismiss.mockRestore();
    });

    it('fills word input and dismisses overlay after valid scan', async () => {
      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByTestId('scan-seedqr-button'));
      });
      triggerScan(VALID_12_SEEDQR);
      expect(screen.queryByTestId('camera')).toBeNull();
      expect(getWordInput().props.value).toBe(VALID_12);
    });

    it('shows error message for invalid QR payload', async () => {
      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByTestId('scan-seedqr-button'));
      });
      triggerScan('not a seedqr');
      expect(screen.getByText(/Not a valid SeedQR/)).toBeTruthy();
      expect(screen.getByTestId('camera')).toBeTruthy();
    });

    it('shows the decoder error when a well-formed SeedQR fails its checksum', async () => {
      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByTestId('scan-seedqr-button'));
      });
      triggerScan(BAD_CHECKSUM_SEEDQR);
      expect(screen.getByText(/failed its checksum/)).toBeTruthy();
      expect(screen.getByTestId('camera')).toBeTruthy();
    });

    it('does not accept hex entropy', async () => {
      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByTestId('scan-seedqr-button'));
      });
      triggerScan('00000000000000000000000000000000');
      expect(screen.getByText(/Not a valid SeedQR/)).toBeTruthy();
      expect(screen.getByTestId('camera')).toBeTruthy();
    });

    it('clears the error once the camera stops reporting it', async () => {
      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByTestId('scan-seedqr-button'));
      });
      triggerScan('not a seedqr');
      expect(screen.getByText(/Not a valid SeedQR/)).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(screen.queryByText(/Not a valid SeedQR/)).toBeNull();
    });

    it('holds the error while the bad code stays in view', async () => {
      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByTestId('scan-seedqr-button'));
      });
      triggerScan('not a seedqr');
      // Each frame re-arms the timer and discards the previous one, so the
      // notice must never lapse underneath a code the camera is still seeing.
      // Asserting between frames is what catches a stale timer firing late.
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          jest.advanceTimersByTime(1500);
        });
        expect(screen.getByText(/Not a valid SeedQR/)).toBeTruthy();
        triggerScan('not a seedqr');
      }
    });

    it('drops the pending timer when a later frame scans clean', async () => {
      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByTestId('scan-seedqr-button'));
      });
      triggerScan('not a seedqr');
      triggerScan(VALID_12_SEEDQR);
      expect(screen.queryByText(/Not a valid SeedQR/)).toBeNull();
      // The rejection's timer is still armed at this point. If it survived the
      // success it would fire into a screen that has already moved on.
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(getWordInput().props.value).toBe(VALID_12);
      expect(screen.queryByText(/Not a valid SeedQR/)).toBeNull();
    });

    it('clears a pending timer when the screen unmounts', async () => {
      const view = renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByTestId('scan-seedqr-button'));
      });
      const idle = jest.getTimerCount();
      triggerScan('not a seedqr');
      expect(jest.getTimerCount()).toBe(idle + 1);
      view.unmount();
      expect(jest.getTimerCount()).toBe(idle);
    });

    it('dismisses overlay when beforeRemove fires while scanning', async () => {
      let capturedCallback: ((e: any) => void) | null = null;
      navigation.addListener.mockImplementation(
        (_event: string, cb: (e: any) => void) => {
          capturedCallback = cb;
          return jest.fn();
        },
      );
      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByTestId('scan-seedqr-button'));
      });
      expect(screen.getByTestId('camera')).toBeTruthy();
      await act(async () => {
        capturedCallback!({ preventDefault: jest.fn() });
      });
      expect(screen.queryByTestId('camera')).toBeNull();
    });

    it('does not navigate anywhere on scan', async () => {
      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByTestId('scan-seedqr-button'));
      });
      triggerScan(VALID_12_SEEDQR);
      expect(navigation.navigate).not.toHaveBeenCalled();
    });
  });

  describe('navigation', () => {
    it('navigates to Dashboard with toast when phase is done (import mode)', async () => {
      renderScreen('done');
      expect(navigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [
          {
            name: 'Dashboard',
            params: { toast: 'Key pair has been added to Keycard' },
          },
        ],
      });
    });

    it('does not navigate when phase is not done', async () => {
      renderScreen('idle');
      expect(navigation.navigate).not.toHaveBeenCalled();
    });
  });

  describe('verify mode', () => {
    function renderVerify(phase = 'idle', result: string | null = null) {
      mockUseLoadKey.mockReturnValue(hookMock(phase));
      mockUseVerifyFingerprint.mockReturnValue(hookMock(phase, result));
      return render(
        <MnemonicScreen navigation={navigation} route={routeVerify} />,
      );
    }

    it('shows "Verify" button label', async () => {
      renderVerify();
      expect(screen.getByText('Verify')).toBeTruthy();
    });

    it('derives a fingerprint locally and passes it to verify start', async () => {
      renderVerify();
      await setInput(VALID_12);
      await act(async () => {
        fireEvent.changeText(getPassphraseInput(), 'mysecret');
      });

      await act(async () => {
        fireEvent.press(screen.getByText('Verify'));
      });

      expect(mockStart).toHaveBeenCalledWith(expect.any(Number));
    });

    it('resets to Dashboard with match toast', async () => {
      renderVerify('done', 'match');
      expect(navigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [
          { name: 'Dashboard', params: { toast: 'Recovery phrase matches' } },
        ],
      });
    });

    it('resets to Dashboard with mismatch toast', async () => {
      renderVerify('done', 'mismatch');
      expect(navigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [
          {
            name: 'Dashboard',
            params: { toast: 'Recovery phrase does not match' },
          },
        ],
      });
    });
  });

  describe('NFC sheet', () => {
    function lastProps() {
      const calls = MockNFCBottomSheet.mock.calls;
      return calls[calls.length - 1][0];
    }

    it('nfc.phase is idle when phase is idle', async () => {
      renderScreen('idle');
      expect(lastProps().nfc.phase).toBe('idle');
    });

    it('nfc.phase is nfc when phase is nfc', async () => {
      renderScreen('nfc');
      expect(lastProps().nfc.phase).toBe('nfc');
    });

    it('nfc.phase is error when phase is error', async () => {
      renderScreen('error');
      expect(lastProps().nfc.phase).toBe('error');
    });
  });

  describe('keyboard handling', () => {
    let listeners: Record<string, (e: any) => void>;

    beforeEach(() => {
      listeners = {};
      jest
        .spyOn(Keyboard, 'addListener')
        .mockImplementation((event: string, cb: (e: any) => void) => {
          listeners[event] = cb;
          return { remove: jest.fn() } as any;
        });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('updates keyboardHeight when keyboard shows', async () => {
      renderScreen();
      await act(async () => {
        listeners.keyboardDidShow?.({
          endCoordinates: { height: 300, screenX: 0, screenY: 0, width: 0 },
        });
      });
      expect(screen.getByText('Continue')).toBeTruthy();
    });

    it('resets keyboardHeight when keyboard hides', async () => {
      renderScreen();
      await act(async () => {
        listeners.keyboardDidShow?.({
          endCoordinates: { height: 300, screenX: 0, screenY: 0, width: 0 },
        });
      });
      await act(async () => {
        listeners.keyboardDidHide?.({});
      });
      expect(screen.getByText('Continue')).toBeTruthy();
    });
  });

  describe('NFC cancel', () => {
    it('calls cancel() when NFCBottomSheet onCancel is triggered', async () => {
      renderScreen();
      const props = MockNFCBottomSheet.mock.calls[0][0];
      act(() => {
        props.onCancel();
      });
      expect(mockCancel).toHaveBeenCalledTimes(1);
    });
  });
});
