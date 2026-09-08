#!/usr/bin/env node
// Usage: node scripts/check-offline-apk.js --apk <path>
//
// Fails if an offline APK carries native code that only the full flavor should
// link: WalletConnect's Android module and what it drags in (JNA and the
// Yttrium uniffi bindings) plus NetInfo (#270). React Native autolinking is not
// flavor-aware, so react-native.config.js keeps those packages out of it and
// the full flavor links them by hand; this is the artifact-level check that
// the arrangement still holds. Reads the APK's own zip directory, so it needs
// neither unzip nor aapt.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Dex files store class descriptors as MUTF-8 strings, so a plain substring
// search over the raw dex finds any reference to these packages.
const FORBIDDEN_CLASS_PREFIXES = [
  'Lcom/sun/jna/',
  'Luniffi/',
  'Lcom/walletconnect/reactnativemodule/',
  'Lcom/reactnativecommunity/netinfo/',
];

// Native libraries shipped by JNA and the Yttrium bindings.
const FORBIDDEN_NATIVE_LIBS = [
  /^lib\/[^/]+\/libjnidispatch\.so$/,
  /^lib\/[^/]+\/libuniffi_.*\.so$/,
];

const DEX_ENTRY = /^classes\d*\.dex$/;

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const ZIP64_MARKER_16 = 0xffff;
const ZIP64_MARKER_32 = 0xffffffff;
const METHOD_STORED = 0;
const METHOD_DEFLATED = 8;

function parseArgs(argv) {
  const idx = argv.indexOf('--apk');
  if (idx === -1 || idx + 1 >= argv.length) {
    console.error('Usage: check-offline-apk.js --apk <path>');
    process.exit(1);
  }
  return argv[idx + 1];
}

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

function findViolations(buf) {
  const violations = [];
  const entries = readZipEntries(buf);

  for (const entry of entries) {
    if (FORBIDDEN_NATIVE_LIBS.some(pattern => pattern.test(entry.name))) {
      violations.push(`${entry.name} (native library)`);
    }
  }

  for (const entry of entries) {
    if (!DEX_ENTRY.test(entry.name)) {
      continue;
    }
    const dex = readEntryData(buf, entry);
    for (const prefix of FORBIDDEN_CLASS_PREFIXES) {
      if (dex.includes(prefix)) {
        violations.push(`${prefix} (class in ${entry.name})`);
      }
    }
  }

  return violations;
}

function main() {
  const apkPath = path.resolve(parseArgs(process.argv));

  if (!fs.existsSync(apkPath)) {
    console.error(`APK not found: ${apkPath}`);
    process.exit(1);
  }

  let violations;
  try {
    violations = findViolations(fs.readFileSync(apkPath));
  } catch (err) {
    console.error(`Could not read ${apkPath}: ${err.message}`);
    process.exit(1);
  }

  if (violations.length > 0) {
    console.error('Offline APK contains online-only native code:');
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  }

  console.log(
    'Offline APK check passed — no WalletConnect, JNA, uniffi or NetInfo native code found.',
  );
}

main();
