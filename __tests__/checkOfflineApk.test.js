const { Buffer } = require('buffer');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const SCRIPT = path.resolve(__dirname, '../scripts/check-offline-apk.js');

const METHOD_STORED = 0;
const METHOD_DEFLATED = 8;

// Minimal zip writer (local headers, central directory, end record). CRCs are
// left at zero: the script reads the directory and inflates entries, it does
// not verify checksums.
function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data, method = METHOD_STORED } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const raw = Buffer.from(data);
    const payload = method === METHOD_DEFLATED ? zlib.deflateRawSync(raw) : raw;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    localParts.push(local, nameBuf, payload);
    centralParts.push(central, nameBuf);
    offset += local.length + nameBuf.length + payload.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

function writeFixture(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-apk-'));
  const filePath = path.join(dir, 'keycard-pal-offline-release-universal.apk');
  fs.writeFileSync(filePath, content);
  return filePath;
}

function run(...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

const BUNDLE = 'assets/index.android.bundle';

// Every fixture gets a clean JS bundle unless it brings its own.
function runOnZip(entries, { bundle = true } = {}) {
  const withBundle =
    !bundle || entries.some(entry => entry.name === BUNDLE)
      ? entries
      : [...entries, { name: BUNDLE, data: 'var x=1;' }];
  const filePath = writeFixture(buildZip(withBundle));
  try {
    return run('--apk', filePath);
  } finally {
    fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
  }
}

const CLEAN_DEX =
  'dex\n035\0Lcom/keycardpal/MainApplication;Lcom/facebook/react/PackageList;';

describe('check-offline-apk', () => {
  it('passes on an APK without online-only native code', () => {
    const result = runOnZip([
      { name: 'AndroidManifest.xml', data: 'manifest' },
      { name: 'classes.dex', data: CLEAN_DEX },
      { name: 'lib/arm64-v8a/libhermes.so', data: 'elf' },
      { name: 'lib/arm64-v8a/libappmodules.so', data: 'elf' },
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('passed');
  });

  it('fails on a dex that references JNA', () => {
    const result = runOnZip([
      { name: 'classes.dex', data: `${CLEAN_DEX}Lcom/sun/jna/Pointer;` },
    ]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Lcom/sun/jna/');
  });

  it('fails on a secondary dex that references uniffi', () => {
    const result = runOnZip([
      { name: 'classes.dex', data: CLEAN_DEX },
      { name: 'classes2.dex', data: `${CLEAN_DEX}Luniffi/yttrium_wcpay/Foo;` },
    ]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Luniffi/');
    expect(result.stderr).toContain('classes2.dex');
  });

  it('fails on WalletConnect and NetInfo module classes', () => {
    const result = runOnZip([
      {
        name: 'classes.dex',
        data: `${CLEAN_DEX}Lcom/walletconnect/reactnativemodule/RNWalletConnectModulePackage;Lcom/reactnativecommunity/netinfo/NetInfoPackage;`,
      },
    ]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Lcom/walletconnect/reactnativemodule/');
    expect(result.stderr).toContain('Lcom/reactnativecommunity/netinfo/');
  });

  it('inflates deflated dex entries before scanning them', () => {
    const result = runOnZip([
      {
        name: 'classes.dex',
        data: `${CLEAN_DEX}Lcom/sun/jna/Native;`,
        method: METHOD_DEFLATED,
      },
    ]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Lcom/sun/jna/');
  });

  it('fails on JNA and uniffi native libraries for any ABI', () => {
    const result = runOnZip([
      { name: 'classes.dex', data: CLEAN_DEX },
      { name: 'lib/arm64-v8a/libjnidispatch.so', data: 'elf' },
      { name: 'lib/armeabi-v7a/libuniffi_yttrium_wcpay.so', data: 'elf' },
    ]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('lib/arm64-v8a/libjnidispatch.so');
    expect(result.stderr).toContain(
      'lib/armeabi-v7a/libuniffi_yttrium_wcpay.so',
    );
  });

  it('fails on a JS bundle that carries an online-only marker', () => {
    const result = runOnZip([
      { name: 'classes.dex', data: CLEAN_DEX },
      { name: BUNDLE, data: 'fetch("https://api.tenderly.co/api/v1")' },
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('api.tenderly.co (JS bundle)');
  });

  it('inflates a deflated JS bundle before scanning it', () => {
    const result = runOnZip([
      { name: 'classes.dex', data: CLEAN_DEX },
      { name: BUNDLE, data: 'x="RNCNetInfo"', method: METHOD_DEFLATED },
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('RNCNetInfo (JS bundle)');
  });

  it('fails on an APK without a JS bundle', () => {
    const result = runOnZip([{ name: 'classes.dex', data: CLEAN_DEX }], {
      bundle: false,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(BUNDLE);
  });

  it('fails on a file that is not a zip', () => {
    const filePath = writeFixture('definitely not an apk');
    try {
      const result = run('--apk', filePath);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('not a zip file');
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    }
  });

  it('fails when --apk argument is missing', () => {
    const result = run();
    expect(result.status).not.toBe(0);
  });

  it('fails when the APK does not exist', () => {
    const result = run('--apk', '/tmp/nonexistent-apk-12345.apk');
    expect(result.status).not.toBe(0);
  });
});
