import jsQR from 'jsqr';

// The library's own step from props to modules, so a test reads what the screen draws.
const genMatrix: (value: unknown, ecl: string) => number[][] =
  jest.requireActual('react-native-qrcode-svg/src/genMatrix').default;

type QRProps = {
  value: unknown;
  size: number;
  ecl?: string;
  quietZone?: number;
};

/** A react-native-qrcode-svg code as its props draw it, quiet zone included, read back with jsQR. */
export function decodeDrawnCode({
  value,
  size,
  ecl = 'M',
  quietZone = 0,
}: QRProps) {
  const matrix = genMatrix(value, ecl);
  // The code is drawn `size` units wide and the quiet zone around it in the same units.
  const quietModules = (quietZone * matrix.length) / size;
  const scale = 4;
  const quiet = Math.floor(quietModules + 1e-9);
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
