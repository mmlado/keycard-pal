/* eslint-disable no-bitwise */
import { readFileSync } from 'fs';
import { APDUCommand } from 'keycard-sdk/dist/apdu-command';
import { APDUResponse } from 'keycard-sdk/dist/apdu-response';
import { GlobalPlatformCrypto } from 'keycard-sdk/dist/global-platform-crypto';

import {
  CARD_MANAGER_BLOCKED_STATUS,
  CARD_MANAGER_REFUSED_STATUS,
  NO_CHAIN_CODE_STATUS,
  NO_MATCHING_KEY_STATUS,
  NO_MATCHING_KEYSET_MESSAGE,
  runInstallLock,
  UNEXPECTED_LOCK_KEY_LENGTH,
  useLockInstalls,
  useUnlockInstalls,
} from '../src/hooks/keycard/useInstallLock';
import { fromHex, toHex } from '../src/utils/hex';
import {
  CARD_MANAGER_AID,
  INSTALL_LOCK_KEY_LENGTH,
  INSTALL_LOCK_PATH,
  PUBLISHED_CARD_MANAGER_KEYS,
} from '../src/utils/installLock';
import { isTagLostError } from '../src/utils/keycardErrors';

const mockUseKeycardOp = jest.fn();
jest.mock('../src/hooks/keycard/useKeycardOperation', () => ({
  useKeycardOp: (...args: unknown[]) => mockUseKeycardOp(...args),
}));

const LOCK_KEY = fromHex('6c8d74c9c753c00b7276b3f4384828ca');
const DEV_KEY = fromHex(PUBLISHED_CARD_MANAGER_KEYS.keycardDevelopment);
const GP_DEFAULT = fromHex(PUBLISHED_CARD_MANAGER_KEYS.gpDefault);
const OTHER_KEY = fromHex('11'.repeat(16));

const INS_SELECT = 0xa4;
const INS_INITIALIZE_UPDATE = 0x50;
const INS_EXTERNAL_AUTHENTICATE = 0x82;
const INS_PUT_KEY = 0xd8;
const INS_SET_STATUS = 0xf0;

const OP_READY = 0x01;
const INITIALIZED = 0x07;
const SECURED = 0x0f;

const ok = (data: number[] = []) =>
  new APDUResponse(new Uint8Array([...data, 0x90, 0x00]));
const sw = (code: number) =>
  new APDUResponse(new Uint8Array([code >> 8, code & 0xff]));

type FakeOptions = { kvn?: number; lifeCycle?: number };

/**
 * The card's half of SCP02: answers with a cryptogram from its one keyset and learns a new key by
 * its KCV. PUT KEY must name its keyset (or add version 1 over the initial one), and the life
 * cycle only moves OP_READY, INITIALIZED, SECURED, one step at a time.
 */
class FakeCardManager {
  key: Uint8Array;
  kvn: number;
  lifeCycle: number;
  refuseSelect?: number;
  refuseInitializeUpdate?: number;
  loseOnInitializeUpdate = false;
  readonly commands: APDUCommand[] = [];
  putKeys: { p1: number; newKvn: number; kcvs: string[] }[] = [];

  constructor(
    key: Uint8Array,
    { kvn = 0x01, lifeCycle = SECURED }: FakeOptions = {},
  ) {
    this.key = key;
    this.kvn = kvn;
    this.lifeCycle = lifeCycle;
  }

  sent(ins: number): APDUCommand[] {
    return this.commands.filter(cmd => cmd.ins === ins);
  }

  isConnected = () => true;

  send = async (cmd: APDUCommand): Promise<APDUResponse> => {
    this.commands.push(cmd);
    switch (cmd.ins) {
      case INS_SELECT:
        if (this.refuseSelect) {
          return sw(this.refuseSelect);
        }
        return toHex(cmd.data) === toHex(CARD_MANAGER_AID)
          ? ok([0x6f, 0x10, 0x84, 0x08, ...CARD_MANAGER_AID])
          : sw(0x6a82);
      case INS_INITIALIZE_UPDATE:
        if (this.loseOnInitializeUpdate) {
          throw new Error('Tag was lost.');
        }
        return this.initializeUpdate(cmd.data);
      case INS_EXTERNAL_AUTHENTICATE:
        return ok();
      case INS_PUT_KEY:
        return this.putKey(cmd);
      case INS_SET_STATUS:
        return this.setStatus(cmd);
      default:
        return sw(0x6d00);
    }
  };

  private initializeUpdate(hostChallenge: Uint8Array): APDUResponse {
    if (this.refuseInitializeUpdate) {
      return sw(this.refuseInitializeUpdate);
    }
    const seq = new Uint8Array([0x00, 0x2a]);
    const cardChallenge = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const sessionEnc = GlobalPlatformCrypto.deriveSCP02SessionKey(
      this.key,
      seq,
      new Uint8Array([0x01, 0x82]),
    );
    const cryptogram = GlobalPlatformCrypto.mac3des(
      sessionEnc,
      GlobalPlatformCrypto.appendDESPadding(
        new Uint8Array([...hostChallenge, ...seq, ...cardChallenge]),
      ),
      new Uint8Array(8),
    );
    return ok([
      ...new Array(10).fill(0),
      this.kvn,
      0x02,
      ...seq,
      ...cardChallenge,
      ...cryptogram,
    ]);
  }

  private putKey(cmd: APDUCommand): APDUResponse {
    // Data: new KVN, three times (80 10 <key> 03 <KCV>), then the C-MAC.
    const data = cmd.data.subarray(0, cmd.data.length - 8);
    const newKvn = data[0];
    const kcvs = [0, 1, 2].map(i =>
      toHex(data.subarray(1 + i * 22 + 19, 1 + i * 22 + 22)),
    );
    this.putKeys.push({ p1: cmd.p1, newKvn, kcvs });
    const replaces = cmd.p1 === this.kvn && newKvn === this.kvn;
    const addsOverInitial = cmd.p1 === 0 && newKvn === 1 && this.kvn === 0xff;
    if (!replaces && !addsOverInitial) {
      return sw(0x6a88);
    }
    const next = [LOCK_KEY, DEV_KEY, GP_DEFAULT, OTHER_KEY].find(
      key => toHex(GlobalPlatformCrypto.kcv3des(key)) === kcvs[0],
    );
    if (next) {
      this.key = next;
      this.kvn = newKvn;
    }
    return ok();
  }

  private setStatus(cmd: APDUCommand): APDUResponse {
    const next =
      (this.lifeCycle === OP_READY && cmd.p2 === INITIALIZED) ||
      (this.lifeCycle === INITIALIZED && cmd.p2 === SECURED);
    if (cmd.p1 !== 0x80 || !next) {
      return sw(0x6985);
    }
    this.lifeCycle = cmd.p2;
    return ok();
  }
}

const kcv = (key: Uint8Array) => toHex(GlobalPlatformCrypto.kcv3des(key));

function fakeKeycard(card: FakeCardManager, bip85 = ok([...LOCK_KEY])) {
  const responses: APDUResponse[] = [];
  return {
    responses,
    cmdSet: {
      apduChannel: card,
      exportBIP85: jest.fn(async () => {
        const response =
          bip85.sw === 0x9000
            ? new APDUResponse(new Uint8Array([...bip85.data, 0x90, 0x00]))
            : new APDUResponse(new Uint8Array(bip85.apdu));
        responses.push(response);
        return response;
      }),
    } as any,
  };
}

describe('runInstallLock', () => {
  it('asks the card for 16 bytes at the GPLK path', async () => {
    const { cmdSet } = fakeKeycard(new FakeCardManager(DEV_KEY));
    await runInstallLock(cmdSet, { action: 'lock' });
    expect(cmdSet.exportBIP85).toHaveBeenCalledWith(
      INSTALL_LOCK_PATH,
      INSTALL_LOCK_KEY_LENGTH,
    );
  });

  it('locks a card on the development key over its own keyset', async () => {
    const card = new FakeCardManager(DEV_KEY);
    const { cmdSet } = fakeKeycard(card);
    await expect(runInstallLock(cmdSet, { action: 'lock' })).resolves.toEqual({
      outcome: 'locked',
      cardManagerKey: 'lock',
    });
    expect(card.putKeys).toEqual([
      {
        p1: 0x01,
        newKvn: 0x01,
        kcvs: [kcv(LOCK_KEY), kcv(LOCK_KEY), kcv(LOCK_KEY)],
      },
    ]);
    expect(card.key).toEqual(LOCK_KEY);
  });

  it('locks a card on the GlobalPlatform default', async () => {
    const card = new FakeCardManager(GP_DEFAULT);
    const { cmdSet } = fakeKeycard(card);
    await runInstallLock(cmdSet, { action: 'lock' });
    expect(card.key).toEqual(LOCK_KEY);
  });

  it('replaces a keyset at another key version in place', async () => {
    const card = new FakeCardManager(DEV_KEY, { kvn: 0x20 });
    const { cmdSet } = fakeKeycard(card);
    await runInstallLock(cmdSet, { action: 'lock' });
    expect(card.putKeys[0]).toMatchObject({ p1: 0x20, newKvn: 0x20 });
    expect(card.key).toEqual(LOCK_KEY);
  });

  it('adds version 1 over the initial keyset, as the SDK does', async () => {
    const card = new FakeCardManager(GP_DEFAULT, { kvn: 0xff });
    const { cmdSet } = fakeKeycard(card);
    await runInstallLock(cmdSet, { action: 'lock' });
    expect(card.putKeys[0]).toMatchObject({ p1: 0x00, newKvn: 0x01 });
    expect(card.key).toEqual(LOCK_KEY);
  });

  it.each([
    ['OP_READY', OP_READY],
    ['INITIALIZED', INITIALIZED],
    ['SECURED', SECURED],
  ])('leaves a card that was %s SECURED', async (_, lifeCycle) => {
    const card = new FakeCardManager(DEV_KEY, { lifeCycle });
    const { cmdSet } = fakeKeycard(card);
    await runInstallLock(cmdSet, { action: 'lock' });
    expect(card.lifeCycle).toBe(SECURED);
    expect(card.sent(INS_SET_STATUS).map(cmd => cmd.p2)).toEqual([
      INITIALIZED,
      SECURED,
    ]);
  });

  it('writes no key to a card already locked by this one', async () => {
    const card = new FakeCardManager(LOCK_KEY);
    const { cmdSet } = fakeKeycard(card);
    await expect(runInstallLock(cmdSet, { action: 'lock' })).resolves.toEqual({
      outcome: 'alreadyLocked',
      cardManagerKey: 'lock',
    });
    expect(card.putKeys).toEqual([]);
  });

  // A lock cut off between PUT KEY and SET STATUS completes on the next tap.
  it('still secures a card locked by this one but not yet SECURED', async () => {
    const card = new FakeCardManager(LOCK_KEY, { lifeCycle: OP_READY });
    const { cmdSet } = fakeKeycard(card);
    await expect(runInstallLock(cmdSet, { action: 'lock' })).resolves.toEqual({
      outcome: 'alreadyLocked',
      cardManagerKey: 'lock',
    });
    expect(card.lifeCycle).toBe(SECURED);
  });

  it.each(['gpDefault', 'keycardDevelopment'] as const)(
    'unlocks to the %s key',
    async restore => {
      const card = new FakeCardManager(LOCK_KEY);
      const { cmdSet } = fakeKeycard(card);
      await expect(
        runInstallLock(cmdSet, { action: 'unlock', restore }),
      ).resolves.toEqual({ outcome: 'unlocked', cardManagerKey: restore });
      expect(card.key).toEqual(fromHex(PUBLISHED_CARD_MANAGER_KEYS[restore]));
      expect(card.putKeys[0]).toMatchObject({ p1: 0x01, newKvn: 0x01 });
    },
  );

  it.each([
    ['keycardDevelopment', DEV_KEY],
    ['gpDefault', GP_DEFAULT],
  ] as const)(
    'names the %s key when unlocking a card that is not locked, and writes nothing',
    async (name, key) => {
      const card = new FakeCardManager(key);
      const { cmdSet } = fakeKeycard(card);
      await expect(
        runInstallLock(cmdSet, { action: 'unlock', restore: 'gpDefault' }),
      ).resolves.toEqual({ outcome: 'notLocked', cardManagerKey: name });
      expect(card.putKeys).toEqual([]);
    },
  );

  it('sends no EXTERNAL AUTHENTICATE when no key matches', async () => {
    const card = new FakeCardManager(OTHER_KEY);
    const { cmdSet } = fakeKeycard(card);
    await expect(runInstallLock(cmdSet, { action: 'lock' })).rejects.toThrow(
      NO_MATCHING_KEY_STATUS,
    );
    expect(card.sent(INS_EXTERNAL_AUTHENTICATE)).toEqual([]);
    expect(card.putKeys).toEqual([]);
  });

  it('stops with its own words when the card manager has blocked its key', async () => {
    const card = new FakeCardManager(DEV_KEY);
    card.refuseInitializeUpdate = 0x6983;
    const { cmdSet } = fakeKeycard(card);
    await expect(runInstallLock(cmdSet, { action: 'lock' })).rejects.toThrow(
      CARD_MANAGER_BLOCKED_STATUS,
    );
    expect(card.sent(INS_EXTERNAL_AUTHENTICATE)).toEqual([]);
  });

  it.each([
    ['INITIALIZE UPDATE', 'refuseInitializeUpdate', 0x6982],
    ['SELECT', 'refuseSelect', 0x6a82],
  ] as const)(
    'reports a refused %s plainly and sends nothing more',
    async (_, field, code) => {
      const card = new FakeCardManager(DEV_KEY);
      card[field] = code;
      const { cmdSet } = fakeKeycard(card);
      await expect(runInstallLock(cmdSet, { action: 'lock' })).rejects.toThrow(
        CARD_MANAGER_REFUSED_STATUS,
      );
      expect(card.sent(INS_EXTERNAL_AUTHENTICATE)).toEqual([]);
    },
  );

  // The session classifies a lost card by its own message; a rewritten one would read as refused.
  it('passes a card lost during INITIALIZE UPDATE through untouched', async () => {
    const card = new FakeCardManager(DEV_KEY);
    card.loseOnInitializeUpdate = true;
    const { cmdSet } = fakeKeycard(card);
    const error = await runInstallLock(cmdSet, { action: 'lock' }).catch(
      e => e,
    );
    expect(isTagLostError(error)).toBe(true);
  });

  it('explains a key without a chain code and leaves the card manager alone', async () => {
    const card = new FakeCardManager(DEV_KEY);
    const { cmdSet } = fakeKeycard(card, sw(0x6985));
    await expect(runInstallLock(cmdSet, { action: 'lock' })).rejects.toThrow(
      NO_CHAIN_CODE_STATUS,
    );
    expect(card.commands).toEqual([]);
  });

  it('refuses an answer of the wrong length', async () => {
    const card = new FakeCardManager(DEV_KEY);
    const { cmdSet } = fakeKeycard(card, ok(new Array(32).fill(1)));
    await expect(runInstallLock(cmdSet, { action: 'lock' })).rejects.toThrow(
      UNEXPECTED_LOCK_KEY_LENGTH,
    );
  });

  it("zeroes both of the card answer's buffers, failed tap or not", async () => {
    const locked = fakeKeycard(new FakeCardManager(DEV_KEY));
    await runInstallLock(locked.cmdSet, { action: 'lock' });
    const refused = fakeKeycard(new FakeCardManager(OTHER_KEY));
    await expect(
      runInstallLock(refused.cmdSet, { action: 'lock' }),
    ).rejects.toThrow();
    for (const { responses } of [locked, refused]) {
      const [response] = responses;
      expect(response.data.every(b => b === 0)).toBe(true);
      expect(response.apdu.every(b => b === 0)).toBe(true);
    }
  });
});

describe('the operation hooks', () => {
  beforeEach(() => mockUseKeycardOp.mockReset());

  it.each([
    [useLockInstalls, 'Applet installs locked'],
    [useUnlockInstalls, 'Applet installs unlocked'],
  ])('%p asks for the PIN, a 4.0 card and no LEE mode', (hook, message) => {
    hook();
    expect(mockUseKeycardOp).toHaveBeenCalledWith(runInstallLock, {
      requiresPin: true,
      requiresRoute: 'InstallLock',
      refusesLeeMode: true,
      successMessage: message,
    });
    const [, options] = mockUseKeycardOp.mock.calls[0];
    expect(options.retryOnTagLoss).toBeUndefined();
  });
});

describe('keycard-sdk contract', () => {
  it('still throws the literal the hook looks for when no keyset matches', () => {
    const source = readFileSync(
      require.resolve('keycard-sdk/dist/global-platform-commandset.js'),
      'utf8',
    );
    const initializeUpdate = source.slice(
      source.indexOf('async initializeUpdate('),
      source.indexOf('async openSecureChannel('),
    );
    expect(initializeUpdate).toContain(NO_MATCHING_KEYSET_MESSAGE);
  });
});
