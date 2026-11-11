const { Buffer } = require('buffer');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  APK_ASSET,
  APKS_PER_RELEASE,
  ARCHIVE_BUDGET_BYTES,
  DOWNLOAD_ATTEMPTS,
  REPO_RELEASES,
  apkAssets,
  fetchRelease,
  main,
  parseReleaseLines,
  parseVersion,
  selectReleases,
} = require('../scripts/fetch-fdroid-apks');

const ROOT = path.join(__dirname, '..');
const MIB = 1024 * 1024;
const WORKFLOWS = [
  '.github/workflows/publish-pages.yml',
  '.github/workflows/android-release.yml',
];
const APK_NAMES = [
  'keycard-pal-full-release-universal.apk',
  'keycard-pal-full-release-arm64-v8a.apk',
  'keycard-pal-full-release-armeabi-v7a.apk',
  'keycard-pal-offline-release-universal.apk',
  'keycard-pal-offline-release-arm64-v8a.apk',
  'keycard-pal-offline-release-armeabi-v7a.apk',
];

const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const tags = releases => releases.map(r => r.tag);
const digest = data =>
  `sha256:${crypto.createHash('sha256').update(data).digest('hex')}`;
const contents = (tag, name) => Buffer.from(`${tag} ${name}`);

function release(tag, totalMib, extra = {}) {
  return {
    tag,
    draft: false,
    prerelease: false,
    assets: APK_NAMES.map((name, i) => ({
      name,
      size: i === 0 ? totalMib * MIB - (APK_NAMES.length - 1) : 1,
    })),
    ...extra,
  };
}

function smallRelease(tag) {
  return {
    tag,
    draft: false,
    prerelease: false,
    assets: APK_NAMES.map(name => ({
      name,
      size: contents(tag, name).length,
      digest: digest(contents(tag, name)),
    })),
  };
}

const writeRelease = (tag, dir) =>
  APK_NAMES.forEach(name =>
    fs.writeFileSync(path.join(dir, name), contents(tag, name)),
  );

const selected = tag => selectReleases([smallRelease(tag)]).repo[0];

let tmp;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fdroid-apks-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const destIn = () => {
  const dest = path.join(tmp, 'repo');
  fs.mkdirSync(dest);
  return dest;
};

describe('selectReleases', () => {
  it('keeps the three newest releases by version, whatever order they come in', () => {
    const plan = selectReleases([
      release('v1.9.3', 200),
      release('v1.10.0', 200),
      release('v1.17.0', 200),
      release('v1.16.0', 200),
    ]);
    expect(tags(plan.repo)).toEqual(['v1.17.0', 'v1.16.0', 'v1.10.0']);
    expect(tags(plan.archive)).toEqual(['v1.9.3']);
  });

  it('archives older releases newest first, up to a budget filled exactly', () => {
    const plan = selectReleases([
      release('v1.8.0', 300),
      release('v1.7.0', 300),
      release('v1.6.0', 300),
      release('v1.5.0', 200),
      release('v1.4.0', 200),
      release('v1.3.0', 200),
      release('v1.2.0', 200),
      release('v1.1.0', 1),
    ]);
    expect(tags(plan.archive)).toEqual([
      'v1.5.0',
      'v1.4.0',
      'v1.3.0',
      'v1.2.0',
    ]);
    expect(plan.archivedBytes).toBe(ARCHIVE_BUDGET_BYTES);
    expect(tags(plan.left)).toEqual(['v1.1.0']);
  });

  it('stops at the first release that does not fit, so the archive has no gaps', () => {
    const plan = selectReleases([
      release('v1.8.0', 100),
      release('v1.7.0', 100),
      release('v1.6.0', 100),
      release('v1.5.0', 700),
      release('v1.4.0', 200),
      release('v1.3.0', 10),
    ]);
    expect(tags(plan.archive)).toEqual(['v1.5.0']);
    expect(tags(plan.left)).toEqual(['v1.4.0', 'v1.3.0']);
  });

  it('keeps the three newest whatever their size', () => {
    const plan = selectReleases([
      release('v3.0.0', 900),
      release('v2.0.0', 900),
      release('v1.0.0', 900),
      release('v0.9.0', 900),
    ]);
    expect(tags(plan.repo)).toEqual(['v3.0.0', 'v2.0.0', 'v1.0.0']);
    expect(plan.archive).toEqual([]);
    expect(tags(plan.left)).toEqual(['v0.9.0']);
  });

  it('puts every release in the repository when there are fewer than three', () => {
    const plan = selectReleases([release('v1.0.0', 10), release('v1.1.0', 10)]);
    expect(tags(plan.repo)).toEqual(['v1.1.0', 'v1.0.0']);
    expect(plan.archive).toEqual([]);
  });

  it('leaves out drafts, pre-releases, non-version tags and releases without APKs', () => {
    const plan = selectReleases([
      release('v2.0.0', 10, { draft: true }),
      release('v1.99.0', 10, { prerelease: true }),
      release('nightly', 10),
      {
        tag: 'v1.98.0',
        draft: false,
        prerelease: false,
        assets: [
          { name: 'SHA256SUMS.txt', size: 500 },
          { name: 'app-full-release.aab', size: 50 * MIB },
        ],
      },
      { tag: 'v0.1.0', draft: false, prerelease: false, assets: [] },
      release('v1.17.0', 10),
    ]);
    expect(tags(plan.repo)).toEqual(['v1.17.0']);
    expect(plan.archive).toEqual([]);
    expect(plan.left).toEqual([]);
  });

  it('counts only the APKs the repository is built from', () => {
    const r = release('v1.0.0', 10);
    r.assets.push({ name: 'SHA256SUMS.txt', size: 1000 });
    r.assets.push({ name: 'keycard-pal-full-release.aab', size: 1000 });
    expect(selectReleases([r]).repo[0].bytes).toBe(10 * MIB);
    expect(apkAssets(r)).toHaveLength(APK_NAMES.length);
  });
});

describe('APK_ASSET', () => {
  it('matches the release APKs of both flavors and nothing else', () => {
    APK_NAMES.forEach(name => expect(APK_ASSET.test(name)).toBe(true));
    [
      'SHA256SUMS.txt',
      'keycard-pal-full-release.aab',
      'keycard-pal-full-debug-universal.apk',
      'keycard-pal-full-release-universal.apk.idsig',
      'keycard-pal-full-releaseXuniversal.apk',
    ].forEach(name => expect(APK_ASSET.test(name)).toBe(false));
  });
});

describe('parseVersion', () => {
  it('reads vMAJOR.MINOR.PATCH and nothing else', () => {
    expect(parseVersion('v1.10.0')).toEqual([1, 10, 0]);
    expect(parseVersion('1.10.0')).toBeNull();
    expect(parseVersion('v1.10.0-rc1')).toBeNull();
  });
});

describe('parseReleaseLines', () => {
  it('reads one release per line across pages and skips blank lines', () => {
    const text = `${JSON.stringify({ tag: 'v1.0.0' })}\n\n${JSON.stringify({
      tag: 'v0.9.0',
    })}\n`;
    expect(tags(parseReleaseLines(text))).toEqual(['v1.0.0', 'v0.9.0']);
  });
});

describe('fetchRelease', () => {
  it('stores every APK as <asset>-<tag>.apk once size and digest match', () => {
    const dest = destIn();
    fetchRelease(selected('v1.2.0'), dest, {
      download: writeRelease,
      log: () => {},
    });
    expect(fs.readdirSync(dest).sort()).toEqual(
      APK_NAMES.map(n => n.replace(/\.apk$/, '-v1.2.0.apk')).sort(),
    );
    expect(
      fs.readFileSync(
        path.join(dest, 'keycard-pal-offline-release-arm64-v8a-v1.2.0.apk'),
      ),
    ).toEqual(contents('v1.2.0', 'keycard-pal-offline-release-arm64-v8a.apk'));
    expect(fs.readdirSync(tmp)).toEqual(['repo']);
  });

  it('downloads a release again when gh leaves an APK cut short', () => {
    const dest = destIn();
    const log = [];
    let calls = 0;
    fetchRelease(selected('v1.2.0'), dest, {
      download: (tag, dir) => {
        calls += 1;
        writeRelease(tag, dir);
        if (calls === 1) {
          fs.truncateSync(path.join(dir, APK_NAMES[3]), 4);
        }
      },
      log: line => log.push(line),
    });
    expect(calls).toBe(2);
    expect(fs.readdirSync(dest)).toHaveLength(APK_NAMES.length);
    expect(log.join('\n')).toMatch(
      /v1\.2\.0, attempt 1 of 3: keycard-pal-offline-release-universal\.apk is 4 bytes, not \d+/,
    );
  });

  it('treats a failing gh download as a failed attempt', () => {
    const dest = destIn();
    const log = [];
    let calls = 0;
    fetchRelease(selected('v1.2.0'), dest, {
      download: (tag, dir) => {
        calls += 1;
        if (calls === 1) {
          throw new Error('connection reset by peer');
        }
        writeRelease(tag, dir);
      },
      log: line => log.push(line),
    });
    expect(calls).toBe(2);
    expect(log[0]).toContain('connection reset by peer');
    expect(fs.readdirSync(dest)).toHaveLength(APK_NAMES.length);
  });

  it('gives up after the last attempt and stores nothing', () => {
    const dest = destIn();
    let calls = 0;
    const corrupt = (tag, dir) => {
      calls += 1;
      writeRelease(tag, dir);
      const file = path.join(dir, APK_NAMES[0]);
      const data = fs.readFileSync(file);
      data[0] = data[0] === 0x41 ? 0x42 : 0x41;
      fs.writeFileSync(file, data);
    };
    expect(() =>
      fetchRelease(selected('v1.2.0'), dest, {
        download: corrupt,
        log: () => {},
      }),
    ).toThrow('v1.2.0: the APKs did not match GitHub after 3 attempts');
    expect(calls).toBe(DOWNLOAD_ATTEMPTS);
    expect(fs.readdirSync(dest)).toEqual([]);
    expect(fs.readdirSync(tmp)).toEqual(['repo']);
  });

  it('refuses an APK that is missing or that GitHub records no digest for', () => {
    const dest = destIn();
    const log = [];
    const r = selected('v1.2.0');
    r.assets[1] = { ...r.assets[1], digest: null };
    expect(() =>
      fetchRelease(r, dest, {
        download: (tag, dir) => {
          writeRelease(tag, dir);
          fs.rmSync(path.join(dir, APK_NAMES[2]));
        },
        attempts: 1,
        log: line => log.push(line),
      }),
    ).toThrow();
    expect(log[0]).toContain(`${APK_NAMES[1]} has no SHA-256 digest on GitHub`);
    expect(log[0]).toContain(`${APK_NAMES[2]} is missing`);
  });
});

describe('main', () => {
  const lines = releases => releases.map(r => JSON.stringify(r)).join('\n');
  const five = ['v1.4.0', 'v1.3.0', 'v1.2.0', 'v1.1.0', 'v1.0.0'].map(
    smallRelease,
  );

  it('with --dry-run prints the kept tags and downloads nothing', () => {
    const out = [];
    const download = jest.fn();
    const code = main(['--dry-run'], {
      fetch: () =>
        lines([
          release('v1.4.0', 200),
          release('v1.3.0', 200),
          release('v1.2.0', 200),
          release('v1.1.0', 700),
          release('v1.0.0', 200),
        ]),
      download,
      out: line => out.push(line),
      log: () => {},
    });
    expect(code).toBe(0);
    expect(out).toEqual(['v1.4.0', 'v1.3.0', 'v1.2.0', 'v1.1.0']);
    expect(download).not.toHaveBeenCalled();
  });

  it('with --dir fetches every kept release into the folder', () => {
    const dest = path.join(tmp, 'fdroid', 'repo');
    const log = [];
    const code = main(['--dir', dest], {
      fetch: () => lines(five),
      download: writeRelease,
      log: line => log.push(line),
    });
    expect(code).toBe(0);
    expect(fs.readdirSync(dest)).toHaveLength(5 * APK_NAMES.length);
    expect(log.join('\n')).toContain('fetched 30 APKs from 5 releases');
  });

  it('fails when a release cannot be fetched', () => {
    const log = [];
    const code = main(['--dir', path.join(tmp, 'repo')], {
      fetch: () => lines(five),
      download: () => {},
      log: line => log.push(line),
    });
    expect(code).toBe(1);
    expect(log[log.length - 1]).toBe(
      'v1.4.0: the APKs did not match GitHub after 3 attempts',
    );
  });

  it('fails when no release carries APKs', () => {
    const code = main(['--dry-run'], {
      fetch: () => lines([{ tag: 'v1.0.0', assets: [] }]),
      out: () => {},
      log: () => {},
    });
    expect(code).toBe(1);
  });

  it('needs --dir or --dry-run', () => {
    const fetch = jest.fn();
    expect(main([], { fetch, log: () => {} })).toBe(2);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('the repository settings around the script', () => {
  it('archive_older keeps exactly the releases the script puts in repo/', () => {
    const archiveOlder = Number(
      /^archive_older:\s*(\d+)/m.exec(read('fdroid/config.yml'))[1],
    );
    expect(archiveOlder).toBe(REPO_RELEASES * APKS_PER_RELEASE);
  });

  it('APKS_PER_RELEASE is the ABI splits plus the universal APK', () => {
    const gradle = read('android/app/build.gradle');
    const abis = /^\s*include\s+(.+)$/m.exec(gradle)[1].match(/"[^"]+"/g);
    expect(gradle).toMatch(/^\s*universalApk true$/m);
    expect(APKS_PER_RELEASE).toBe(abis.length + 1);
  });

  it.each(WORKFLOWS)(
    '%s builds the repository from the script and publishes the archive',
    workflow => {
      const yml = read(workflow);
      expect(yml).toContain(
        'node scripts/fetch-fdroid-apks.js --dir fdroid/repo',
      );
      expect(yml).not.toContain('gh release list --limit 100');
      expect(yml).toContain('cp -r fdroid/archive pages/archive');
    },
  );
});
