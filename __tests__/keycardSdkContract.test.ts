import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Reads the INSTALLED keycard-sdk: 4.0.0 did not await the V2 handshake in `init()` and sent
 * INIT in the clear (seen on a card, 2026-09-18). Fixed upstream in 4.0.1; this goes red if a
 * bump ever lands on a build without it (ADR-0008).
 */
const commandset = readFileSync(
  join(__dirname, '..', 'node_modules', 'keycard-sdk', 'dist', 'commandset.js'),
  'utf8',
);

function initBody(): string {
  const start = commandset.indexOf('async init(');
  const end = commandset.indexOf('async factoryReset(', start);
  return commandset.slice(start, end);
}

describe('installed keycard-sdk initializes a Secure Channel V2 card safely', () => {
  it('has a V2 branch in init() at all', () => {
    expect(initBody()).toContain('instanceof SecureChannelV2');
  });

  it('waits for the handshake before it builds the INIT command', () => {
    const body = initBody();
    const handshake = body.indexOf(
      'await this.secureChannel.autoOpenSecureChannel(',
    );
    const command = body.indexOf('this.secureChannel.protectedCommand(');
    expect(handshake).toBeGreaterThan(-1);
    expect(command).toBeGreaterThan(handshake);
  });

  it('never starts that handshake without awaiting it', () => {
    const calls = initBody().match(
      /(await\s+)?this\.secureChannel\.autoOpenSecureChannel\(/g,
    );
    expect(calls).toEqual(['await this.secureChannel.autoOpenSecureChannel(']);
  });
});
