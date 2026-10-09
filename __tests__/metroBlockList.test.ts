/**
 * Metro must never crawl Gradle output. Without watchman it fs.watch()es
 * every directory it crawls, and a directory that Gradle deletes and
 * recreates mid-build (codegen under node_modules/<pkg>/android/build) took
 * the whole bundler down with an uncaught ENOENT. The blockList is what keeps
 * those directories out of the crawl, so this holds it to the paths that
 * matter and proves it blocks nothing the bundle actually needs.
 */

const config = require('../metro.config');

const blockList: RegExp[] = config.resolver.blockList;

function blocked(absolutePath: string): boolean {
  return blockList.some(pattern => pattern.test(absolutePath));
}

describe('metro blockList', () => {
  const root = '/home/someone/keycard-pal';

  it('is a list, so the default exclusion survives alongside ours', () => {
    expect(Array.isArray(blockList)).toBe(true);
    expect(blocked(`${root}/src/__tests__/anything.ts`)).toBe(true);
  });

  it.each([
    // The directory that crashed Metro: codegen for a hand-linked native module.
    `${root}/node_modules/@walletconnect/react-native-compat/android/build/generated/source/codegen/java/com/walletconnect/Foo.java`,
    `${root}/node_modules/react-native-screens/android/build/intermediates/x`,
    `${root}/android/app/build/generated/assets/index.android.bundle`,
    `${root}/android/build/reports/problems/problems-report.html`,
  ])('blocks Gradle output: %s', file => {
    expect(blocked(file)).toBe(true);
  });

  it.each([
    `${root}/src/App.tsx`,
    `${root}/src/constants/purchaseLink.ios.ts`,
    `${root}/node_modules/react-native-svg/src/index.js`,
    `${root}/node_modules/@walletconnect/react-native-compat/index.js`,
    // A native module's Android *sources* are not its build output.
    `${root}/node_modules/react-native-keycard/android/src/main/java/com/keycard/KeycardModule.kt`,
    // The per-variant Metro env script lives in the root build/, not android/build/.
    `${root}/build/metro-env-fullRelease.js`,
  ])('leaves alone: %s', file => {
    expect(blocked(file)).toBe(false);
  });
});
