const zlib = require('zlib');

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const ZIP64_MARKER_16 = 0xffff;
const ZIP64_MARKER_32 = 0xffffffff;
const METHOD_STORED = 0;
const METHOD_DEFLATED = 8;

// Lists the entries of a zip from its central directory. APKs are plain zips;
// zip64 is rejected explicitly rather than misread.
function readZipEntries(buf) {
  const minEocd = 22;
  const maxCommentLength = 0xffff;
  let eocd = -1;
  for (
    let i = buf.length - minEocd;
    i >= 0 && i >= buf.length - minEocd - maxCommentLength;
    i--
  ) {
    if (buf.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) {
    throw new Error('not a zip file (no end-of-central-directory record)');
  }

  const entryCount = buf.readUInt16LE(eocd + 10);
  const centralDirOffset = buf.readUInt32LE(eocd + 16);
  if (entryCount === ZIP64_MARKER_16 || centralDirOffset === ZIP64_MARKER_32) {
    throw new Error('zip64 archives are not supported');
  }

  const entries = [];
  let pos = centralDirOffset;
  for (let n = 0; n < entryCount; n++) {
    if (buf.readUInt32LE(pos) !== CENTRAL_DIR_SIGNATURE) {
      throw new Error(`corrupt central directory at offset ${pos}`);
    }
    const method = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const nameLength = buf.readUInt16LE(pos + 28);
    const extraLength = buf.readUInt16LE(pos + 30);
    const commentLength = buf.readUInt16LE(pos + 32);
    const localHeaderOffset = buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLength);
    entries.push({ name, method, compressedSize, localHeaderOffset });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readEntryData(buf, entry) {
  const header = entry.localHeaderOffset;
  if (buf.readUInt32LE(header) !== LOCAL_HEADER_SIGNATURE) {
    throw new Error(`corrupt local header for ${entry.name}`);
  }
  const nameLength = buf.readUInt16LE(header + 26);
  const extraLength = buf.readUInt16LE(header + 28);
  const start = header + 30 + nameLength + extraLength;
  const raw = buf.subarray(start, start + entry.compressedSize);
  if (entry.method === METHOD_STORED) {
    return raw;
  }
  if (entry.method === METHOD_DEFLATED) {
    return zlib.inflateRawSync(raw);
  }
  throw new Error(
    `unsupported compression method ${entry.method} for ${entry.name}`,
  );
}

module.exports = { readZipEntries, readEntryData };
