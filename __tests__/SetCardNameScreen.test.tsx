import React from 'react';
import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';

import SetCardNameScreen from '../src/screens/SetCardNameScreen';

const mockStart = jest.fn();
const mockCancel = jest.fn();
let mockPhase = 'idle';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('../src/components/BottomActionArea', () => {
  const { View } = require('react-native');
  return ({ children }: any) => (
    <View testID="bottom-action-area">{children}</View>
  );
});

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

  it('keeps Save card name clear of the keyboard in the bottom action area', () => {
    renderScreen();
    expect(
      within(screen.getByTestId('bottom-action-area')).getByText(
        'Save card name',
      ),
    ).toBeTruthy();
  });
});
