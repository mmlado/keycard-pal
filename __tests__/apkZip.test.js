const { Buffer } = require('buffer');

const { readEntryData, readZipEntries } = require('../scripts/lib/apk-zip');
const { METHOD_DEFLATED, buildZip } = require('./zipFixture.testUtils');

describe('apk-zip', () => {
  it('lists entries and reads a stored one', () => {
    const zip = buildZip([
      { name: 'AndroidManifest.xml', data: 'manifest' },
      { name: 'classes.dex', data: 'dex-bytes' },
    ]);
    const entries = readZipEntries(zip);
    expect(entries.map(e => e.name)).toEqual([
      'AndroidManifest.xml',
      'classes.dex',
    ]);
    expect(readEntryData(zip, entries[1]).toString()).toBe('dex-bytes');
  });

  it('inflates a deflated entry', () => {
    const text = 'assets '.repeat(200);
    const zip = buildZip([
      { name: 'big.txt', data: text, method: METHOD_DEFLATED },
    ]);
    const [entry] = readZipEntries(zip);
    expect(entry.compressedSize).toBeLessThan(text.length);
    expect(readEntryData(zip, entry).toString()).toBe(text);
  });

  it('finds the end record behind a zip comment', () => {
    const zip = buildZip([{ name: 'a', data: 'x' }]);
    zip.writeUInt16LE(7, zip.length - 2);
    const withComment = Buffer.concat([zip, Buffer.from('comment')]);
    expect(readZipEntries(withComment)).toHaveLength(1);
  });

  it('ignores an end-record signature inside the zip comment', () => {
    const zip = buildZip([{ name: 'a', data: 'x' }]);
    const comment = Buffer.alloc(30);
    comment.writeUInt32LE(0x06054b50, 0);
    zip.writeUInt16LE(comment.length, zip.length - 2);
    const entries = readZipEntries(Buffer.concat([zip, comment]));
    expect(entries.map(e => e.name)).toEqual(['a']);
  });

  it('rejects a file that is not a zip', () => {
    expect(() =>
      readZipEntries(Buffer.from('definitely not a zip file')),
    ).toThrow('not a zip file');
  });

  it('rejects zip64 archives', () => {
    const zip = buildZip([{ name: 'a', data: 'x' }]);
    zip.writeUInt16LE(0xffff, zip.length - 22 + 10);
    expect(() => readZipEntries(zip)).toThrow('zip64');
  });

  it('rejects a corrupt central directory', () => {
    const zip = buildZip([{ name: 'a', data: 'x' }]);
    const centralDirOffset = zip.readUInt32LE(zip.length - 22 + 16);
    zip.writeUInt32LE(0, centralDirOffset);
    expect(() => readZipEntries(zip)).toThrow('corrupt central directory');
  });

  it('rejects a corrupt local header', () => {
    const zip = buildZip([{ name: 'a', data: 'x' }]);
    const [entry] = readZipEntries(zip);
    zip.writeUInt32LE(0, entry.localHeaderOffset);
    expect(() => readEntryData(zip, entry)).toThrow('corrupt local header');
  });

  it('rejects a compression method it cannot read', () => {
    const zip = buildZip([{ name: 'a', data: 'x', method: 12 }]);
    const [entry] = readZipEntries(zip);
    expect(() => readEntryData(zip, entry)).toThrow(
      'unsupported compression method 12',
    );
  });
});
