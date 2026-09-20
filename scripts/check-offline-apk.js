#!/usr/bin/env node
// Usage: node scripts/check-offline-apk.js --apk <path>
//
// Fails if an offline APK carries online-only code: native modules only the full
// flavor links (ADR-0009), or a JS bundle with a check-offline-bundle.js marker.
// JNA and uniffi are not linked since ADR-0014; their markers stay as a tripwire.

const fs = require('fs');
const path = require('path');

const { findMarkers, readBundleFromApk } = require('./check-offline-bundle');
const { readEntryData, readZipEntries } = require('./lib/apk-zip');

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

function parseArgs(argv) {
  const idx = argv.indexOf('--apk');
  if (idx === -1 || idx + 1 >= argv.length) {
    console.error('Usage: check-offline-apk.js --apk <path>');
    process.exit(1);
  }
  return argv[idx + 1];
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

  for (const marker of findMarkers(readBundleFromApk(buf))) {
    violations.push(`${marker} (JS bundle)`);
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
    console.error('Offline APK contains online-only code:');
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  }

  console.log(
    'Offline APK check passed: no online-only native code or JS found.',
  );
}

main();
