/* eslint-disable no-bitwise */
import { readFileSync } from 'fs';
import { APDUCommand } from 'keycard-sdk/dist/apdu-command';
import { APDUResponse } from 'keycard-sdk/dist/apdu-response';
import { GlobalPlatformCrypto } from 'keycard-sdk/dist/global-platform-crypto';

import {
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

const ok = (data: number[] = []) =>
  new APDUResponse(new Uint8Array([...data, 0x90, 0x00]));
const sw = (code: number) =>
  new APDUResponse(new Uint8Array([code >> 8, code & 0xff]));

/** The card's half of SCP02: answers with a cryptogram from its key, learns a new key by its KCV. */
class FakeCardManager {
  key: Uint8Array;
  secured: boolean;
  refuseInitializeUpdate?: number;
  readonly kvn = 0x01;
  readonly commands: APDUCommand[] = [];
  putKeys: { p1: number; newKvn: number; kcvs: string[] }[] = [];

  constructor(key: Uint8Array, secured = true) {
    this.key = key;
    this.secured = secured;
  }

  sent(ins: number): APDUCommand[] {
    return this.commands.filter(cmd => cmd.ins === ins);
  }

  isConnected = () => true;

  send = async (cmd: APDUCommand): Promise<APDUResponse> => {
    this.commands.push(cmd);
    switch (cmd.ins) {
      case INS_SELECT:
        return toHex(cmd.data) === toHex(CARD_MANAGER_AID)
          ? ok([0x6f, 0x10, 0x84, 0x08, ...CARD_MANAGER_AID])
          : sw(0x6a82);
      case INS_INITIALIZE_UPDATE:
        return this.initializeUpdate(cmd.data);
      case INS_EXTERNAL_AUTHENTICATE:
        return ok();
      case INS_PUT_KEY:
        return this.putKey(cmd);
      case INS_SET_STATUS:
        if (this.secured) {
          return sw(0x6985);
        }
        this.secured = true;
        return ok();
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
    const kcvs = [0, 1, 2].map(i =>
      toHex(data.subarray(1 + i * 22 + 19, 1 + i * 22 + 22)),
    );
    this.putKeys.push({ p1: cmd.p1, newKvn: data[0], kcvs });
    const next = [LOCK_KEY, DEV_KEY, GP_DEFAULT, OTHER_KEY].find(
      key => toHex(GlobalPlatformCrypto.kcv3des(key)) === kcvs[0],
    );
    if (next) {
      this.key = next;
    }
    return ok();
  }
}

const kcv = (key: Uint8Array) => toHex(GlobalPlatformCrypto.kcv3des(key));

function fakeKeycard(card: FakeCardManager, bip85 = ok([...LOCK_KEY])) {
  const exported = new Uint8Array(bip85.data);
  return {
    exported,
    cmdSet: {
      apduChannel: card,
      exportBIP85: jest.fn(async () =>
        bip85.sw === 0x9000
          ? new APDUResponse(new Uint8Array([...exported, 0x90, 0x00]))
          : bip85,
      ),
    } as any,
  };
}

describe('runInstallLock', () => {
  it('asks the card for 16 bytes at the GPLK path', async () => {
    const card = new FakeCardManager(DEV_KEY);
    const { cmdSet } = fakeKeycard(card);
    await runInstallLock(cmdSet, { action: 'lock' });
    expect(cmdSet.exportBIP85).toHaveBeenCalledWith(
      INSTALL_LOCK_PATH,
      INSTALL_LOCK_KEY_LENGTH,
    );
  });

  it('locks a card on the development key over its own keyset, then secures it', async () => {
    const card = new FakeCardManager(DEV_KEY, false);
    const { cmdSet } = fakeKeycard(card);
    await expect(runInstallLock(cmdSet, { action: 'lock' })).resolves.toBe(
      'locked',
    );
    expect(card.putKeys).toEqual([
      {
        p1: 0x01,
        newKvn: 0x01,
        kcvs: [kcv(LOCK_KEY), kcv(LOCK_KEY), kcv(LOCK_KEY)],
      },
    ]);
    expect(card.key).toEqual(LOCK_KEY);
    expect(card.secured).toBe(true);
  });

  it('locks a card on the GlobalPlatform default', async () => {
    const card = new FakeCardManager(GP_DEFAULT);
    const { cmdSet } = fakeKeycard(card);
    await expect(runInstallLock(cmdSet, { action: 'lock' })).resolves.toBe(
      'locked',
    );
    expect(card.key).toEqual(LOCK_KEY);
  });

  it('accepts a card that is already SECURED', async () => {
    const card = new FakeCardManager(DEV_KEY, true);
    const { cmdSet } = fakeKeycard(card);
    await expect(runInstallLock(cmdSet, { action: 'lock' })).resolves.toBe(
      'locked',
    );
    expect(card.sent(INS_SET_STATUS)).toHaveLength(1);
  });

  it('writes no key to a card already locked by this one', async () => {
    const card = new FakeCardManager(LOCK_KEY, true);
    const { cmdSet } = fakeKeycard(card);
    await expect(runInstallLock(cmdSet, { action: 'lock' })).resolves.toBe(
      'alreadyLocked',
    );
    expect(card.putKeys).toEqual([]);
  });

  // A lock cut off between PUT KEY and SET STATUS completes on the next tap.
  it('still secures a card locked by this one but not yet SECURED', async () => {
    const card = new FakeCardManager(LOCK_KEY, false);
    const { cmdSet } = fakeKeycard(card);
    await expect(runInstallLock(cmdSet, { action: 'lock' })).resolves.toBe(
      'alreadyLocked',
    );
    expect(card.secured).toBe(true);
  });

  it.each(['gpDefault', 'keycardDevelopment'] as const)(
    'unlocks to the %s key',
    async restore => {
      const card = new FakeCardManager(LOCK_KEY);
      const { cmdSet } = fakeKeycard(card);
      await expect(
        runInstallLock(cmdSet, { action: 'unlock', restore }),
      ).resolves.toBe('unlocked');
      expect(card.key).toEqual(fromHex(PUBLISHED_CARD_MANAGER_KEYS[restore]));
      expect(card.putKeys[0].p1).toBe(0x01);
    },
  );

  it('changes nothing when unlocking a card that is not locked', async () => {
    const card = new FakeCardManager(DEV_KEY);
    const { cmdSet } = fakeKeycard(card);
    await expect(
      runInstallLock(cmdSet, { action: 'unlock', restore: 'gpDefault' }),
    ).resolves.toBe('notLocked');
    expect(card.putKeys).toEqual([]);
  });

  it('sends no EXTERNAL AUTHENTICATE when no key matches', async () => {
    const card = new FakeCardManager(OTHER_KEY);
    const { cmdSet } = fakeKeycard(card);
    await expect(runInstallLock(cmdSet, { action: 'lock' })).rejects.toThrow(
      NO_MATCHING_KEY_STATUS,
    );
    expect(card.sent(INS_EXTERNAL_AUTHENTICATE)).toEqual([]);
    expect(card.putKeys).toEqual([]);
  });

  it.each(['6982', '6983'])(
    'stops when the card manager refuses with %s',
    async code => {
      const card = new FakeCardManager(DEV_KEY);
      card.refuseInitializeUpdate = parseInt(code, 16);
      const { cmdSet } = fakeKeycard(card);
      await expect(runInstallLock(cmdSet, { action: 'lock' })).rejects.toThrow(
        CARD_MANAGER_REFUSED_STATUS,
      );
      expect(card.sent(INS_INITIALIZE_UPDATE)).toHaveLength(1);
      expect(card.sent(INS_EXTERNAL_AUTHENTICATE)).toEqual([]);
    },
  );

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

  it('zeroes the lock key after the tap, failed or not', async () => {
    const locked = fakeKeycard(new FakeCardManager(DEV_KEY));
    await runInstallLock(locked.cmdSet, { action: 'lock' });
    const refused = fakeKeycard(new FakeCardManager(OTHER_KEY));
    await expect(
      runInstallLock(refused.cmdSet, { action: 'lock' }),
    ).rejects.toThrow();
    // The buffer each tap's operation received from the card.
    for (const { cmdSet } of [locked, refused]) {
      const handed = (await cmdSet.exportBIP85.mock.results[0].value).data;
      expect(handed.every((b: number) => b === 0)).toBe(true);
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
  it('still reports an unmatched card cryptogram with the literal the hook looks for', () => {
    const source = readFileSync(
      require.resolve('keycard-sdk/dist/scp02-channel.js'),
      'utf8',
    );
    expect(source).toContain(NO_MATCHING_KEYSET_MESSAGE);
  });
});
