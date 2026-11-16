import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import jsQR from 'jsqr';

import SeedQrCode from '../src/components/SeedQrCode';
import { SEED_QR_ERROR_CORRECTION, seedQrSegments } from '../src/utils/seedQr';

jest.mock('react-native-qrcode-svg', () => 'QRCode');

jest.mock('react-native-paper', () => {
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    MD3DarkTheme: { colors: {} },
    SegmentedButtons: ({
      buttons,
      onValueChange,
    }: {
      buttons: { value: string; label: string }[];
      onValueChange: (v: string) => void;
    }) => (
      <View>
        {buttons.map(b => (
          <TouchableOpacity
            key={b.value}
            onPress={() => onValueChange(b.value)}
          >
            <Text>{b.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
  };
});

// The library's own step from props to modules, so the test reads what the screen draws.
const genMatrix: (value: unknown, ecl: string) => number[][] =
  jest.requireActual('react-native-qrcode-svg/src/genMatrix').default;

// Published SeedQR vectors 4 (12 words) and 1 (24 words).
const TWELVE = {
  words:
    'forum undo fragile fade shy sign arrest garment culture tube off merit',
  digits: '073318950739065415961602009907670428187212261116',
  hex: '5bbd9d71a8ec7990831aff359d426545',
};
const TWENTY_FOUR = {
  words:
    'attack pizza motion avocado network gather crop fresh patrol unusual wild holiday candy pony ranch winter theme error hybrid van cereal salon goddess expire',
  digits:
    '011513251154012711900771041507421289190620080870026613431420201617920614089619290300152408010643',
  hex: '0e74b64107f94cc0ccfae6a13dcbec3662154fec67e0e00999c07892597d190a',
};

/** The code as the screen draws it, its quiet zone included, read back with jsQR. */
function drawnCode() {
  const { value, ecl, size } = screen.getByTestId('seed-qr-code').props;
  const { padding } = StyleSheet.flatten(
    screen.getByLabelText(/SeedQR$/).props.style,
  );
  const matrix = genMatrix(value, ecl);
  const quietModules = (padding * matrix.length) / size;
  const scale = 4;
  const quiet = Math.floor(quietModules);
  const width = (matrix.length + quiet * 2) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  matrix.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (!dark) {
        return;
      }
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const pixel =
            ((y + quiet) * scale + dy) * width + (x + quiet) * scale + dx;
          pixels.fill(0, pixel * 4, pixel * 4 + 3);
        }
      }
    }),
  );
  const code = jsQR(pixels, width, width);
  if (!code) {
    throw new Error('the drawn code does not decode');
  }
  return {
    modules: matrix.length,
    quietModules,
    modes: code.chunks.map(c => c.type),
    text: code.data,
    hex: Buffer.from(code.binaryData).toString('hex'),
  };
}

describe('SeedQrCode', () => {
  it.each([
    [TWELVE, 25],
    [TWENTY_FOUR, 29],
  ])(
    'draws Standard first, in numeric mode, at the specification size',
    ({ words, digits }, modules) => {
      render(<SeedQrCode words={words.split(' ')} size={300} />);
      expect(drawnCode()).toMatchObject({
        modules,
        modes: ['numeric'],
        text: digits,
      });
    },
  );

  it.each([
    [TWELVE, 21],
    [TWENTY_FOUR, 25],
  ])(
    'redraws as Compact, in byte mode, at the specification size',
    ({ words, hex }, modules) => {
      render(<SeedQrCode words={words.split(' ')} size={300} />);
      fireEvent.press(screen.getByText('Compact'));
      const code = drawnCode();
      expect(code.modules).toBe(modules);
      expect(code.modes).toEqual(['byte']);
      expect(code.hex).toBe(hex);
    },
  );

  it('goes back to Standard', () => {
    render(<SeedQrCode words={TWELVE.words.split(' ')} size={300} />);
    fireEvent.press(screen.getByText('Compact'));
    fireEvent.press(screen.getByText('Standard'));
    expect(drawnCode().text).toBe(TWELVE.digits);
  });

  // AnimatedURQRCode draws a code of `size` in a box padded by 12.
  it('takes the box a UR code of the same size takes', () => {
    render(<SeedQrCode words={TWELVE.words.split(' ')} size={300} />);
    const { padding } = StyleSheet.flatten(
      screen.getByLabelText('Standard SeedQR').props.style,
    );
    expect(
      screen.getByTestId('seed-qr-code').props.size + padding * 2,
    ).toBeCloseTo(324);
  });

  it.each([
    ['12 words, Standard', TWELVE, 'Standard'],
    ['12 words, Compact', TWELVE, 'Compact'],
    ['24 words, Standard', TWENTY_FOUR, 'Standard'],
    ['24 words, Compact', TWENTY_FOUR, 'Compact'],
  ])(
    '%s leaves a quiet zone of four modules or more',
    (_, { words }, format) => {
      render(<SeedQrCode words={words.split(' ')} size={300} />);
      fireEvent.press(screen.getByText(format));
      expect(drawnCode().quietModules).toBeGreaterThanOrEqual(4 - 1e-9);
    },
  );

  // The generation tests run seedQrSegments, so they cover what is drawn.
  it('draws the segments and the error correction seedQr gives', () => {
    const words = TWELVE.words.split(' ');
    render(<SeedQrCode words={words} size={300} />);
    const props = () => screen.getByTestId('seed-qr-code').props;
    expect(props().value).toEqual(seedQrSegments(words, 'standard'));
    expect(props().ecl).toBe(SEED_QR_ERROR_CORRECTION);
    fireEvent.press(screen.getByText('Compact'));
    expect(props().value).toEqual(seedQrSegments(words, 'compact'));
  });

  it('names the format to a screen reader', () => {
    render(<SeedQrCode words={TWELVE.words.split(' ')} size={300} />);
    expect(screen.getByLabelText('Standard SeedQR')).toBeTruthy();
    fireEvent.press(screen.getByText('Compact'));
    expect(screen.getByLabelText('Compact SeedQR')).toBeTruthy();
  });
});
