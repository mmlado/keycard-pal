#!/usr/bin/env node
// Fails unless an F-Droid index-v2.json carries the given release for every
// package it is expected to serve.
//
//   node scripts/check-fdroid-index.js --index fdroid/repo/index-v2.json --tag v1.13.0

const fs = require('fs');

const DEFAULT_PACKAGES = ['com.keycardpal', 'com.keycardpal.offline'];

function versionNameFromTag(tag) {
  return String(tag).replace(/^v/, '');
}

// A package absent from the index counts as missing: the one failure this guards
// against is an index built from the wrong APKs, which may leave a package out.
function missingPackages(index, versionName, packages = DEFAULT_PACKAGES) {
  const present = index.packages || {};
  return packages.filter(
    id =>
      !Object.values((present[id] && present[id].versions) || {}).some(
        v => v.manifest && v.manifest.versionName === versionName,
      ),
  );
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--index') {
      args.index = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--tag') {
      args.tag = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--packages') {
      args.packages = argv[i + 1].split(',').filter(Boolean);
      i += 1;
    }
  }
  return args;
}

function main(argv) {
  const { index, tag, packages = DEFAULT_PACKAGES } = parseArgs(argv);
  if (!index || !tag) {
    console.error(
      'Usage: check-fdroid-index.js --index <index-v2.json> --tag <release tag> [--packages a,b]',
    );
    return 2;
  }
  const parsed = JSON.parse(fs.readFileSync(index, 'utf8'));
  const versionName = versionNameFromTag(tag);
  const missing = missingPackages(parsed, versionName, packages);
  if (missing.length > 0) {
    console.error(
      `${versionName} is missing from ${index} for: ${missing.join(', ')}`,
    );
    return 1;
  }
  console.log(`${index} carries ${versionName} for ${packages.join(', ')}`);
  return 0;
}

module.exports = {
  DEFAULT_PACKAGES,
  main,
  missingPackages,
  parseArgs,
  versionNameFromTag,
};

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
