#!/usr/bin/env node
// Usage: node scripts/smoke-release.js [full|offline]
//
// Builds a MINIFIED release APK and launches it on a connected device, failing
// if the process dies. Every other test in this repo runs against unminified
// JS, so R8 can break the shipped binary in ways the suite structurally cannot
// see — as it did in 1.9.0/1.9.1, where R8 renamed com.sun.jna.Pointer and the
// app crashed on launch from every install source while CI stayed green.
//
// Signs with the debug keystore: this build is for launching, never shipping.

const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const flavor = (process.argv[2] || 'full').toLowerCase();

if (!['full', 'offline'].includes(flavor)) {
  console.error(`Unknown flavor: ${flavor} (expected "full" or "offline")`);
  process.exit(1);
}

const applicationId =
  flavor === 'offline' ? 'com.keycardpal.offline' : 'com.keycardpal';
const variant = flavor === 'offline' ? 'offlineRelease' : 'fullRelease';
const gradleTask = flavor === 'offline'
  ? 'assembleOfflineRelease'
  : 'assembleFullRelease';

// execFileSync returns null when stdout is not captured (stdio: 'ignore'),
// so callers that only care about the exit status still get a string back.
const adb = (args, opts = {}) => {
  const out = execFileSync('adb', args, { encoding: 'utf8', ...opts });
  return out ? out.trim() : '';
};

function fail(message, detail) {
  console.error(`\n✗ SMOKE FAILED: ${message}`);
  if (detail) console.error(`\n${detail}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Device
// ---------------------------------------------------------------------------

let devices;
try {
  devices = adb(['devices'])
    .split('\n')
    .slice(1)
    .filter(l => l.trim().endsWith('\tdevice'));
} catch {
  fail('adb not found or not runnable.');
}

if (!devices.length) {
  fail(
    'No device attached.\n' +
      'Plug in a phone with USB debugging enabled — the point of this check is a\n' +
      'real minified build on real hardware, so there is no meaningful way to skip it.',
  );
}

const abi = adb(['shell', 'getprop', 'ro.product.cpu.abi']);
const model = adb(['shell', 'getprop', 'ro.product.model']);
console.log(`Device: ${model} (${abi})`);

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

console.log(`\nBuilding ${variant} (minified, debug-signed)...`);
try {
  execSync(`./gradlew ${gradleTask}`, {
    cwd: path.join(ROOT, 'android'),
    stdio: 'inherit',
    env: {
      ...process.env,
      ANDROID_KEYSTORE_PATH: 'debug.keystore',
      ANDROID_KEYSTORE_PASSWORD: 'android',
      ANDROID_KEY_ALIAS: 'androiddebugkey',
    },
  });
} catch {
  fail(`${gradleTask} failed.`);
}

const outDir = path.join(
  ROOT,
  'android/app/build/outputs/apk',
  flavor,
  'release',
);
const apk = fs
  .readdirSync(outDir)
  .filter(f => f.endsWith('.apk'))
  .find(f => f.includes(abi)) // match the device, fall back to universal
  || fs.readdirSync(outDir).find(f => f.includes('universal'));

if (!apk) fail(`No APK for ${abi} (or universal) in ${outDir}`);
console.log(`\nAPK: ${apk}`);

// The offline APK must not carry the online-only native modules (#270).
// Autolinking is not flavor-aware, so this is checked on the artifact itself.
if (flavor === 'offline') {
  console.log('\nChecking the offline APK for online-only native code...');
  try {
    execFileSync(
      process.execPath,
      [
        path.join(ROOT, 'scripts/check-offline-apk.js'),
        '--apk',
        path.join(outDir, apk),
      ],
      { stdio: 'inherit' },
    );
  } catch {
    fail(`${apk} contains online-only native code (see above).`);
  }
}

// ---------------------------------------------------------------------------
// Install and launch
// ---------------------------------------------------------------------------

// Uninstall so the run exercises a genuine first launch: the 1.9.x crash hit
// the first-run welcome screen, which an upgrade install would have skipped.
try {
  adb(['uninstall', applicationId]);
} catch {
  // Not installed — fine.
}

adb(['install', '-r', path.join(outDir, apk)], { stdio: 'ignore' });
adb(['logcat', '-c']);
adb([
  'shell',
  'monkey',
  '-p',
  applicationId,
  '-c',
  'android.intent.category.LAUNCHER',
  '1',
], { stdio: 'ignore' });

const SETTLE_MS = 10000;
console.log(`Launched. Watching for ${SETTLE_MS / 1000}s...`);
execSync(`sleep ${SETTLE_MS / 1000}`);

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

const log = adb(['logcat', '-d']);
const crashes = log
  .split('\n')
  .filter(l => /FATAL EXCEPTION|UnsatisfiedLinkError|ClassNotFoundException|NoSuchMethodError/.test(l));

let pid = '';
try {
  pid = adb(['shell', 'pidof', applicationId]);
} catch {
  // pidof exits non-zero when the process is gone.
}

if (crashes.length) {
  // Include the frames after the first crash line: with R8 the class names are
  // mangled, and those frames are what identify the stripped symbol.
  const start = log.split('\n').findIndex(l => crashes[0] === l);
  const trace = log.split('\n').slice(start, start + 25).join('\n');
  fail(`${applicationId} crashed on launch.`, trace);
}

if (!pid) {
  fail(
    `${applicationId} is not running ${SETTLE_MS / 1000}s after launch, with no crash in logcat.\n` +
      'It may have exited silently — check the device screen and `adb logcat -d`.',
  );
}

console.log(`\n✓ ${applicationId} launched and is alive (pid ${pid})`);
