import { KEYCARD_CA_PUBLIC_KEY } from '../src/constants/keycard';
import {
  isUnknownCaError,
  TRUSTED_CA_PUBLIC_KEYS,
} from '../src/utils/cardTrust';

describe('TRUSTED_CA_PUBLIC_KEYS', () => {
  // One CA, the same one keycard-shell ships. A development card signed by
  // anything else is meant to fail the check and go through the override.
  it('is exactly the Keycard CA', () => {
    expect(TRUSTED_CA_PUBLIC_KEYS).toEqual([KEYCARD_CA_PUBLIC_KEY]);
  });

  it('is a compressed secp256k1 key', () => {
    expect(KEYCARD_CA_PUBLIC_KEY).toHaveLength(33);
    expect([0x02, 0x03]).toContain(KEYCARD_CA_PUBLIC_KEY[0]);
  });
});

describe('isUnknownCaError', () => {
  // The literal keycard-sdk 4.0.0 throws from setCardCertificate, inside
  // select(). It belongs to upstream: if this test has to change, check the
  // installed SDK first, because a mismatch leaves no way to approve a card.
  const SDK_MESSAGE =
    'Card certificate verification failed: unknown CA public key and card not whitelisted';

  it('recognises the SDK message', () => {
    expect(isUnknownCaError(new Error(SDK_MESSAGE))).toBe(true);
  });

  it('recognises it on any object with that message, whatever its class', () => {
    expect(isUnknownCaError({ message: SDK_MESSAGE, sw: 0 })).toBe(true);
  });

  it('matches the literal the installed SDK really contains', () => {
    const source = require('fs').readFileSync(
      require.resolve('keycard-sdk/dist/secure-channel-v2.js'),
      'utf8',
    );
    expect(source).toContain(SDK_MESSAGE);
  });

  // The handshake failing is a different thing entirely: the card could not
  // prove it holds the key. That must never offer an "approve anyway".
  it.each([
    'Card authentication failed: invalid signature',
    'OPEN SECURE CHANNEL failed',
    'SELECT failed: 0x6985',
    'CardIO Error: Error: Tag was lost.',
    '',
  ])('does not match %p', message => {
    expect(isUnknownCaError(new Error(message))).toBe(false);
  });

  it.each([null, undefined, 'unknown CA public key', 42, {}, { message: 7 }])(
    'is false for %p',
    value => {
      expect(isUnknownCaError(value)).toBe(false);
    },
  );
});
