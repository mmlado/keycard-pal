import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard, Platform } from 'react-native';

import SetCardNameScreen from '../src/screens/SetCardNameScreen';

const mockStart = jest.fn();
const mockCancel = jest.fn();
let mockPhase = 'idle';
let keyboardDidShow: ((event: any) => void) | null = null;
let keyboardDidHide: (() => void) | null = null;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

let mockBottomInset = 0;

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    top: 0,
    bottom: mockBottomInset,
    left: 0,
    right: 0,
  }),
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/assets/icons', () => {
  const { View } = require('react-native');
  const Icon = (props: any) => <View {...props} />;
  return {
    Icons: {
      nfcActivate: Icon,
    },
  };
});

jest.spyOn(Keyboard, 'addListener').mockImplementation((event, callback) => {
  if (event === 'keyboardDidShow' || event === 'keyboardWillShow') {
    keyboardDidShow = callback as (event: any) => void;
  }
  if (event === 'keyboardDidHide' || event === 'keyboardWillHide') {
    keyboardDidHide = callback as () => void;
  }
  return { remove: jest.fn() } as any;
});

jest.mock('../src/components/NFCBottomSheet', () => {
  const { Pressable, Text } = require('react-native');
  return function MockNFCBottomSheet({ nfc, onCancel }: any) {
    return (
      <>
        <Text>NFC phase: {nfc.phase}</Text>
        <Pressable onPress={onCancel}>
          <Text>Cancel NFC</Text>
        </Pressable>
      </>
    );
  };
});

jest.mock('../src/hooks/keycard/useSetCardName', () => ({
  useSetCardName: () => ({
    phase: mockPhase,
    status: '',
    start: mockStart,
    cancel: mockCancel,
  }),
}));

const navigation = {
  addListener: jest.fn(() => jest.fn()),
  goBack: jest.fn(),
  reset: jest.fn(),
  setOptions: jest.fn(),
} as any;
const route = { key: 'SetCardName', name: 'SetCardName' } as any;

function renderScreen() {
  return render(<SetCardNameScreen navigation={navigation} route={route} />);
}

describe('SetCardNameScreen', () => {
  beforeEach(() => {
    mockPhase = 'idle';
    mockStart.mockReset();
    mockCancel.mockReset();
    navigation.goBack.mockClear();
    navigation.reset.mockClear();
    navigation.setOptions.mockClear();
    keyboardDidShow = null;
    keyboardDidHide = null;
    mockBottomInset = 0;
  });

  it('submits the entered card name', () => {
    renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText('Unnamed card'), 'Vault');
    fireEvent.press(screen.getByText('Save card name'));
    expect(mockStart).toHaveBeenCalledWith('Vault');
  });

  it('shows validation errors from the start handler', () => {
    mockStart.mockImplementationOnce(() => {
      throw new Error('Card name must be 20 bytes or fewer.');
    });
    renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText('Unnamed card'), 'Vault');
    fireEvent.press(screen.getByText('Save card name'));
    expect(
      screen.getByText('Card name must be 20 bytes or fewer.'),
    ).toBeTruthy();
  });

  it('cancels the NFC flow and goes back', () => {
    mockPhase = 'nfc';
    renderScreen();
    fireEvent.press(screen.getByText('Cancel NFC'));
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('allows an empty name to clear the card name', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Save card name'));
    expect(mockStart).toHaveBeenCalledWith('');
  });

  it('focuses the name field on open', () => {
    renderScreen();
    expect(screen.getByPlaceholderText('Unnamed card').props.autoFocus).toBe(
      true,
    );
  });

  it('navigates to dashboard when the NFC operation completes', () => {
    mockPhase = 'done';
    renderScreen();
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Dashboard', params: { toast: 'Card name updated' } }],
    });
  });

  it('moves the bottom action above the keyboard', () => {
    const { toJSON } = renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText('Unnamed card'), 'Vault');

    act(() => {
      keyboardDidShow?.({ endCoordinates: { height: 280 } });
    });

    expect(JSON.stringify(toJSON())).toContain('"paddingBottom":288');

    act(() => {
      keyboardDidHide?.();
    });

    expect(JSON.stringify(toJSON())).toContain('"paddingBottom":16');
  });

  it('clears the keyboard by the same margin in both Android navigation modes', () => {
    const origOS = Platform.OS;
    Platform.OS = 'android';

    try {
      // Android reports the IME height with the navigation bar inset taken
      // off, so the same keyboard frame is reported shorter under the taller
      // three-button bar.
      const modes = [
        { inset: 63, reported: 280 },
        { inset: 126, reported: 217 },
      ];

      for (const { inset, reported } of modes) {
        mockBottomInset = inset;
        const { toJSON, unmount } = renderScreen();

        act(() => {
          keyboardDidShow?.({ endCoordinates: { height: reported } });
        });

        expect(JSON.stringify(toJSON())).toContain('"paddingBottom":351');
        unmount();
      }
    } finally {
      Platform.OS = origOS;
    }
  });

  it('does not add the bottom inset on iOS, where the keyboard height includes it', () => {
    mockBottomInset = 34;
    const { toJSON } = renderScreen();

    act(() => {
      keyboardDidShow?.({ endCoordinates: { height: 280 } });
    });

    expect(JSON.stringify(toJSON())).toContain('"paddingBottom":288');
  });
});
