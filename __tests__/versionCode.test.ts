import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const { version } = JSON.parse(read('package.json')) as { version: string };
const [major, minor, patch] = version.split('.').map(Number);
const base = (major * 10000 + minor * 100 + patch) * 10;

const gradle = read('android/app/build.gradle');

// The recipes are rewritemeta-shaped, so a line scan is enough to read them.
function field(block: string, key: string): string | undefined {
  return block.match(new RegExp(`^\\s*${key}: (.+)$`, 'm'))?.[1];
}

function listItems(block: string, key: string): string[] {
  const list =
    block.match(new RegExp(`^\\s*${key}:\\n((?:\\s+- .+\\n)+)`, 'm'))?.[1] ??
    '';
  return list
    .split('\n')
    .filter(Boolean)
    .map(line => line.replace(/^\s*- /, '').replace(/^'(.*)'$/, '$1'));
}

function parseRecipe(text: string) {
  const [head, tail] = text.split(/^Builds:\n/m);
  const buildsBlock = tail.split(/^AllowedAPKSigningKeys:/m)[0];
  const builds = buildsBlock
    .split(/^ {2}- versionName: /m)
    .slice(1)
    .map(entry => `  - versionName: ${entry}`);
  return {
    hasBinaries: /^Binaries:/m.test(head),
    builds: builds.map(b => ({
      versionName: field(b, '- versionName'),
      versionCode: Number(field(b, 'versionCode')),
      output: field(b, 'output'),
      binary: field(b, 'binary'),
      gradleprops: listItems(b, 'gradleprops'),
    })),
    vercodeOperation: listItems(tail, 'VercodeOperation'),
    currentVersion: field(tail, 'CurrentVersion'),
    currentVersionCode: Number(field(tail, 'CurrentVersionCode')),
  };
}

describe('versionCode scheme', () => {
  it('build.gradle carries the base for the package.json version, ending in 0', () => {
    expect(gradle).toMatch(new RegExp(`versionCode ${base}\\b`));
    expect(gradle).toContain(`versionName "${version}"`);
  });

  it('gives armeabi-v7a the next code and arm64-v8a the one after', () => {
    expect(gradle).toMatch(/\["armeabi-v7a": 1, "arm64-v8a": 2\]/);
    expect(gradle).toContain('output.versionCode.set(');
  });
});

describe.each([
  ['fdroiddata-com.keycardpal.yml', 'full'],
  ['fdroiddata-com.keycardpal.offline.yml', 'offline'],
])('%s', (file, flavor) => {
  const recipe = parseRecipe(read(file));

  it('has one build entry per ABI, armeabi-v7a first', () => {
    expect(recipe.builds.map(b => b.gradleprops)).toEqual([
      ['reactNativeArchitectures=armeabi-v7a'],
      ['reactNativeArchitectures=arm64-v8a'],
    ]);
    expect(recipe.builds.map(b => b.versionCode)).toEqual([base + 1, base + 2]);
    expect(recipe.builds.every(b => b.versionName === version)).toBe(true);
  });

  it('points each entry at its own split APK, built and published', () => {
    for (const [abi, build] of [
      ['armeabi-v7a', recipe.builds[0]],
      ['arm64-v8a', recipe.builds[1]],
    ] as const) {
      const asset = `keycard-pal-${flavor}-release-${abi}.apk`;
      expect(build.output).toBe(`build/outputs/apk/${flavor}/release/${asset}`);
      expect(build.binary).toBe(
        `https://github.com/mmlado/keycard-pal/releases/download/v%v/${asset}`,
      );
    }
    expect(recipe.hasBinaries).toBe(false);
  });

  it('derives the codes from the base and reports the arm64-v8a one as current', () => {
    expect(recipe.vercodeOperation).toEqual(['%c + 1', '%c + 2']);
    expect(recipe.currentVersion).toBe(version);
    expect(recipe.currentVersionCode).toBe(base + 2);
  });
});
