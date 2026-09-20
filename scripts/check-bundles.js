#!/usr/bin/env node
// Usage: node scripts/check-bundles.js
// The offline bundle must carry no online-only marker, the online one all of them.

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CHECK = path.join(__dirname, 'check-offline-bundle.js');

function bundle(online, outDir) {
  const output = path.join(outDir, online ? 'online.bundle' : 'offline.bundle');
  console.log(`\nBundling with ONLINE_BUILD=${online}...`);
  execFileSync(
    'npx',
    [
      'react-native',
      'bundle',
      '--platform',
      'android',
      '--dev',
      'false',
      '--entry-file',
      'index.js',
      '--bundle-output',
      output,
      '--reset-cache',
    ],
    {
      cwd: ROOT,
      stdio: ['ignore', 'ignore', 'inherit'],
      env: { ...process.env, ONLINE_BUILD: String(online) },
    },
  );
  return output;
}

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keycard-pal-bundles-'));
try {
  const checks = [
    [bundle(false, outDir)],
    [bundle(true, outDir), '--expect-present'],
  ];
  for (const [file, ...flags] of checks) {
    execFileSync(process.execPath, [CHECK, '--bundle', file, ...flags], {
      stdio: 'inherit',
    });
  }
} catch (err) {
  process.exitCode = 1;
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
