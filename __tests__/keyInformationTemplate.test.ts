import { fromHex } from '../src/utils/hex';
import { keysetVersions } from '../src/utils/keyInformationTemplate';

const template = (
  entries: number[],
  lengthForm: 'short' | 0x81 | 0x82 = 'short',
) => {
  const n = entries.length;
  const length =
    lengthForm === 'short'
      ? [n]
      : lengthForm === 0x81
      ? [0x81, n]
      : [0x82, Math.floor(n / 256), n % 256];
  return new Uint8Array([0xe0, ...length, ...entries]);
};

const basic = (id: number, kvn: number, ...components: number[]) => [
  0xc0,
  2 + components.length,
  id,
  kvn,
  ...components,
];

const desKeyset = (kvn: number) =>
  [1, 2, 3].flatMap(id => basic(id, kvn, 0x80, 0x10));

describe('keysetVersions', () => {
  it('reads the measured Developer card: one keyset at version 01', () => {
    expect(
      keysetVersions(fromHex('e012c00401018010c00402018010c00403018010')),
    ).toEqual([0x01]);
  });

  it('lists each version once, in the card order', () => {
    expect(
      keysetVersions(template([...desKeyset(0x30), ...desKeyset(0x02)])),
    ).toEqual([0x30, 0x02]);
  });

  it('reads the extended structure', () => {
    const extended = [
      0xc0, 0x09, 0x01, 0x02, 0xff, 0x80, 0x00, 0x10, 0x01, 0x14, 0x00,
    ];
    expect(keysetVersions(template([...desKeyset(0x01), ...extended]))).toEqual(
      [0x01, 0x02],
    );
  });

  it.each([
    ['RSA public key', [0xa0, 0x03, 0xa1, 0x80]],
    ['ECC public key with its parameters', [0xb0, 0x41, 0xf0, 0x01]],
  ])('passes over a version holding only an %s', (_, components) => {
    expect(
      keysetVersions(
        template([...desKeyset(0x01), ...basic(0x01, 0x73, ...components)]),
      ),
    ).toEqual([0x01]);
  });

  it.each([
    ['an AES key', [0x88, 0x10]],
    ['an ECC private key', [0xb1, 0x20]],
    ['a key of private use', [0x00, 0x10]],
    ['a public key beside a symmetric one', [0xa1, 0x80, 0x80, 0x10]],
  ])('counts a version holding %s', (_, components) => {
    expect(keysetVersions(template(basic(0x01, 0x20, ...components)))).toEqual([
      0x20,
    ]);
  });

  it.each([
    ['an odd basic remainder', [0xc0, 0x05, 0x01, 0x20, 0x80, 0x10, 0x01]],
    [
      'a basic pair of type FF',
      [0xc0, 0x06, 0x01, 0x20, 0x80, 0x10, 0xff, 0x10],
    ],
    [
      'an extended component cut short',
      [0xc0, 0x05, 0x01, 0x20, 0xff, 0x80, 0x00],
    ],
    [
      'an extended usage length of 2',
      [0xc0, 0x09, 0x01, 0x20, 0xff, 0x80, 0x00, 0x10, 0x02, 0x14, 0x00],
    ],
    [
      'bytes after the extended access',
      [0xc0, 0x0a, 0x01, 0x20, 0xff, 0x80, 0x00, 0x10, 0x00, 0x00, 0x99, 0x99],
    ],
  ])('counts a version whose key has %s', (_, entry) => {
    expect(keysetVersions(template(entry))).toEqual([0x20]);
  });

  it('skips an empty entry', () => {
    expect(keysetVersions(template([0xc0, 0x00, ...desKeyset(0x01)]))).toEqual([
      0x01,
    ]);
  });

  it.each([
    [0x81, 10],
    [0x82, 25],
  ] as const)('reads the %s length form', (form, keysets) => {
    const entries = Array.from({ length: keysets }, (_, i) =>
      desKeyset(i + 1),
    ).flat();
    expect(keysetVersions(template(entries, form))).toHaveLength(keysets);
  });

  it.each([
    ['nothing', new Uint8Array(0)],
    ['another tag', fromHex('c00401018010')],
    ['a length past the end', fromHex('e014c00401018010')],
    ['bytes after the template', fromHex('e006c004010180109000')],
    ['an indefinite length', fromHex('e080c0040101801000')],
    [
      'an entry with another tag',
      template([0xc1, 0x04, 0x01, 0x01, 0x80, 0x10]),
    ],
    [
      'an entry past the template',
      template([0xc0, 0x09, 0x01, 0x01, 0x80, 0x10]),
    ],
    ['an entry of 3 bytes', template([0xc0, 0x03, 0x01, 0x01, 0x80])],
    ['no entry', template([])],
    ['only empty entries', template([0xc0, 0x00, 0xc0, 0x00])],
  ])('reads nothing from %s', (_, data) => {
    expect(keysetVersions(data)).toBeNull();
  });
});
