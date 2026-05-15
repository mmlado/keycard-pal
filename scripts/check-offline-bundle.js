#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// These markers are string literals that only appear if our own ENS source
// files are bundled. Avoid viem function names — viem is a shared dependency
// and its barrel exports include ENS internals regardless of tree-shaking.
const FORBIDDEN_MARKERS = [
  'ethereum-rpc.publicnode.com',
  'EnsSettingsSection',
  'saveEnsEnabled',
  'ENS RPC URL',
  'ENS lookups send',
];

function parseArgs(argv) {
  const idx = argv.indexOf('--bundle');
  if (idx === -1 || idx + 1 >= argv.length) {
    console.error('Usage: check-offline-bundle.js --bundle <path>');
    process.exit(1);
  }
  return argv[idx + 1];
}

function main() {
  const bundlePath = parseArgs(process.argv);
  const resolved = path.resolve(bundlePath);

  if (!fs.existsSync(resolved)) {
    console.error(`Bundle not found: ${resolved}`);
    process.exit(1);
  }

  const content = fs.readFileSync(resolved, 'utf8');
  const violations = [];

  for (const marker of FORBIDDEN_MARKERS) {
    if (content.includes(marker)) {
      violations.push(marker);
    }
  }

  if (violations.length > 0) {
    console.error('Offline bundle contains forbidden online-only markers:');
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  }

  console.log('Offline bundle check passed — no ENS/RPC markers found.');
}

main();
