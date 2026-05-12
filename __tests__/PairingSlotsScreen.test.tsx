import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import PairingSlotsScreen from '../src/screens/PairingSlotsScreen';
import NFCBottomSheet from '../src/components/NFCBottomSheet';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-paper', () => {
  const RN = require('react-native');
  const Snackbar = ({
    visible,
    children,
    onDismiss,
  }: {
    visible: boolean;
    children: React.ReactNode;
    onDismiss: () => void;
  }) =>
    visible ? (
      <>
        <RN.Text>{children}</RN.Text>
        <RN.Pressable onPress={onDismiss}>
          <RN.Text>Dismiss snackbar</RN.Text>
        </RN.Pressable>
      </>
    ) : null;
  return { MD3DarkTheme: { colors: {} }, Snackbar, Text: RN.Text };
});

jest.mock('react-native-encrypted-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const mockDeletePairing = jest.fn();
jest.mock('../src/storage/pairingStorage', () => ({
  deletePairing: (...args: any[]) => mockDeletePairing(...args),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => cb(),
}));

jest.mock('../src/components/ConfirmPropmpt', () => {
  const { Pressable, Text } = require('react-native');
  return ({
    title,
    yesLabel,
    noLabel,
    onYes,
    onNo,
  }: {
    title: string;
    yesLabel: string;
    noLabel: string;
    onYes: () => void;
    onNo: () => void;
  }) => (
    <>
      <Text>{title}</Text>
      <Pressable onPress={onYes}>
        <Text>{yesLabel}</Text>
      </Pressable>
      <Pressable onPress={onNo}>
        <Text>{noLabel}</Text>
      </Pressable>
    </>
  );
});

jest.mock('../src/components/NFCBottomSheet', () => jest.fn(() => null));
const MockNFCBottomSheet = NFCBottomSheet as jest.MockedFunction<
  typeof NFCBottomSheet
>;

jest.mock('../src/components/PrimaryButton', () => {
  const { Pressable, Text } = require('react-native');
  return ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable onPress={onPress}>
      <Text>{label}</Text>
    </Pressable>
  );
});

const mockCheckSlots = jest.fn();
const mockCancel = jest.fn();
const mockUsePairingSlots = jest.fn();

jest.mock('../src/hooks/keycard/usePairingSlots', () => ({
  usePairingSlots: () => mockUsePairingSlots(),
}));

const mockExecute = jest.fn(async (op: any) => {
  const mockCmdSet = { unpair: jest.fn(() => Promise.resolve()) };
  await op(mockCmdSet);
  return mockCmdSet;
});
const mockUnpairCancel = jest.fn();
const mockUseKeycardOperation = jest.fn();

jest.mock('../src/hooks/keycard/useKeycardOperation', () => ({
  useKeycardOperation: () => mockUseKeycardOperation(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();

const navigation = {
  goBack: jest.fn(),
  setOptions: jest.fn(),
  navigate: mockNavigate,
} as any;

function makeCheckHook(
  phase: string,
  slotInfo: {
    totalSlots: number;
    freeSlots: number;
    ourSlotIndex: number | null;
    cardUid: string;
  } | null = null,
) {
  return {
    phase,
    status: phase === 'checking' ? 'Selecting applet...' : '',
    slotInfo,
    checkSlots: mockCheckSlots,
    cancel: mockCancel,
    reset: jest.fn(),
    resetNFCOnly: jest.fn(),
    readSlotInfoFromCmdSet: jest.fn().mockResolvedValue(undefined),
  };
}

function makeUnpairHook(phase: string) {
  return {
    phase,
    status: '',
    result: null,
    cardName: null,
    pinError: null,
    execute: mockExecute,
    submitPin: jest.fn(),
    clearPinError: jest.fn(),
    cancel: mockUnpairCancel,
    reset: jest.fn(),
    proceedWithNonGenuine: jest.fn(),
  };
}

function renderScreen(
  checkPhase = 'idle',
  slotInfo: ReturnType<typeof makeCheckHook>['slotInfo'] = null,
  unpairPhase = 'idle',
) {
  mockUsePairingSlots.mockReturnValue(makeCheckHook(checkPhase, slotInfo));
  mockUseKeycardOperation.mockReturnValue(makeUnpairHook(unpairPhase));
  return render(
    <PairingSlotsScreen navigation={navigation} route={undefined as any} />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PairingSlotsScreen', () => {
  beforeEach(() => {
    mockCheckSlots.mockClear();
    mockCancel.mockClear();
    mockExecute.mockClear();
    mockUnpairCancel.mockClear();
    mockDeletePairing.mockClear();
    mockNavigate.mockClear();
    mockUsePairingSlots.mockClear();
    mockUseKeycardOperation.mockClear();
    MockNFCBottomSheet.mockClear();
  });

  describe('auto-start on focus', () => {
    it('calls checkSlots automatically when idle and no slotInfo', () => {
      renderScreen();
      expect(mockCheckSlots).toHaveBeenCalled();
    });

    it('does not auto-start when slotInfo is already present', () => {
      const slotInfo = {
        totalSlots: 10,
        freeSlots: 7,
        ourSlotIndex: 3,
        cardUid: 'abcd',
      };
      renderScreen('ready', slotInfo);
      expect(mockCheckSlots).not.toHaveBeenCalled();
    });
  });

  describe('idle state', () => {
    it('renders tap prompt', () => {
      renderScreen();
      expect(screen.getByText(/Tap your Keycard to read/)).toBeTruthy();
    });

    it('passes check hook to NFCBottomSheet', () => {
      renderScreen('checking');
      const lastCall = MockNFCBottomSheet.mock.calls.at(-1);
      expect(lastCall?.[0].nfc.phase).toBe('nfc');
      expect(lastCall?.[0].showOnDone).toBe(false);
    });
  });

  describe('error state', () => {
    it('renders error message and Try again button', () => {
      renderScreen('error');
      expect(screen.getByText(/Could not read pairing slot data/)).toBeTruthy();
      expect(screen.getByText('Try again')).toBeTruthy();
    });

    it('calls checkSlots when Try again is pressed', () => {
      renderScreen('error');
      fireEvent.press(screen.getByText('Try again'));
      expect(mockCheckSlots).toHaveBeenCalled();
    });
  });

  describe('ready state', () => {
    const slotInfo = {
      totalSlots: 10,
      freeSlots: 7,
      ourSlotIndex: 3,
      cardUid: 'abcd',
    };

    it('renders slot summary', () => {
      renderScreen('ready', slotInfo);
      expect(screen.getByText('Slots free')).toBeTruthy();
      expect(screen.getByText('7 / 10')).toBeTruthy();
    });

    it('renders all 10 slots with 1-based numbering', () => {
      renderScreen('ready', slotInfo);
      for (let i = 0; i < 10; i++) {
        expect(screen.getByText(`Slot ${i + 1}`)).toBeTruthy();
      }
    });

    it('marks our slot as This device', () => {
      renderScreen('ready', slotInfo);
      expect(screen.getByText('This device')).toBeTruthy();
    });
  });

  describe('unpair via slot press', () => {
    const slotInfo = {
      totalSlots: 10,
      freeSlots: 7,
      ourSlotIndex: 3,
      cardUid: 'abcd',
    };

    it('shows ConfirmPrompt with correct slot number when a row is pressed', () => {
      renderScreen('ready', slotInfo);
      fireEvent.press(screen.getByText('Slot 1'));
      expect(screen.getByText('Unpair slot 1?')).toBeTruthy();
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('executes unpair after user confirms', async () => {
      renderScreen('ready', slotInfo);
      fireEvent.press(screen.getByText('Slot 3'));
      await act(async () => {
        fireEvent.press(screen.getByText('Unpair'));
      });
      expect(mockExecute).toHaveBeenCalled();
    });

    it('returns to slot list when user cancels confirmation', () => {
      renderScreen('ready', slotInfo);
      fireEvent.press(screen.getByText('Slot 3'));
      fireEvent.press(screen.getByText('Cancel'));
      expect(mockExecute).not.toHaveBeenCalled();
      expect(screen.getByText('Slots free')).toBeTruthy();
    });

    it('deletes local pairing when unpairing our own slot', async () => {
      renderScreen('ready', slotInfo);
      // ourSlotIndex is 3, so Slot 4 (1-based) is our slot
      fireEvent.press(screen.getByText('Slot 4'));
      await act(async () => {
        fireEvent.press(screen.getByText('Unpair'));
      });
      expect(mockExecute).toHaveBeenCalled();
      await waitFor(() => {
        expect(mockDeletePairing).toHaveBeenCalledWith('abcd');
      });
    });

    it('keeps unpair success path when local pairing cleanup fails', async () => {
      mockDeletePairing.mockRejectedValueOnce(new Error('storage failed'));
      renderScreen('ready', slotInfo);

      fireEvent.press(screen.getByText('Slot 4'));
      await act(async () => {
        fireEvent.press(screen.getByText('Unpair'));
      });

      await waitFor(() => {
        expect(screen.getByText('Slot 4 was unpaired')).toBeTruthy();
      });
    });

    it('does not delete local pairing when unpairing another slot', async () => {
      renderScreen('ready', slotInfo);
      fireEvent.press(screen.getByText('Slot 1'));
      await act(async () => {
        fireEvent.press(screen.getByText('Unpair'));
      });
      expect(mockExecute).toHaveBeenCalled();
      expect(mockDeletePairing).not.toHaveBeenCalled();
    });
  });

  describe('unpairing state', () => {
    it('passes unpair hook to NFCBottomSheet with showOnDone', () => {
      renderScreen('ready', null, 'nfc');
      const lastCall = MockNFCBottomSheet.mock.calls.at(-1);
      expect(lastCall?.[0].nfc.phase).toBe('nfc');
      expect(lastCall?.[0].showOnDone).toBe(true);
    });
  });

  describe('cancel NFC', () => {
    it('calls cancelCheck when cancelling during slot check', () => {
      renderScreen('checking');
      const lastCall = MockNFCBottomSheet.mock.calls.at(-1);
      lastCall?.[0].onCancel();
      expect(mockCancel).toHaveBeenCalled();
      expect(mockUnpairCancel).not.toHaveBeenCalled();
    });

    it('calls cancelUnpair when cancelling during unpair', () => {
      renderScreen('ready', null, 'nfc');
      const lastCall = MockNFCBottomSheet.mock.calls.at(-1);
      lastCall?.[0].onCancel();
      expect(mockUnpairCancel).toHaveBeenCalled();
      expect(mockCancel).not.toHaveBeenCalled();
    });
  });

  describe('unpair done', () => {
    const slotInfo = {
      totalSlots: 10,
      freeSlots: 7,
      ourSlotIndex: 3,
      cardUid: 'abcd',
    };

    it('resets unpair hook and resets NFC state when unpair finishes', () => {
      const mockResetNFCOnly = jest.fn();
      const mockResetUnpair = jest.fn();
      mockUsePairingSlots.mockReturnValue({
        ...makeCheckHook('ready', slotInfo),
        resetNFCOnly: mockResetNFCOnly,
      });
      mockUseKeycardOperation.mockReturnValue({
        ...makeUnpairHook('idle'),
        reset: mockResetUnpair,
      });
      const { rerender } = render(
        <PairingSlotsScreen navigation={navigation} route={undefined as any} />,
      );

      mockUsePairingSlots.mockReturnValue({
        ...makeCheckHook('ready', slotInfo),
        resetNFCOnly: mockResetNFCOnly,
      });
      mockUseKeycardOperation.mockReturnValue({
        ...makeUnpairHook('done'),
        reset: mockResetUnpair,
      });
      rerender(
        <PairingSlotsScreen navigation={navigation} route={undefined as any} />,
      );

      expect(mockResetUnpair).toHaveBeenCalled();
      expect(mockResetNFCOnly).toHaveBeenCalled();
    });
  });

  describe('snackbar notification', () => {
    const slotInfo = {
      totalSlots: 10,
      freeSlots: 7,
      ourSlotIndex: 3,
      cardUid: 'abcd',
    };

    it('shows snackbar with slot number after unpair operation runs', async () => {
      renderScreen('ready', slotInfo);
      fireEvent.press(screen.getByText('Slot 2'));
      await act(async () => {
        fireEvent.press(screen.getByText('Unpair'));
      });
      expect(screen.getByText('Slot 2 was unpaired')).toBeTruthy();
    });

    it('hides snackbar when dismissed', async () => {
      renderScreen('ready', slotInfo);
      fireEvent.press(screen.getByText('Slot 2'));
      await act(async () => {
        fireEvent.press(screen.getByText('Unpair'));
      });

      fireEvent.press(screen.getByText('Dismiss snackbar'));

      expect(screen.queryByText('Slot 2 was unpaired')).toBeNull();
    });
  });
});
