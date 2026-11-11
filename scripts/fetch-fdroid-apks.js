#!/usr/bin/env node
// Downloads the APKs the self-hosted F-Droid repository is built from, each
// checked against the size and SHA-256 digest GitHub records for it.
//
//   node scripts/fetch-fdroid-apks.js --dir fdroid/repo
//   node scripts/fetch-fdroid-apks.js --dry-run

const crypto = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_RELEASES = 3;
const ARCHIVE_BUDGET_BYTES = 800 * 1024 * 1024;
const DOWNLOAD_ATTEMPTS = 3;
// No universal APK: it holds these same two ABIs, so the F-Droid client never needs it.
const ABIS = ['arm64-v8a', 'armeabi-v7a'];
// fdroid/config.yml's archive_older is REPO_RELEASES times this: it counts APKs per application id.
const APKS_PER_RELEASE = ABIS.length;
const APK_NAMES = ['offline', 'full'].flatMap(flavor =>
  ABIS.map(abi => `keycard-pal-${flavor}-release-${abi}.apk`),
);
const RELEASE_FIELDS =
  '.[] | {tag: .tag_name, draft, prerelease, assets: [.assets[] | {name, size, digest}]}';

function parseVersion(tag) {
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(String(tag));
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(a, b) {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function apkAssets(release) {
  return (release.assets || []).filter(asset => APK_NAMES.includes(asset.name));
}

function missingApks(release) {
  return APK_NAMES.filter(
    name => !release.assets.some(asset => asset.name === name),
  );
}

function selectReleases(
  releases,
  {
    repoReleases = REPO_RELEASES,
    archiveBudgetBytes = ARCHIVE_BUDGET_BYTES,
  } = {},
) {
  const published = releases
    .filter(r => !r.draft && !r.prerelease && parseVersion(r.tag))
    .map(r => {
      const assets = apkAssets(r);
      const bytes = assets.reduce((sum, asset) => sum + asset.size, 0);
      return { tag: r.tag, bytes, assets };
    })
    .sort((a, b) => compareVersions(parseVersion(b.tag), parseVersion(a.tag)));
  const withApks = published.filter(r => r.assets.length > 0);
  // A release without every split would leave an application id short of releases in repo/.
  const candidates = withApks.filter(r => r.assets.length === APK_NAMES.length);
  const incomplete = withApks.filter(r => r.assets.length < APK_NAMES.length);
  const repo = candidates.slice(0, repoReleases);
  const archive = [];
  let archivedBytes = 0;
  // Stops at the first release that does not fit, so the archive has no gaps.
  for (const release of candidates.slice(repoReleases)) {
    if (archivedBytes + release.bytes > archiveBudgetBytes) {
      break;
    }
    archivedBytes += release.bytes;
    archive.push(release);
  }
  return {
    newest: published[0] || null,
    repo,
    archive,
    left: candidates.slice(repo.length + archive.length),
    incomplete,
    archivedBytes,
  };
}

function parseReleaseLines(text) {
  return String(text)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function repoArgs() {
  return process.env.GITHUB_REPOSITORY
    ? ['-R', process.env.GITHUB_REPOSITORY]
    : [];
}

function fetchReleaseLines() {
  const repo = process.env.GITHUB_REPOSITORY || '{owner}/{repo}';
  return execFileSync(
    'gh',
    [
      'api',
      '--paginate',
      `repos/${repo}/releases?per_page=100`,
      '--jq',
      RELEASE_FIELDS,
    ],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
}

function ghDownload(tag, dir) {
  execFileSync(
    'gh',
    [
      'release',
      'download',
      tag,
      ...repoArgs(),
      ...APK_NAMES.flatMap(name => ['--pattern', name]),
      '--dir',
      dir,
    ],
    { stdio: 'inherit' },
  );
}

function assetProblem(dir, asset) {
  const file = path.join(dir, asset.name);
  if (!fs.existsSync(file)) {
    return `${asset.name} is missing`;
  }
  const size = fs.statSync(file).size;
  if (size !== asset.size) {
    return `${asset.name} is ${size} bytes, not ${asset.size}`;
  }
  const digest = /^sha256:([0-9a-f]{64})$/.exec(asset.digest || '');
  if (!digest) {
    return `${asset.name} has no SHA-256 digest on GitHub`;
  }
  const actual = crypto
    .createHash('sha256')
    .update(fs.readFileSync(file))
    .digest('hex');
  return actual === digest[1]
    ? null
    : `${asset.name} does not match its digest`;
}

function fetchRelease(
  release,
  dest,
  {
    download = ghDownload,
    attempts = DOWNLOAD_ATTEMPTS,
    log = console.error,
  } = {},
) {
  // Beside dest, so the APKs are renamed within one file system.
  const work = path.join(
    path.dirname(path.resolve(dest)),
    `.fdroid-download-${release.tag}`,
  );
  try {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      fs.rmSync(work, { recursive: true, force: true });
      fs.mkdirSync(work, { recursive: true });
      try {
        download(release.tag, work);
      } catch (err) {
        log(`${release.tag}: gh release download failed: ${err.message}`);
      }
      // gh can exit 0 after a dropped connection, with an asset cut short.
      const problems = release.assets
        .map(asset => assetProblem(work, asset))
        .filter(Boolean);
      if (problems.length === 0) {
        // Asset names repeat across releases, so the tag keeps each file apart.
        for (const asset of release.assets) {
          fs.renameSync(
            path.join(work, asset.name),
            path.join(
              dest,
              `${path.basename(asset.name, '.apk')}-${release.tag}.apk`,
            ),
          );
        }
        return;
      }
      log(
        `${release.tag}, attempt ${attempt} of ${attempts}: ${problems.join(
          '; ',
        )}`,
      );
    }
    throw new Error(
      `${release.tag}: the APKs did not match GitHub after ${attempts} attempts`,
    );
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

function mib(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dir') {
      args.dir = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--dry-run') {
      args.dryRun = true;
    }
  }
  return args;
}

function main(
  argv,
  {
    fetch = fetchReleaseLines,
    download = ghDownload,
    out = console.log,
    log = console.error,
  } = {},
) {
  const { dir, dryRun } = parseArgs(argv);
  if (!dir && !dryRun) {
    log('Usage: fetch-fdroid-apks.js --dir <folder> | --dry-run');
    return 2;
  }
  // APKs left from an earlier run would end up in the repository outside the plan.
  if (
    !dryRun &&
    fs.existsSync(dir) &&
    fs.readdirSync(dir).some(name => name.endsWith('.apk'))
  ) {
    log(`${dir} already holds APKs; fetch into an empty folder.`);
    return 1;
  }
  const plan = selectReleases(parseReleaseLines(fetch()));
  if (!plan.newest) {
    log('No published release.');
    return 1;
  }
  // The repository must carry the newest release, so it is never skipped.
  const missing = missingApks(plan.newest);
  if (missing.length > 0) {
    log(
      `${plan.newest.tag} is the newest release and lacks ${missing.join(
        ', ',
      )}.`,
    );
    return 1;
  }
  plan.incomplete.forEach(r =>
    log(`skipped  ${r.tag}  lacks ${missingApks(r).join(', ')}`),
  );
  plan.repo.forEach(r => log(`repo     ${r.tag}  ${mib(r.bytes)}`));
  plan.archive.forEach(r => log(`archive  ${r.tag}  ${mib(r.bytes)}`));
  plan.left.forEach(r => log(`left out ${r.tag}  ${mib(r.bytes)}`));
  log(
    `archive holds ${mib(plan.archivedBytes)} of ${mib(ARCHIVE_BUDGET_BYTES)}`,
  );
  const kept = [...plan.repo, ...plan.archive];
  if (dryRun) {
    kept.forEach(r => out(r.tag));
    return 0;
  }
  fs.mkdirSync(dir, { recursive: true });
  try {
    kept.forEach(r => fetchRelease(r, dir, { download, log }));
  } catch (err) {
    log(err.message);
    return 1;
  }
  const count = kept.reduce((sum, r) => sum + r.assets.length, 0);
  log(`fetched ${count} APKs from ${kept.length} releases into ${dir}`);
  return 0;
}

module.exports = {
  ABIS,
  APK_NAMES,
  APKS_PER_RELEASE,
  ARCHIVE_BUDGET_BYTES,
  DOWNLOAD_ATTEMPTS,
  REPO_RELEASES,
  apkAssets,
  assetProblem,
  fetchRelease,
  main,
  parseArgs,
  parseReleaseLines,
  parseVersion,
  selectReleases,
};

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
