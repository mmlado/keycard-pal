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

const USAGE =
  'Usage: check-offline-bundle.js (--bundle <path> | --apk <path>) [--expect-present]';

function argValue(argv, flag) {
  const idx = argv.indexOf(flag);
  return idx === -1 ? null : argv[idx + 1];
}

// Returns { status, lines } so the logic is testable without a child process.
function run(argv) {
  const bundlePath = argValue(argv, '--bundle');
  const apkPath = argValue(argv, '--apk');
  if (!bundlePath === !apkPath) {
    return { status: 1, lines: [USAGE] };
  }

  const resolved = path.resolve(bundlePath || apkPath);
  if (!fs.existsSync(resolved)) {
    return { status: 1, lines: [`Not found: ${resolved}`] };
  }

  let bundle;
  try {
    const file = fs.readFileSync(resolved);
    bundle = apkPath ? readBundleFromApk(file) : file;
  } catch (err) {
    return {
      status: 1,
      lines: [`Could not read ${resolved}: ${err.message}`],
    };
  }

  const found = findMarkers(bundle);

  if (argv.includes('--expect-present')) {
    const missing = FORBIDDEN_MARKERS.filter(m => !found.includes(m));
    return missing.length > 0
      ? {
          status: 1,
          lines: [
            'Markers missing from the online bundle, so they are stale:',
            ...missing.map(m => `  - ${m}`),
          ],
        }
      : {
          status: 0,
          lines: ['Online bundle check passed: every marker is present.'],
        };
  }

  return found.length > 0
    ? {
        status: 1,
        lines: [
          'Offline bundle contains forbidden online-only markers:',
          ...found.map(m => `  - ${m}`),
        ],
      }
    : {
        status: 0,
        lines: ['Offline bundle check passed: no online-only markers found.'],
      };
}

if (require.main === module) {
  const { status, lines } = run(process.argv.slice(2));
  lines.forEach(line =>
    status === 0 ? console.log(line) : console.error(line),
  );
  process.exitCode = status;
}

module.exports = {
  BUNDLE_ENTRY,
  FORBIDDEN_MARKERS,
  findMarkers,
  readBundleFromApk,
  run,
};
