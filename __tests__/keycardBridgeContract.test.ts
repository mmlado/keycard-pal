import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Asserts the INSTALLED react-native-keycard artifact carries the tag-loss
 * wire contract Pal's classification depends on (ADR-0006, ADR-0008).
 *
 * This exists because the installed tree drifted from the lockfile once and
 * invalidated design work: lib/ is gitignored upstream and rebuilt by
 * `prepare` at install time, so neither the lockfile SHA nor the checked-out
 * sources prove what actually ships. These tests read node_modules directly —
 * the one place that matters — and turn silent drift into a red build.
 *
 * If a bump legitimately changes these markers, the tag-loss contract changed:
 * update isTagLostError and its ADR in the same commit, not just this test.
 */

const bridgeRoot = join(
  __dirname,
  '..',
  'node_modules',
  'react-native-keycard',
);

function read(rel: string): string {
  return readFileSync(join(bridgeRoot, rel), 'utf8');
}

describe('installed react-native-keycard carries the tag-loss contract', () => {
  it('android channel guards the nulled IsoDep instead of NPE-ing', () => {
    const channel = read('android/src/main/java/com/keycard/NFCCardChannel.kt');
    expect(channel).toContain('TagLostException(TAG_LOST)');
    expect(channel).not.toContain('isoDep!!.transceive');
  });

  it('android module rejects tag loss so the message reaches JS', () => {
    const module = read('android/src/main/java/com/keycard/KeycardModule.kt');
    expect(module).toContain('catch(e: TagLostException)');
    expect(module).toContain('promise.reject(e)');
  });

  it('ios classifies transceive errors and reports them as NFCError:<code>', () => {
    const swift = read('ios/Keycard.swift');
    expect(swift).toContain('tagLostCodes');
    expect(swift).toContain('"message": "NFCError:\\(code)"');
  });

  it('ios rejects with the classification message when present', () => {
    const mm = read('ios/Keycard.mm');
    expect(mm).toContain('objectForKey:@"message"');
  });

  // useNFCSession calls stopNFCWithMessage unguarded. A pin that predates the
  // method turns every completed operation into a thrown TypeError inside
  // handleCardConnected's try, surfacing as a bogus operation error — so the
  // installed artifact has to prove the method is there, on both platforms.
  it('installed bridge carries stopNFCWithMessage on both platforms', () => {
    expect(read('src/NativeKeycard.ts')).toContain('stopNFCWithMessage');
    expect(read('lib/typescript/src/NativeKeycard.d.ts')).toContain(
      'stopNFCWithMessage',
    );
    expect(read('ios/Keycard.mm')).toContain('stopNFCWithSuccessMessage:');
    expect(
      read('android/src/main/java/com/keycard/KeycardModule.kt'),
    ).toContain('override fun stopNFCWithMessage');
  });

  it('built lib wraps APDUResponse construction inside the try', () => {
    // The BUILT artifact, not src/: Metro bundles lib/module, and lib/ is what
    // went stale before. The construction must sit between the state check and
    // the CardIOError wrap so a short payload arrives wrapped, not bare.
    const lib = read('lib/module/CardChannel.js');
    const tryPos = lib.indexOf('Error sending command');
    const ctorPos = lib.indexOf('new APDUResponse');
    const wrapPos = lib.indexOf('CardIOError');
    expect(tryPos).toBeGreaterThan(-1);
    expect(ctorPos).toBeGreaterThan(tryPos);
    expect(wrapPos).toBeGreaterThan(-1);
  });
});
