import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import QrCodeImage from '../src/components/QrCodeImage';
import { decodeDrawnCode } from './qrImage.testUtils';

jest.mock('react-native-qrcode-svg', () => 'QRCode');

const code = () => screen.getByTestId('qr');

describe('QrCodeImage', () => {
  it.each([
    ['the smallest code', 'A', 21],
    ['a URL', 'https://keycard.tech', 25],
    ['an Ethereum address', '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', 29],
    [
      'a Taproot address',
      'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297',
      33,
    ],
    [
      'a long URL',
      'https://docs.keycard.tech/en/developers/build#building-the-applet-from-source',
      37,
    ],
  ])('draws %s with four light modules or more a side', (_, value, modules) => {
    render(<QrCodeImage value={value} size={312} testID="qr" />);
    const drawn = decodeDrawnCode(code().props);
    expect(drawn.modules).toBe(modules);
    expect(drawn.quietModules).toBeGreaterThanOrEqual(4 - 1e-9);
    expect(drawn.text).toBe(value);
  });

  it('gives the smallest code exactly four', () => {
    render(<QrCodeImage value="A" size={312} testID="qr" />);
    expect(decodeDrawnCode(code().props).quietModules).toBeCloseTo(4);
  });

  it('draws black on white, the margin in the code and not behind it', () => {
    render(<QrCodeImage value="A" size={312} testID="qr" />);
    expect(code().props).toMatchObject({
      size: 312,
      color: '#000000',
      backgroundColor: '#ffffff',
    });
    const wrapper = StyleSheet.flatten(code().parent!.props.style);
    expect(wrapper.backgroundColor).toBeUndefined();
    expect(wrapper.padding).toBeUndefined();
  });

  it('passes the error correction level', () => {
    render(<QrCodeImage value="A" size={312} ecl="L" testID="qr" />);
    expect(code().props.ecl).toBe('L');
  });

  it('names the code to a screen reader when asked', () => {
    render(
      <QrCodeImage
        value="A"
        size={312}
        accessible
        accessibilityRole="image"
        accessibilityLabel="Key QR"
      />,
    );
    expect(screen.getByLabelText('Key QR')).toBeTruthy();
  });
});
