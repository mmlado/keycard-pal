import React from 'react';
import { act, render } from '@testing-library/react-native';
import { UR, UREncoder } from '@ngraveio/bc-ur';
import AnimatedURQRCode from 'react-native-animated-ur-qr';

import { decodeDrawnCode } from './qrImage.testUtils';

const mockQRCode = jest.fn((_: object) => null);
jest.mock(
  'react-native-qrcode-svg',
  () => (props: object) => mockQRCode(props),
);

function urString(bytes: number): string {
  return UREncoder.encodeSinglePart(new UR(Buffer.alloc(bytes, 0xa5), 'bytes'));
}

const drawn = () =>
  decodeDrawnCode(
    mockQRCode.mock.lastCall![0] as Parameters<typeof decodeDrawnCode>[0],
  );

describe('AnimatedURQRCode as QRResultScreen draws it', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('draws a one-frame UR with four light modules a side, in the SVG', () => {
    render(<AnimatedURQRCode urString={urString(80)} size={300} />);
    const code = drawn();
    expect(code.quietModules).toBeCloseTo(4);
    expect(code.text.startsWith('UR:BYTES/')).toBe(true);
  });

  it('draws every frame of an animated UR with four light modules a side', () => {
    render(<AnimatedURQRCode urString={urString(600)} size={300} />);
    const frames = new Set<string>();
    for (let frame = 0; frame < 8; frame++) {
      const code = drawn();
      expect(code.quietModules).toBeCloseTo(4);
      frames.add(code.text);
      act(() => {
        jest.advanceTimersByTime(200);
      });
    }
    expect(frames.size).toBe(8);
  });
});
