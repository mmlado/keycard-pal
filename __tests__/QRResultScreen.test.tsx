import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import QRResultScreen from '../src/screens/QRResultScreen';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return {
    MD3DarkTheme: { colors: {} },
    Text,
  };
});

jest.mock('react-native-animated-ur-qr', () => () => null);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_UR =
  'ur:eth-signature/oyadtpdagdndcawmgtfrkigrpmndutdnbtmkestlrfamjljkjkisdljzjljedrfgwzrd';

function renderScreen(
  urString: string,
  title = 'Show signature to the wallet',
  navigation?: object,
  description?: string,
) {
  return render(
    <QRResultScreen
      route={
        {
          params: { urString, title, description },
          key: 'QRResult',
          name: 'QRResult',
        } as any
      }
      navigation={
        (navigation ?? {
          reset: jest.fn(),
          setOptions: jest.fn(),
        }) as any
      }
    />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('QRResultScreen', () => {
  it('renders without crashing', () => {
    expect(renderScreen(SAMPLE_UR)).toBeDefined();
  });

  it('renders the "Done" button', () => {
    renderScreen(SAMPLE_UR);
    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('calls setOptions with the provided title', () => {
    const setOptions = jest.fn();
    renderScreen(SAMPLE_UR, 'Show key to the wallet', {
      reset: jest.fn(),
      setOptions,
    });
    expect(setOptions).toHaveBeenCalledWith({
      title: 'Show key to the wallet',
    });
  });

  it('renders the description above the QR code when provided', () => {
    renderScreen(
      SAMPLE_UR,
      'Show key to the wallet',
      undefined,
      'An xpub lets the wallet watch your balance.',
    );
    expect(
      screen.getByText('An xpub lets the wallet watch your balance.'),
    ).toBeTruthy();
  });

  it('renders no description when none is provided', () => {
    renderScreen(SAMPLE_UR);
    expect(screen.queryByText(/xpub/)).toBeNull();
  });

  it('"Done" resets navigation to Dashboard', () => {
    const reset = jest.fn();
    renderScreen(SAMPLE_UR, 'Show signature to the wallet', {
      reset,
      setOptions: jest.fn(),
    });

    fireEvent.press(screen.getByText('Done'));

    expect(reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Dashboard' }],
    });
  });
});
