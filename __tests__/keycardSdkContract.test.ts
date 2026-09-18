import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Asserts the INSTALLED keycard-sdk carries the fix that initializing an
 * applet 4.0 card depends on.
 *
 * keycard-sdk 4.0.0 as released does not await the Secure Channel V2 handshake
 * inside `Commandset.init()`. It builds the INIT command while the channel is
 * still opening, so the new PIN and PUK leave the phone unencrypted, outside
 * any channel, and the card refuses them with 0x6985. Seen on a real card on
 * 2026-09-18. `package.json` therefore pins a fork build that awaits the
 * handshake, by commit, the way the bridge is pinned (ADR-0008).
 *
 * `dist/` is built by `prepare` at install time, so neither the lockfile SHA
 * nor the fork's sources prove what ships. This reads node_modules directly.
 * It goes red if the pin is moved back to a release without the fix, which is
 * exactly the mistake a routine "bump to ^4.0.x" would be. Once upstream has
 * released the fix, the pin can go back to a version range and this test stays
 * as it is.
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
