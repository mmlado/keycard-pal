import React from 'react';
import { UR, UREncoder } from '@ngraveio/bc-ur';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { MULTI_PART_TIP } from '../src/constants/qrResult';
import QRResultScreen from '../src/screens/QRResultScreen';
import { UR_FRAGMENT_CAPACITY } from '../src/utils/urParts';

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

const mockUseScanDisplay = jest.fn();
jest.mock('../src/hooks/useScanDisplay', () => ({
  useScanDisplay: (_: object, enabled: boolean) => mockUseScanDisplay(enabled),
}));

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

describe('QRResultScreen scanning aids', () => {
  const longUr = UREncoder.encodeSinglePart(
    new UR(Buffer.alloc(500, 1), 'bytes'),
  );

  it('raises the display while shown', () => {
    mockUseScanDisplay.mockClear();
    renderScreen(SAMPLE_UR);
    expect(mockUseScanDisplay).toHaveBeenLastCalledWith(true);
  });

  it('shows the tip for a code of several parts', () => {
    renderScreen(longUr);
    expect(screen.getByText(MULTI_PART_TIP)).toBeTruthy();
  });

  it('shows no tip for a code of one part', () => {
    renderScreen(SAMPLE_UR);
    expect(screen.queryByText(MULTI_PART_TIP)).toBeNull();
  });

  it('shows no tip for a SeedQR and leaves the display alone', () => {
    render(
      <QRResultScreen
        route={
          {
            params: { seedWords: Array(12).fill('abandon'), title: 'SeedQR' },
            key: 'QRResult',
            name: 'QRResult',
          } as any
        }
        navigation={{ reset: jest.fn(), setOptions: jest.fn() } as any}
      />,
    );
    expect(mockUseScanDisplay).toHaveBeenLastCalledWith(false);
    expect(screen.queryByText(MULTI_PART_TIP)).toBeNull();
  });

  it('splits the code at the capacity the tip is decided by', () => {
    mockAnimatedURQRCode.mockClear();
    renderScreen(longUr);
    expect(mockAnimatedURQRCode.mock.calls[0][0]).toMatchObject({
      capacity: UR_FRAGMENT_CAPACITY,
    });
  });
});

function layOut(width: number, height: number) {
  fireEvent(screen.getByTestId('qr-area'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height } },
  });
}

const lastProps = (mock: jest.Mock) =>
  mock.mock.calls[mock.mock.calls.length - 1][0] as {
    size: number;
    maxHeight?: number;
  };

describe('QRResultScreen code size', () => {
  beforeEach(() => mockAnimatedURQRCode.mockClear());

  // The box is the size plus 12 a side, inside 24 a side and 16 above and below.
  it('takes its size from the width in an area taller than wide', () => {
    renderScreen(SAMPLE_UR);
    layOut(400, 900);
    expect(lastProps(mockAnimatedURQRCode).size).toBe(400 - 48 - 24);
  });

  it('takes its size from the height in an area wider than tall', () => {
    renderScreen(SAMPLE_UR);
    layOut(900, 400);
    expect(lastProps(mockAnimatedURQRCode).size).toBe(400 - 32 - 24);
  });

  it('follows the area when it turns', () => {
    renderScreen(SAMPLE_UR);
    layOut(400, 900);
    layOut(900, 400);
    expect(lastProps(mockAnimatedURQRCode).size).toBe(344);
    layOut(400, 900);
    expect(lastProps(mockAnimatedURQRCode).size).toBe(328);
  });

  it('never asks for a negative size', () => {
    renderScreen(SAMPLE_UR);
    layOut(900, 40);
    expect(lastProps(mockAnimatedURQRCode).size).toBe(0);
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

  it('hands the SeedQR the height it must fit, switch included', () => {
    renderPhrase();
    layOut(900, 400);
    expect(lastProps(mockSeedQrCode)).toMatchObject({
      size: 400 - 32 - 24,
      maxHeight: 400 - 32,
    });
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
