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

const mockAnimatedURQRCode = jest.fn((_: object) => null);
jest.mock(
  'react-native-animated-ur-qr',
  () => (props: object) => mockAnimatedURQRCode(props),
);

const mockSeedQrCode = jest.fn((_: object) => null);
jest.mock(
  '../src/components/SeedQrCode',
  () => (props: object) => mockSeedQrCode(props),
);

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

describe('QRResultScreen with a phrase', () => {
  const words = Array(11).fill('abandon').concat('about');

  function renderPhrase(
    navigation = { reset: jest.fn(), setOptions: jest.fn() },
  ) {
    return render(
      <QRResultScreen
        route={
          {
            params: {
              title: 'SeedQR',
              description: 'Anyone who scans it can use it.',
              seedWords: words,
            },
            key: 'QRResult',
            name: 'QRResult',
          } as any
        }
        navigation={navigation as any}
      />,
    );
  }

  beforeEach(() => {
    mockAnimatedURQRCode.mockClear();
    mockSeedQrCode.mockClear();
  });

  it('draws the phrase as a SeedQR, not as a UR', () => {
    renderPhrase();
    expect(mockSeedQrCode).toHaveBeenCalledWith(
      expect.objectContaining({ words }),
    );
    expect(mockAnimatedURQRCode).not.toHaveBeenCalled();
  });

  it('gives the SeedQR the size a UR code gets', () => {
    renderPhrase();
    const urSize = (mockSeedQrCode.mock.calls[0][0] as { size: number }).size;
    renderScreen(SAMPLE_UR);
    expect(mockAnimatedURQRCode).toHaveBeenCalledWith(
      expect.objectContaining({ size: urSize }),
    );
  });

  it('shows its title and description', () => {
    const setOptions = jest.fn();
    renderPhrase({ reset: jest.fn(), setOptions });
    expect(setOptions).toHaveBeenCalledWith({ title: 'SeedQR' });
    expect(screen.getByText('Anyone who scans it can use it.')).toBeTruthy();
  });

  it('"Done" resets navigation to Dashboard', () => {
    const reset = jest.fn();
    renderPhrase({ reset, setOptions: jest.fn() });
    fireEvent.press(screen.getByText('Done'));
    expect(reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Dashboard' }],
    });
  });
});
