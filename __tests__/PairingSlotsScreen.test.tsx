import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { routeAbsence } from '../src/navigation/generationBoundRoutes';
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
const mockUnpair = jest.fn();
const mockDismissUnpaired = jest.fn();
const mockReadCancel = jest.fn();
const mockUnpairCancel = jest.fn();
const mockUsePairingSlots = jest.fn();

jest.mock('../src/hooks/keycard/usePairingSlots', () => ({
  usePairingSlots: () => mockUsePairingSlots(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const navigation = {
  goBack: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  setOptions: jest.fn(),
} as any;

type SlotInfo = {
  totalSlots: number;
  freeSlots: number;
  ourSlotIndex: number | null;
  cardKey: string;
};

const slotInfo: SlotInfo = {
  totalSlots: 10,
  freeSlots: 7,
  ourSlotIndex: 3,
  cardKey: 'abcd',
};

function readTap(phase: string, overrides = {}) {
  return {
    phase,
    status: phase === 'nfc' ? 'Selecting applet...' : '',
    cardPresence: phase === 'nfc' ? 'lost' : 'waiting',
    userCancels: 0,
    cancel: mockReadCancel,
    retry: mockCheckSlots,
    openNFCSettings: undefined as (() => void) | undefined,
    ...overrides,
  };
}

function unpairTap(phase: string, userCancels = 0) {
  return {
    phase,
    status: '',
    cardPresence: 'waiting',
    userCancels,
    cancel: mockUnpairCancel,
    retry: jest.fn(),
    submitPin: jest.fn(),
    openNFCSettings: undefined,
  };
}

function slots({
  tap = readTap('idle'),
  unpairing = false,
  info = null as SlotInfo | null,
  noPairingSlots = false,
  unpaired = null as string | null,
} = {}) {
  return {
    tap,
    unpairing,
    slotInfo: info,
    noPairingSlots,
    unpaired,
    dismissUnpaired: mockDismissUnpaired,
    checkSlots: mockCheckSlots,
    unpair: mockUnpair,
  };
}

function renderScreen(state = slots()) {
  mockUsePairingSlots.mockReturnValue(state);
  return render(
    <PairingSlotsScreen navigation={navigation} route={undefined as any} />,
  );
}

function rerenderWith(
  view: ReturnType<typeof render>,
  state: ReturnType<typeof slots>,
) {
  mockUsePairingSlots.mockReturnValue(state);
  view.rerender(
    <PairingSlotsScreen navigation={navigation} route={undefined as any} />,
  );
}

const lastSheet = () => MockNFCBottomSheet.mock.calls.at(-1)?.[0];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PairingSlotsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('auto-start on mount', () => {
    it('calls checkSlots automatically when idle and no slotInfo', () => {
      renderScreen();
      expect(mockCheckSlots).toHaveBeenCalled();
    });

    it('does not auto-start when slotInfo is already present', () => {
      renderScreen(slots({ tap: readTap('done'), info: slotInfo }));
      expect(mockCheckSlots).not.toHaveBeenCalled();
    });
  });

  describe('idle state', () => {
    it('renders tap prompt', () => {
      renderScreen();
      expect(screen.getByText(/Tap your Keycard to read/)).toBeTruthy();
    });

    it("hands the hook's tap to the sheet, with no success state for the read", () => {
      renderScreen(slots({ tap: readTap('nfc') }));
      expect(lastSheet()?.nfc.phase).toBe('nfc');
      expect(lastSheet()?.nfc.cardPresence).toBe('lost');
      expect(lastSheet()?.showOnDone).toBe(false);
    });
  });

  describe('error state', () => {
    it('renders error message and Try again button', () => {
      renderScreen(slots({ tap: readTap('error') }));
      expect(screen.getByText(/Could not read pairing slot data/)).toBeTruthy();
      expect(screen.getByText('Try again')).toBeTruthy();
    });

    it('calls checkSlots when Try again is pressed', () => {
      renderScreen(slots({ tap: readTap('error') }));
      fireEvent.press(screen.getByText('Try again'));
      expect(mockCheckSlots).toHaveBeenCalled();
    });
  });

  describe('ready state', () => {
    const ready = () => slots({ tap: readTap('done'), info: slotInfo });

    it('renders slot summary', () => {
      renderScreen(ready());
      expect(screen.getByText('Slots free')).toBeTruthy();
      expect(screen.getByText('7 / 10')).toBeTruthy();
    });

    it('renders all 10 slots with 1-based numbering', () => {
      renderScreen(ready());
      for (let i = 0; i < 10; i++) {
        expect(screen.getByText(`Slot ${i + 1}`)).toBeTruthy();
      }
    });

    it('marks our slot as This device', () => {
      renderScreen(ready());
      expect(screen.getByText('This device')).toBeTruthy();
    });
  });

  describe('unpair via slot press', () => {
    const ready = () => slots({ tap: readTap('done'), info: slotInfo });

    it('asks first, with the slot number', () => {
      renderScreen(ready());
      fireEvent.press(screen.getByText('Slot 1'));
      expect(screen.getByText('Unpair slot 1?')).toBeTruthy();
      expect(mockUnpair).not.toHaveBeenCalled();
    });

    it('unpairs the slot once confirmed', () => {
      renderScreen(ready());
      fireEvent.press(screen.getByText('Slot 3'));
      fireEvent.press(screen.getByText('Unpair'));
      expect(mockUnpair).toHaveBeenCalledWith(2);
      expect(screen.getByText('Slots free')).toBeTruthy();
    });

    it('returns to the slot list when the confirmation is cancelled', () => {
      renderScreen(ready());
      fireEvent.press(screen.getByText('Slot 3'));
      fireEvent.press(screen.getByText('Cancel'));
      expect(mockUnpair).not.toHaveBeenCalled();
      expect(screen.getByText('Slots free')).toBeTruthy();
    });
  });

  // The one tap it already has explains a card without slots.
  describe('a card without pairing slots', () => {
    const absence = routeAbsence('PairingSlots');
    const withoutSlots = () =>
      slots({ tap: readTap('done'), noPairingSlots: true });

    it('explains that the card has none', () => {
      renderScreen(withoutSlots());
      expect(screen.getByText(absence.title)).toBeTruthy();
      expect(screen.getByText(absence.detail)).toBeTruthy();
    });

    it('draws no slots and no free slot count', () => {
      renderScreen(withoutSlots());
      expect(screen.queryByText('Slots free')).toBeNull();
      expect(screen.queryByText('Slot 1')).toBeNull();
    });

    it('does not ask for another tap', () => {
      renderScreen(withoutSlots());
      expect(
        screen.queryByText('Tap your Keycard to read the pairing slot status.'),
      ).toBeNull();
    });

    // slotInfo stays empty on such a card; the focus effect must not reopen the reader.
    it('does not start another read on focus', () => {
      renderScreen(slots({ tap: readTap('idle'), noPairingSlots: true }));
      expect(mockCheckSlots).not.toHaveBeenCalled();
    });

    it('goes back from its one button', () => {
      renderScreen(withoutSlots());
      fireEvent.press(screen.getByText('Go back'));
      expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('unpairing state', () => {
    it('shows the unpair on the sheet, success included, over no slot list', () => {
      renderScreen(
        slots({ tap: unpairTap('nfc'), unpairing: true, info: slotInfo }),
      );
      expect(lastSheet()?.nfc.phase).toBe('nfc');
      expect(lastSheet()?.showOnDone).toBe(true);
      expect(screen.queryByText('Slots free')).toBeNull();
    });
  });

  describe('cancel NFC', () => {
    it('cancels the read and leaves', () => {
      renderScreen(slots({ tap: readTap('nfc') }));
      lastSheet()?.onCancel();
      expect(mockReadCancel).toHaveBeenCalled();
      expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('cancels the running read when the screen is removed', () => {
      renderScreen(slots({ tap: readTap('nfc') }));
      const beforeRemove = navigation.addListener.mock.calls
        .filter((c: unknown[]) => c[0] === 'beforeRemove')
        .at(-1);
      expect(beforeRemove).toBeTruthy();
      (beforeRemove?.[1] as () => void)();
      expect(mockReadCancel).toHaveBeenCalled();
    });

    it('cancels the unpair and stays', () => {
      renderScreen(
        slots({ tap: unpairTap('nfc'), unpairing: true, info: slotInfo }),
      );
      lastSheet()?.onCancel();
      expect(mockUnpairCancel).toHaveBeenCalled();
      expect(mockReadCancel).not.toHaveBeenCalled();
      expect(navigation.goBack).not.toHaveBeenCalled();
    });

    it("leaves when Apple's sheet cancels the read, without reading again", () => {
      const view = renderScreen();
      expect(mockCheckSlots).toHaveBeenCalledTimes(1);

      rerenderWith(view, slots({ tap: readTap('nfc') }));
      rerenderWith(view, slots({ tap: readTap('idle', { userCancels: 1 }) }));

      expect(mockReadCancel).toHaveBeenCalledTimes(1);
      expect(navigation.goBack).toHaveBeenCalledTimes(1);
      expect(mockCheckSlots).toHaveBeenCalledTimes(1);
    });

    it("stays when Apple's sheet cancels an unpair, and does not cancel the next one", () => {
      const view = renderScreen(
        slots({ tap: readTap('done'), info: slotInfo }),
      );
      rerenderWith(
        view,
        slots({ tap: unpairTap('nfc'), unpairing: true, info: slotInfo }),
      );
      rerenderWith(
        view,
        slots({ tap: unpairTap('idle', 1), unpairing: true, info: slotInfo }),
      );

      expect(mockUnpairCancel).toHaveBeenCalledTimes(1);
      expect(navigation.goBack).not.toHaveBeenCalled();

      rerenderWith(view, slots({ tap: readTap('done'), info: slotInfo }));
      rerenderWith(
        view,
        slots({
          tap: unpairTap('pin_entry', 1),
          unpairing: true,
          info: slotInfo,
        }),
      );

      expect(mockUnpairCancel).toHaveBeenCalledTimes(1);
      expect(lastSheet()?.nfc.phase).toBe('pin_entry');
    });

    it('offers Open NFC Settings on a read that NFC being off stopped', () => {
      const openNFCSettings = jest.fn();
      renderScreen(slots({ tap: readTap('error', { openNFCSettings }) }));
      expect(lastSheet()?.nfc.openNFCSettings).toBe(openNFCSettings);
      expect(lastSheet()?.nfc.retry).toBe(mockCheckSlots);
    });
  });

  describe('snackbar notification', () => {
    it("shows the last unpair's wording", () => {
      renderScreen(
        slots({
          tap: readTap('done'),
          info: slotInfo,
          unpaired: 'Slot 2 was unpaired',
        }),
      );
      expect(screen.getByText('Slot 2 was unpaired')).toBeTruthy();
    });

    it('hands its dismissal to the hook', () => {
      renderScreen(
        slots({
          tap: readTap('done'),
          info: slotInfo,
          unpaired: 'Slot 2 was unpaired',
        }),
      );
      fireEvent.press(screen.getByText('Dismiss snackbar'));
      expect(mockDismissUnpaired).toHaveBeenCalledTimes(1);
    });

    it('shows nothing without an unpair', () => {
      renderScreen(slots({ tap: readTap('done'), info: slotInfo }));
      expect(screen.queryByText('Dismiss snackbar')).toBeNull();
    });
  });
});
