#!/usr/bin/env node
// Usage: node scripts/check-offline-bundle.js (--bundle <path> | --apk <path>) [--expect-present]
// --expect-present inverts it for the full bundle: a marker missing there is stale.

const fs = require('fs');
const path = require('path');

const { readEntryData, readZipEntries } = require('./lib/apk-zip');

const BUNDLE_ENTRY = 'assets/index.android.bundle';

// String literals only online sources contain. No component or function names
// (offline stubs share them) and no viem names (its barrel reaches every bundle).
const FORBIDDEN_MARKERS = [
  // ENS
  'ethereum-rpc.publicnode.com',
  'ENS lookups send',
  // WalletConnect
  'wc_project_id_override',
  'wss://relay.walletconnect.org',
  '@reown/walletkit',
  // Tenderly
  'api.tenderly.co',
  'tenderly_api_key',
  // NetInfo's native module name
  'RNCNetInfo',
];

function findMarkers(bundle) {
  return FORBIDDEN_MARKERS.filter(marker => bundle.includes(marker));
}

function readBundleFromApk(apk) {
  const entry = readZipEntries(apk).find(e => e.name === BUNDLE_ENTRY);
  if (!entry) {
    throw new Error(`no ${BUNDLE_ENTRY} in the APK`);
  }
  return readEntryData(apk, entry);
}

function usage() {
  console.error(
    'Usage: check-offline-bundle.js (--bundle <path> | --apk <path>) [--expect-present]',
  );
  process.exit(1);
}

function argValue(argv, flag) {
  const idx = argv.indexOf(flag);
  if (idx === -1) {
    return null;
  }
  if (idx + 1 >= argv.length) {
    usage();
  }
  return argv[idx + 1];
}

function main() {
  const argv = process.argv.slice(2);
  const bundlePath = argValue(argv, '--bundle');
  const apkPath = argValue(argv, '--apk');
  if (!bundlePath === !apkPath) {
    usage();
  }

  const resolved = path.resolve(bundlePath || apkPath);
  if (!fs.existsSync(resolved)) {
    console.error(`Not found: ${resolved}`);
    process.exit(1);
  }

  let bundle;
  try {
    const file = fs.readFileSync(resolved);
    bundle = apkPath ? readBundleFromApk(file) : file;
  } catch (err) {
    console.error(`Could not read ${resolved}: ${err.message}`);
    process.exit(1);
  }

  const found = findMarkers(bundle);

  if (argv.includes('--expect-present')) {
    const missing = FORBIDDEN_MARKERS.filter(m => !found.includes(m));
    if (missing.length > 0) {
      console.error(
        'Markers missing from the online bundle, so they are stale:',
      );
      missing.forEach(m => console.error(`  - ${m}`));
      process.exit(1);
    }
    console.log('Online bundle check passed: every marker is present.');
    return;
  }

  if (found.length > 0) {
    console.error('Offline bundle contains forbidden online-only markers:');
    found.forEach(m => console.error(`  - ${m}`));
    process.exit(1);
  }
  console.log('Offline bundle check passed: no online-only markers found.');
}

if (require.main === module) {
  main();
}

module.exports = {
  BUNDLE_ENTRY,
  FORBIDDEN_MARKERS,
  findMarkers,
  readBundleFromApk,
};
