import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Reads the INSTALLED react-native-keycard, not the lockfile: lib/ is rebuilt at
 * install time and has drifted before (ADR-0006, ADR-0008). If a bump changes
 * these markers, the contract changed: update isTagLostError and its ADR too.
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

  // A pin that predates this signature drops the error flag and the success wording.
  it('installed bridge stops through one stopNFC(message, isError)', () => {
    const signature = 'stopNFC(message?: string, isError?: boolean)';
    expect(read('src/NativeKeycard.ts')).toContain(signature);
    expect(read('lib/typescript/src/NativeKeycard.d.ts')).toContain(signature);
    expect(read('ios/Keycard.mm')).toContain(
      'stopNFC:(NSString *)message isError:',
    );
    expect(
      read('android/src/main/java/com/keycard/KeycardModule.kt'),
    ).toContain('override fun stopNFC(message: String?, isError: Boolean?');
  });

  // A TurboModule call must carry every argument, so a bare native stopNFC(msg) throws.
  it('built lib always sends both arguments to the native stopNFC', () => {
    expect(read('lib/module/index.js')).toContain(
      'Keycard.stopNFC(message, isError)',
    );
  });

  it('built lib wraps APDUResponse construction inside the try', () => {
    // Metro bundles lib/module, and lib/ is what went stale before.
    const lib = read('lib/module/CardChannel.js');
    const tryPos = lib.indexOf('Error sending command');
    const ctorPos = lib.indexOf('new APDUResponse');
    const wrapPos = lib.indexOf('CardIOError');
    expect(tryPos).toBeGreaterThan(-1);
    expect(ctorPos).toBeGreaterThan(tryPos);
    expect(wrapPos).toBeGreaterThan(-1);
  });
});
