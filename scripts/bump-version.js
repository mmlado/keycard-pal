#!/usr/bin/env node
// Usage: node scripts/bump-version.js <major|minor|patch|x.y.z>

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Parse new version
// ---------------------------------------------------------------------------

const arg = process.argv[2];
if (!arg) {
  console.error(
    'Usage: node scripts/bump-version.js <major|minor|patch|x.y.z>',
  );
  process.exit(1);
}

const pkg = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'),
);
const [curMajor, curMinor, curPatch] = pkg.version.split('.').map(Number);

let newVersion;
if (arg === 'major') {
  newVersion = `${curMajor + 1}.0.0`;
} else if (arg === 'minor') {
  newVersion = `${curMajor}.${curMinor + 1}.0`;
} else if (arg === 'patch') {
  newVersion = `${curMajor}.${curMinor}.${curPatch + 1}`;
} else if (/^\d+\.\d+\.\d+$/.test(arg)) {
  newVersion = arg;
} else {
  console.error(`Invalid argument: ${arg}`);
  process.exit(1);
}

const [MAJOR, MINOR, PATCH] = newVersion.split('.').map(Number);
const versionCode = MAJOR * 10000 + MINOR * 100 + PATCH;
const today = new Date().toISOString().slice(0, 10);
const repo = 'https://github.com/mmlado/keycard-pal';

console.log(`Bumping ${pkg.version} → ${newVersion} (code: ${versionCode})`);

// ---------------------------------------------------------------------------
// package.json
// ---------------------------------------------------------------------------

pkg.version = newVersion;
fs.writeFileSync(
  path.join(ROOT, 'package.json'),
  JSON.stringify(pkg, null, 2) + '\n',
);

// ---------------------------------------------------------------------------
// package-lock.json
// ---------------------------------------------------------------------------

const lockPath = path.join(ROOT, 'package-lock.json');
if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  lock.version = newVersion;
  if (lock.packages && lock.packages['']) {
    lock.packages[''].version = newVersion;
  }
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// android/app/build.gradle
// ---------------------------------------------------------------------------

const gradlePath = path.join(ROOT, 'android/app/build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
gradle = gradle
  .replace(/versionCode \d+/, `versionCode ${versionCode}`)
  .replace(/versionName "[^"]*"/, `versionName "${newVersion}"`);
fs.writeFileSync(gradlePath, gradle);

// ---------------------------------------------------------------------------
// ios/KeycardPal.xcodeproj/project.pbxproj
// ---------------------------------------------------------------------------

const pbxPath = path.join(ROOT, 'ios/KeycardPal.xcodeproj/project.pbxproj');
let pbx = fs.readFileSync(pbxPath, 'utf8');
pbx = pbx
  .replace(
    /CURRENT_PROJECT_VERSION = [^;]*/g,
    `CURRENT_PROJECT_VERSION = ${versionCode}`,
  )
  .replace(/MARKETING_VERSION = [^;]*/g, `MARKETING_VERSION = ${newVersion}`);
fs.writeFileSync(pbxPath, pbx);

// ---------------------------------------------------------------------------
// CHANGELOG.md
// ---------------------------------------------------------------------------

const changelogPath = path.join(ROOT, 'CHANGELOG.md');
let changelog = fs.readFileSync(changelogPath, 'utf8');

const prevMatch = changelog.match(/## \[(\d+\.\d+\.\d+)\]/);
const prev = prevMatch ? prevMatch[1] : null;
const unreleasedMatch = changelog.match(
  /## \[Unreleased\]\n([\s\S]*?)(?=\n## \[\d+\.\d+\.\d+\])/,
);
const releaseNotes =
  unreleasedMatch?.[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
    .map(line => line.replace(/^- /, ''))
    .join(' ') || `Release ${newVersion}.`;

changelog = changelog.replace(
  /^## \[Unreleased\]\n/m,
  `## [Unreleased]\n\n## [${newVersion}] - ${today}\n`,
);

if (prev) {
  changelog = changelog.replace(
    `[Unreleased]: ${repo}/compare/v${prev}...HEAD`,
    `[Unreleased]: ${repo}/compare/v${newVersion}...HEAD\n[${newVersion}]: ${repo}/compare/v${prev}...v${newVersion}`,
  );
}

fs.writeFileSync(changelogPath, changelog);

// ---------------------------------------------------------------------------
// F-Droid metadata and Fastlane changelog
// ---------------------------------------------------------------------------

const fdroidMetadataPath = path.join(ROOT, 'fdroiddata-com.keycardpal.yml');
if (fs.existsSync(fdroidMetadataPath)) {
  let fdroidMetadata = fs.readFileSync(fdroidMetadataPath, 'utf8');
  fdroidMetadata = fdroidMetadata
    .replace(/versionName: \d+\.\d+\.\d+/, `versionName: ${newVersion}`)
    .replace(/versionCode: \d+/, `versionCode: ${versionCode}`)
    .replace(/commit: v\d+\.\d+\.\d+/, `commit: v${newVersion}`)
    .replace(/CurrentVersion: \d+\.\d+\.\d+/, `CurrentVersion: ${newVersion}`)
    .replace(/CurrentVersionCode: \d+/, `CurrentVersionCode: ${versionCode}`);
  fs.writeFileSync(fdroidMetadataPath, fdroidMetadata);
}

const fastlaneChangelogDir = path.join(
  ROOT,
  'fastlane/metadata/android/en-US/changelogs',
);
fs.mkdirSync(fastlaneChangelogDir, { recursive: true });
fs.writeFileSync(
  path.join(fastlaneChangelogDir, `${versionCode}.txt`),
  `${releaseNotes}\n`,
);

// ---------------------------------------------------------------------------
// Commit and push branch
// ---------------------------------------------------------------------------

const branch = `release/v${newVersion}`;
execSync(`git checkout -b ${branch}`, { stdio: 'inherit' });
execSync(
  'git add package.json package-lock.json android/app/build.gradle ios/KeycardPal.xcodeproj/project.pbxproj CHANGELOG.md fdroiddata-com.keycardpal.yml fastlane/metadata/android/en-US/changelogs',
  { stdio: 'inherit' },
);
execSync(`git commit -m "chore: bump version to ${newVersion}"`, {
  stdio: 'inherit',
});
execSync(`git push -u origin ${branch}`, { stdio: 'inherit' });

console.log(`\nDone. Open a PR for branch: ${branch}`);
console.log(
  `After merging, tag main:\n  git tag v${newVersion} && git push origin v${newVersion}`,
);
