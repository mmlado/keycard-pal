#!/usr/bin/env node
// Usage: node scripts/check-affiliate-markers.js --bundle <path>
//
// Fails a bundle that carries the retired affiliate link or an Advertisement label.
// run() returns { status, lines } so the logic is testable without a child process.

const fs = require('fs');
const path = require('path');

// The shop host, the referral code, and the word that labelled the placement.
const RETIRED_MARKERS = ['get.keycard.tech', 'vuxxnf', 'Advertisement'];

function findMarkers(bundle, markers = RETIRED_MARKERS) {
  return markers.filter(marker => bundle.includes(marker));
}

const USAGE = 'Usage: check-affiliate-markers.js --bundle <path>';

function argValue(argv, flag) {
  const idx = argv.indexOf(flag);
  return idx === -1 ? null : argv[idx + 1];
}

function run(argv) {
  const bundlePath = argValue(argv, '--bundle');
  if (!bundlePath) {
    return { status: 1, lines: [USAGE] };
  }

  const resolved = path.resolve(bundlePath);
  if (!fs.existsSync(resolved)) {
    return { status: 1, lines: [`Not found: ${resolved}`] };
  }

  let bundle;
  try {
    bundle = fs.readFileSync(resolved, 'utf8');
  } catch (err) {
    return { status: 1, lines: [`Could not read ${resolved}: ${err.message}`] };
  }

  const found = findMarkers(bundle);

  return found.length > 0
    ? {
        status: 1,
        lines: [
          `${path.basename(resolved)} carries the retired affiliate link:`,
          ...found.map(m => `  - ${m}`),
        ],
      }
    : {
        status: 0,
        lines: [
          `${path.basename(resolved)}: none of the ${RETIRED_MARKERS.length} affiliate markers found.`,
        ],
      };
}

/** The command: prints run()'s lines to stdout or stderr, returns its status. */
function main(argv, { log = console.log, error = console.error } = {}) {
  const { status, lines } = run(argv);
  lines.forEach(line => (status === 0 ? log(line) : error(line)));
  return status;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = {
  RETIRED_MARKERS,
  findMarkers,
  main,
  run,
};
