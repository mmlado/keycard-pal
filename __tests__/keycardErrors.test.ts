import {
  APDUException,
  WrongPINException,
} from 'keycard-sdk/dist/apdu-exception';

import {
  CARD_NOT_GENUINE_STATUS,
  cardErrorMessage,
  CONNECTION_NOT_PROTECTED_STATUS,
  isTagLostError,
  NO_CERTIFICATE_STATUS,
  selectFailureMessage,
} from '../src/utils/keycardErrors';

describe('isTagLostError', () => {
  describe('tag-lost messages (true)', () => {
    it.each([
      // Real Android wire shape: PromiseImpl sets name to the Java class, so the
      // CardIOError wrapper stringifies the class name into the message.
      'CardIO Error: android.nfc.TagLostException: Tag was lost.',
      'CardIO Error: Error: Tag was lost.',
      'Tag was lost.',
      'Tag disconnected',
      'CardIO Error: Error: NFCError:100',
      'NFCError:100',
      'NFCError:101',
      'NFCError:102',
      'APDU response must be at least 2 bytes',
    ])('%s', message => {
      expect(isTagLostError(new Error(message))).toBe(true);
    });

    it('accepts the inert forward-compat code arm', () => {
      expect(isTagLostError({ code: 'E_KEYCARD_TAG_LOST' })).toBe(true);
    });

    it('accepts the inert forward-compat name arm', () => {
      expect(isTagLostError({ name: 'NFCDisconnectedError' })).toBe(true);
    });
  });

  describe('non-tag-lost errors (false) — each is a regression guard', () => {
    it.each([
      // R18: excluded codes must not match the 100/101/102 alternation.
      'NFCError:103',
      'NFCError:104',
      'NFCError:202',
      // \b guard: a longer code must not prefix-match an included one.
      'NFCError:1002',
      // Malformed OUTBOUND apdu — programmer error, not tag loss.
      'Malformed card response',
      // Cause-erasing constants that fire for every apdu error.
      'CardIO Error: Error: Invalid APDUResponse',
      'CardIO Error: Error: Error sending command',
      'Card is locked. Use Unblock Card option.',
    ])('%s', message => {
      expect(isTagLostError(new Error(message))).toBe(false);
    });

    it('rejects APDU exceptions', () => {
      expect(
        isTagLostError(new APDUException('Pairing failed on step 1')),
      ).toBe(false);
      expect(isTagLostError(new WrongPINException(2))).toBe(false);
    });

    it.each([[null], [undefined], ['string'], [42]])(
      'rejects non-object %p',
      value => {
        expect(isTagLostError(value)).toBe(false);
      },
    );
  });
});

describe('cardErrorMessage', () => {
  // keycard-sdk 4.0.0's own words. If one of these has to change, check the
  // installed SDK first.
  const SDK_LITERALS = [
    'Card authentication failed: invalid signature',
    'OPEN SECURE CHANNEL failed',
    'Invalid handshake response: too short',
  ];

  it.each(SDK_LITERALS)('the installed SDK still says %p', literal => {
    const source = require('fs').readFileSync(
      require.resolve('keycard-sdk/dist/secure-channel-v2.js'),
      'utf8',
    );
    expect(source).toContain(literal);
  });

  it.each(SDK_LITERALS)('%p is never taken for a lost tag', literal => {
    expect(isTagLostError(new APDUException(literal))).toBe(false);
  });

  it('puts a card that failed the handshake signature in plain words', () => {
    expect(
      cardErrorMessage(
        new APDUException('Card authentication failed: invalid signature'),
      ),
    ).toBe(CARD_NOT_GENUINE_STATUS);
  });

  it('puts a refused handshake in plain words, status word or not', () => {
    expect(
      cardErrorMessage(new APDUException('OPEN SECURE CHANNEL failed', 0x6982)),
    ).toBe(CONNECTION_NOT_PROTECTED_STATUS);
    expect(
      cardErrorMessage(
        new APDUException('Invalid handshake response: too short'),
      ),
    ).toBe(CONNECTION_NOT_PROTECTED_STATUS);
  });

  it('leaves every other message as it is', () => {
    expect(cardErrorMessage(new Error('Card is locked.'))).toBe(
      'Card is locked.',
    );
    expect(cardErrorMessage('plain string')).toBe('plain string');
  });
});

describe('selectFailureMessage', () => {
  it('explains the refusal of a card with no certificate', () => {
    expect(selectFailureMessage(0x6985)).toBe(NO_CERTIFICATE_STATUS);
  });

  it('keeps the status word for anything else', () => {
    expect(selectFailureMessage(0x6a82)).toBe('SELECT failed: 0x6A82');
  });
});
