#!/usr/bin/env node
// Usage: node scripts/check-ios-bundle.js --bundle <path>
//
// The iOS build must not carry the affiliate parameter or the Advertisement
// wording. Reading the source cannot prove that: a Platform.OS branch ships
// both sides, and the file that looks correct is not the artifact that ships.
// Metro resolves constants/purchaseLink.ios.ts for this platform, so the
// literals below should be absent from the bundle entirely. This is the check
// that says so about the bytes.
//
// The markers are read out of constants/purchaseLink.ts rather than written
// down here. The referral code is Status's to change, and a check holding a
// stale copy of it would go green while the new code shipped: the one thing
// this must never do. Anything it cannot read, it fails on.
//
// Same shape as check-offline-bundle.js, deliberately: run() returns
// { status, lines } so the logic is testable without a child process.

const fs = require('fs');
const path = require('path');

const PURCHASE_LINK_SOURCE = path.join(
  __dirname,
  '..',
  'src',
  'constants',
  'purchaseLink.ts',
);

/** Reads `export const NAME = '...'` out of the source, newlines and all. */
function literal(source, name) {
  const match = new RegExp(
    `\\b${name}\\b\\s*(?::[^=]+)?=\\s*'([^']*)'`,
  ).exec(source);
  return match ? match[1] : null;
}

/**
 * Every string that identifies the paid placement: the URL, the host it sits
 * on, the referral code that earns the commission, and both forms of the
 * label that has to accompany it. None of them belongs in an iOS bundle.
 */
function markersFrom(source) {
  const url = literal(source, 'KEYCARD_PURCHASE_URL');
  if (!url) {
    throw new Error(
      'could not read KEYCARD_PURCHASE_URL from src/constants/purchaseLink.ts',
    );
  }

  const { host, pathname } = new URL(url);
  const referralCode = pathname.split('/').filter(Boolean).pop();
  if (!referralCode) {
    throw new Error(`no referral code in the affiliate URL: ${url}`);
  }

  // The bare word as well as both exact strings: a relabelled disclosure,
  // "Advertisement: sponsored link", matches neither of them.
  const markers = [url, host, referralCode, 'Advertisement'];

  for (const name of ['AFFILIATE_DISCLOSURE', 'AFFILIATE_DISCLOSURE_SHORT']) {
    const copy = literal(source, name);
    if (!copy) {
      throw new Error(
        `could not read ${name} from src/constants/purchaseLink.ts`,
      );
    }
    markers.push(copy);
  }

  return markers;
}

function findMarkers(bundle, markers) {
  return markers.filter(marker => bundle.includes(marker));
}

const USAGE = 'Usage: check-ios-bundle.js --bundle <path>';

function argValue(argv, flag) {
  const idx = argv.indexOf(flag);
  return idx === -1 ? null : argv[idx + 1];
}

function run(argv, sourcePath = PURCHASE_LINK_SOURCE) {
  const bundlePath = argValue(argv, '--bundle');
  if (!bundlePath) {
    return { status: 1, lines: [USAGE] };
  }

  const resolved = path.resolve(bundlePath);
  if (!fs.existsSync(resolved)) {
    return { status: 1, lines: [`Not found: ${resolved}`] };
  }

  let markers;
  try {
    markers = markersFrom(fs.readFileSync(sourcePath, 'utf8'));
  } catch (err) {
    return {
      status: 1,
      lines: [
        `Could not work out what to look for: ${err.message}`,
        'Refusing to pass: a check that has lost its markers checks nothing.',
      ],
    };
  }

  let bundle;
  try {
    bundle = fs.readFileSync(resolved, 'utf8');
  } catch (err) {
    return { status: 1, lines: [`Could not read ${resolved}: ${err.message}`] };
  }

  const found = findMarkers(bundle, markers);

  return found.length > 0
    ? {
        status: 1,
        lines: [
          'iOS bundle contains affiliate markers, which must not ship on iOS:',
          ...found.map(m => `  - ${m}`),
          '',
          'The purchase pointer is platform-split: see src/constants/purchaseLink.ios.ts.',
          'A Platform.OS branch will not do it, because both sides end up in the bundle.',
        ],
      }
    : {
        status: 0,
        lines: [
          `iOS bundle check passed: none of the ${markers.length} affiliate markers found.`,
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
  PURCHASE_LINK_SOURCE,
  findMarkers,
  literal,
  main,
  markersFrom,
  run,
};
