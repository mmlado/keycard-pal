/* eslint-disable no-bitwise */
import { readFileSync } from 'fs';
import { APDUCommand } from 'keycard-sdk/dist/apdu-command';
import { APDUResponse } from 'keycard-sdk/dist/apdu-response';
import { GlobalPlatformCommandset } from 'keycard-sdk/dist/global-platform-commandset';
import { GlobalPlatformConstants } from 'keycard-sdk/dist/global-platform-constants';
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
import type { ManagementPrivilege } from '../src/utils/gpRegistry';
import { fromHex, toHex } from '../src/utils/hex';
import {
  CARD_MANAGER_AID,
  INSTALL_LOCK_KEY_LENGTH,
  INSTALL_LOCK_PATH,
  LockFindings,
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
const INS_GET_DATA = 0xca;
const INS_PUT_KEY = 0xd8;
const INS_SET_STATUS = 0xf0;
const INS_GET_STATUS = 0xf2;

const OP_READY = 0x01;
const INITIALIZED = 0x07;
const SECURED = 0x0f;

const ok = (data: number[] = []) =>
  new APDUResponse(new Uint8Array([...data, 0x90, 0x00]));
const sw = (code: number) =>
  new APDUResponse(new Uint8Array([code >> 8, code & 0xff]));

const desKeyset = (kvn: number) =>
  [1, 2, 3].flatMap(id => [0xc0, 0x04, id, kvn, 0x80, 0x10]);

const tlv = (tag: number[], value: number[]) => [
  ...tag,
  value.length,
  ...value,
];
const registryEntry = (
  aid: number[],
  lifeCycle: number,
  privileges: number[],
) =>
  tlv(
    [0xe3],
    [
      ...tlv([0x4f], aid),
      ...tlv([0x9f, 0x70], [lifeCycle]),
      ...tlv([0xc5], privileges),
    ],
  );

/** The measured Developer card: its card manager's privileges and its four applets. */
const CARD_MANAGER_PRIVILEGES = [0x9e, 0xfe, 0x80];
const APPLICATIONS = [
  ...fromHex(
    'e3274f09a000000804000101019f700107c503000000c407a0000008040001cc08a000000151000000' +
      'e3254f07d27600008501019f700107c503000000c407a0000008040001cc08a000000151000000' +
      'e3274f09a000000804000103019f700107c503000000c407a0000008040001cc08a000000151000000' +
      'e3274f09a000000804000104019f700107c503000000c407a0000008040001cc08a000000151000000',
  ),
];
const DOMAIN_AID = [...fromHex('a0000001515350')];

type FakeOptions = {
  kvn?: number;
  lifeCycle?: number;
  otherKeys?: number[];
  keepsInitialKeyset?: boolean;
};

/** The card's half of SCP02, as strict as GP 2.3.1, so a lock that breaks a rule fails here. */
class FakeCardManager {
  key: Uint8Array;
  kvn: number;
  lifeCycle: number;
  otherKeys: number[];
  keepsInitialKeyset: boolean;
  refuseSelect?: number;
  refuseSecondSelect?: number;
  refuseInitializeUpdate?: number;
  refuseGetData?: number;
  refusePutKey?: number;
  template?: number[];
  loseOnInitializeUpdate = false;
  loseOnGetData = false;
  loseOnGetStatus = false;
  sessionOpen = false;
  /** SET STATUS changes nothing, as on a card that will not leave its state. */
  stuckLifeCycle = false;
  cardManagerPrivileges = CARD_MANAGER_PRIVILEGES;
  cardManagerEntry?: number[];
  cardManagerPages?: number[][];
  applications = APPLICATIONS;
  applicationPages?: number[][];
  refuseStatus: Record<number, number> = {};
  private applicationPage = 0;
  readonly commands: APDUCommand[] = [];
  putKeys: { p1: number; newKvn: number; kcvs: string[] }[] = [];

  constructor(
    key: Uint8Array,
    {
      kvn = 0x01,
      lifeCycle = SECURED,
      otherKeys = [],
      keepsInitialKeyset = false,
    }: FakeOptions = {},
  ) {
    this.key = key;
    this.kvn = kvn;
    this.lifeCycle = lifeCycle;
    this.otherKeys = otherKeys;
    this.keepsInitialKeyset = keepsInitialKeyset;
  }

  sent(ins: number): APDUCommand[] {
    return this.commands.filter(cmd => cmd.ins === ins);
  }

  isConnected = () => true;

  send = async (cmd: APDUCommand): Promise<APDUResponse> => {
    this.commands.push(cmd);
    if (this.sessionOpen && cmd.ins !== INS_SELECT && !(cmd.cla & 0x04)) {
      this.sessionOpen = false;
      return sw(0x6982);
    }
    switch (cmd.ins) {
      case INS_SELECT:
        return this.select(cmd);
      case INS_INITIALIZE_UPDATE:
        if (this.loseOnInitializeUpdate) {
          throw new Error('Tag was lost.');
        }
        return this.initializeUpdate(cmd.data);
      case INS_EXTERNAL_AUTHENTICATE:
        this.sessionOpen = true;
        return ok();
      case INS_GET_DATA:
        return this.getData(cmd);
      case INS_PUT_KEY:
        return this.putKey(cmd);
      case INS_SET_STATUS:
        return this.setStatus(cmd);
      case INS_GET_STATUS:
        return this.getStatus(cmd);
      default:
        return sw(0x6d00);
    }
  };

  private select(cmd: APDUCommand): APDUResponse {
    this.sessionOpen = false;
    const refusal =
      this.sent(INS_SELECT).length > 1
        ? this.refuseSecondSelect ?? this.refuseSelect
        : this.refuseSelect;
    if (refusal) {
      return sw(refusal);
    }
    return toHex(cmd.data) === toHex(CARD_MANAGER_AID)
      ? ok([0x6f, 0x10, 0x84, 0x08, ...CARD_MANAGER_AID])
      : sw(0x6a82);
  }

  private getData(cmd: APDUCommand): APDUResponse {
    if (this.loseOnGetData) {
      throw new Error('Tag was lost.');
    }
    if (this.refuseGetData) {
      return sw(this.refuseGetData);
    }
    if (cmd.p1 !== 0x00 || cmd.p2 !== 0xe0) {
      return sw(0x6a88);
    }
    const entries = this.template ?? [
      ...desKeyset(this.kvn),
      ...(this.keepsInitialKeyset && this.kvn !== 0xff ? desKeyset(0xff) : []),
      ...this.otherKeys,
    ];
    return ok([0xe0, entries.length, ...entries]);
  }

  private getStatus(cmd: APDUCommand): APDUResponse {
    if (this.loseOnGetStatus) {
      throw new Error('Tag was lost.');
    }
    if (!this.sessionOpen) {
      return sw(0x6982);
    }
    if (this.refuseStatus[cmd.p1]) {
      return sw(this.refuseStatus[cmd.p1]);
    }
    if (cmd.p1 === 0x80 && this.cardManagerPages) {
      const [first, ...rest] = this.cardManagerPages;
      return cmd.p2 === 0x03
        ? ok(rest[0] ?? [])
        : new APDUResponse(new Uint8Array([...first, 0x63, 0x10]));
    }
    if (cmd.p1 === 0x80) {
      return ok(
        this.cardManagerEntry ??
          registryEntry(
            [...CARD_MANAGER_AID],
            this.lifeCycle,
            this.cardManagerPrivileges,
          ),
      );
    }
    const pages = this.applicationPages ?? [this.applications];
    this.applicationPage = cmd.p2 === 0x03 ? this.applicationPage + 1 : 0;
    const page = pages[Math.min(this.applicationPage, pages.length - 1)];
    return this.applicationPage < pages.length - 1
      ? new APDUResponse(new Uint8Array([...page, 0x63, 0x10]))
      : ok(page);
  }

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
    if (this.refusePutKey) {
      return sw(this.refusePutKey);
    }
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
    if (cmd.p1 !== 0x80 || !next || this.stuckLifeCycle) {
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

  it.each([
    ['lock', DEV_KEY, { action: 'lock' }],
    ['unlock', LOCK_KEY, { action: 'unlock', restore: 'gpDefault' }],
  ] as const)(
    'reports a refused PUT KEY on %s plainly and sends nothing more',
    async (_, key, request) => {
      const card = new FakeCardManager(key);
      card.refusePutKey = 0x6a80;
      const { cmdSet } = fakeKeycard(card);
      await expect(runInstallLock(cmdSet, request)).rejects.toThrow(
        CARD_MANAGER_REFUSED_STATUS,
      );
      expect(card.sent(INS_SET_STATUS)).toEqual([]);
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

const lock = (card: FakeCardManager) =>
  runInstallLock(fakeKeycard(card).cmdSet, { action: 'lock' });

const unconfirmed = (findings: Partial<LockFindings>) => ({
  outcome: 'unconfirmed',
  cardManagerKey: 'lock',
  findings: {
    notSecured: null,
    otherDomains: [],
    otherKeyVersions: [],
    unchecked: [],
    ...findings,
  },
});

describe('the checks after a lock', () => {
  it('reads the state and the domains in the session, then the keys in plain after a new SELECT', async () => {
    const card = new FakeCardManager(DEV_KEY);
    await expect(lock(card)).resolves.toEqual({
      outcome: 'locked',
      cardManagerKey: 'lock',
    });
    const lastSetStatus = card.commands.lastIndexOf(
      card.sent(INS_SET_STATUS).at(-1)!,
    );
    expect(
      card.commands
        .slice(lastSetStatus + 1)
        .map(cmd => [cmd.cla, cmd.ins, cmd.p1, cmd.p2]),
    ).toEqual([
      [0x84, INS_GET_STATUS, 0x80, 0x02],
      [0x84, INS_GET_STATUS, 0x40, 0x02],
      [0x00, INS_SELECT, 0x04, 0x00],
      [0x80, INS_GET_DATA, 0x00, 0xe0],
    ]);
    expect(toHex(card.sent(INS_GET_STATUS)[0].data.subarray(0, 2))).toBe(
      '4f00',
    );
    expect(card.sent(INS_GET_DATA)[0].serialize()).toEqual(
      fromHex('80ca00e000'),
    );
  });

  it('sends GET STATUS as a case 4 command inside the session', async () => {
    const card = new FakeCardManager(DEV_KEY);
    await lock(card);
    for (const cmd of card.sent(INS_GET_STATUS)) {
      const bytes = cmd.serialize();
      expect(toHex(bytes.subarray(0, 7))).toBe(
        `84f2${cmd.p1.toString(16)}020a4f00`,
      );
      expect(bytes).toHaveLength(16);
      expect(bytes[15]).toBe(0x00);
    }
  });

  it('reports every finding at once', async () => {
    const card = new FakeCardManager(DEV_KEY, {
      lifeCycle: INITIALIZED,
      otherKeys: desKeyset(0x02),
    });
    card.stuckLifeCycle = true;
    card.applications = [
      ...APPLICATIONS,
      ...registryEntry(DOMAIN_AID, SECURED, [0x80, 0x10, 0x00]),
    ];
    await expect(lock(card)).resolves.toEqual(
      unconfirmed({
        notSecured: 'INITIALIZED',
        otherDomains: [
          {
            aid: 'A0000001515350',
            securityDomain: true,
            privileges: ['Global Delete'],
          },
        ],
        otherKeyVersions: [0x02],
      }),
    );
  });

  it('sends no check on unlock', async () => {
    const card = new FakeCardManager(LOCK_KEY);
    const { cmdSet } = fakeKeycard(card);
    await runInstallLock(cmdSet, { action: 'unlock', restore: 'gpDefault' });
    expect(card.sent(INS_GET_STATUS)).toEqual([]);
    expect(card.sent(INS_GET_DATA)).toEqual([]);
  });
});

describe("the card manager's state after a lock", () => {
  it.each([
    ['OP_READY', OP_READY],
    ['INITIALIZED', INITIALIZED],
    ['CARD_LOCKED', 0x7f],
    ['TERMINATED', 0xff],
  ])('does not report a card left %s as locked', async (name, lifeCycle) => {
    const card = new FakeCardManager(DEV_KEY, { lifeCycle });
    card.stuckLifeCycle = true;
    await expect(lock(card)).resolves.toEqual(
      unconfirmed({ notSecured: name }),
    );
    expect(card.key).toEqual(LOCK_KEY);
  });

  it('leaves the state unchecked at a life cycle GlobalPlatform does not name', async () => {
    const card = new FakeCardManager(DEV_KEY, { lifeCycle: 0x55 });
    card.stuckLifeCycle = true;
    await expect(lock(card)).resolves.toEqual(
      unconfirmed({ unchecked: ['state'] }),
    );
  });

  it.each<[string, (card: FakeCardManager) => void]>([
    [
      'is refused',
      card => {
        card.refuseStatus = { 0x80: 0x6a88 };
      },
    ],
    [
      'claims more data',
      card => {
        card.refuseStatus = { 0x80: 0x6310 };
      },
    ],
    [
      'answers for another AID',
      card => {
        card.cardManagerEntry = registryEntry(
          DOMAIN_AID,
          SECURED,
          CARD_MANAGER_PRIVILEGES,
        );
      },
    ],
    [
      'answers with two entries',
      card => {
        const entry = registryEntry(
          [...CARD_MANAGER_AID],
          SECURED,
          CARD_MANAGER_PRIVILEGES,
        );
        card.cardManagerEntry = [...entry, ...entry];
      },
    ],
  ])(
    "leaves the state and the domains unchecked when the card manager's own query %s",
    async (_, set) => {
      const card = new FakeCardManager(DEV_KEY);
      set(card);
      await expect(lock(card)).resolves.toEqual(
        unconfirmed({ unchecked: ['state', 'domains'] }),
      );
    },
  );

  it("never asks for a next occurrence of the card manager's own entry", async () => {
    const card = new FakeCardManager(DEV_KEY);
    const entry = registryEntry(
      [...CARD_MANAGER_AID],
      SECURED,
      CARD_MANAGER_PRIVILEGES,
    );
    card.cardManagerPages = [entry.slice(0, 10), entry.slice(10)];
    await expect(lock(card)).resolves.toEqual(
      unconfirmed({ unchecked: ['state', 'domains'] }),
    );
    expect(
      card.sent(INS_GET_STATUS).filter(cmd => cmd.p1 === 0x80),
    ).toHaveLength(1);
  });

  it('passes a card lost during GET STATUS through untouched', async () => {
    const card = new FakeCardManager(DEV_KEY);
    card.loseOnGetStatus = true;
    const error = await lock(card).catch(e => e);
    expect(isTagLostError(error)).toBe(true);
  });
});

describe('the other security domains after a lock', () => {
  it.each([
    ['Authorized Management', [0x80, 0x40, 0x00], ['Authorized Management']],
    ['Global Delete', [0x80, 0x10, 0x00], ['Global Delete']],
    ['Delegated Management', [0xa0, 0x00, 0x00], ['Delegated Management']],
    [
      'Authorized Management and Global Delete',
      [0x80, 0x50, 0x00],
      ['Authorized Management', 'Global Delete'],
    ],
  ] as [string, number[], ManagementPrivilege[]][])(
    'does not report a card as locked while another domain holds %s',
    async (_, privileges, names) => {
      const card = new FakeCardManager(DEV_KEY);
      card.applications = [
        ...APPLICATIONS,
        ...registryEntry(DOMAIN_AID, SECURED, privileges),
      ];
      await expect(lock(card)).resolves.toEqual(
        unconfirmed({
          otherDomains: [
            { aid: 'A0000001515350', securityDomain: true, privileges: names },
          ],
        }),
      );
    },
  );

  it('names an entry without the Security Domain bit an application', async () => {
    const card = new FakeCardManager(DEV_KEY);
    card.applications = [
      ...APPLICATIONS,
      ...registryEntry(DOMAIN_AID, 0x07, [0x00, 0x10, 0x00]),
    ];
    await expect(lock(card)).resolves.toEqual(
      unconfirmed({
        otherDomains: [
          {
            aid: 'A0000001515350',
            securityDomain: false,
            privileges: ['Global Delete'],
          },
        ],
      }),
    );
  });

  it('passes over a domain that can only lock or terminate the card', async () => {
    const card = new FakeCardManager(DEV_KEY);
    card.applications = [
      ...APPLICATIONS,
      ...registryEntry(DOMAIN_AID, SECURED, [0x98, 0x0a, 0x00]),
    ];
    await expect(lock(card)).resolves.toMatchObject({ outcome: 'locked' });
  });

  it('passes over the card manager when the card lists it among its applications', async () => {
    const card = new FakeCardManager(DEV_KEY);
    card.applications = [
      ...APPLICATIONS,
      ...registryEntry([...CARD_MANAGER_AID], SECURED, CARD_MANAGER_PRIVILEGES),
    ];
    await expect(lock(card)).resolves.toMatchObject({ outcome: 'locked' });
  });

  it('reads a list the card splits over several answers', async () => {
    const card = new FakeCardManager(DEV_KEY);
    card.applicationPages = [APPLICATIONS.slice(0, 82), APPLICATIONS.slice(82)];
    await expect(lock(card)).resolves.toMatchObject({ outcome: 'locked' });
    expect(
      card
        .sent(INS_GET_STATUS)
        .filter(cmd => cmd.p1 === 0x40)
        .map(cmd => cmd.p2),
    ).toEqual([0x02, 0x03]);
  });

  it('gives up on a card that keeps answering 6310', async () => {
    const card = new FakeCardManager(DEV_KEY);
    card.applicationPages = Array.from({ length: 20 }, () => APPLICATIONS);
    await expect(lock(card)).resolves.toEqual(
      unconfirmed({ unchecked: ['domains'] }),
    );
    expect(
      card.sent(INS_GET_STATUS).filter(cmd => cmd.p1 === 0x40),
    ).toHaveLength(16);
  });

  it.each<[string, (card: FakeCardManager) => void]>([
    [
      'the card manager lacks Global Registry',
      card => {
        card.cardManagerPrivileges = [0x9e, 0xfa, 0x80];
      },
    ],
    [
      'the list leaves out the Keycard applet',
      card => {
        card.applications = APPLICATIONS.slice(41);
      },
    ],
    [
      'an entry has a single privileges byte',
      card => {
        card.applications = [
          ...APPLICATIONS,
          ...registryEntry(DOMAIN_AID, SECURED, [0x80]),
        ];
      },
    ],
    [
      'the card refuses the query',
      card => {
        card.refuseStatus = { 0x40: 0x6a88 };
      },
    ],
    [
      'an answer that claims more data is empty',
      card => {
        card.applicationPages = [[], APPLICATIONS];
      },
    ],
    [
      'an AID appears twice',
      card => {
        card.applications = [...APPLICATIONS, ...APPLICATIONS.slice(0, 41)];
      },
    ],
    [
      'the list does not parse',
      card => {
        card.applications = [0xe3, 0x05, 0x4f, 0x01];
      },
    ],
  ])('leaves the domains unchecked when %s', async (_, set) => {
    const card = new FakeCardManager(DEV_KEY);
    set(card);
    await expect(lock(card)).resolves.toEqual(
      unconfirmed({ unchecked: ['domains'] }),
    );
  });
});

describe('the key list after a lock', () => {
  it.each([
    ['another keyset', [0x02], desKeyset(0x02)],
    [
      'two more keysets',
      [0x02, 0x30],
      [...desKeyset(0x02), ...desKeyset(0x30)],
    ],
    ['a private key', [0x20], [0xc0, 0x04, 0x01, 0x20, 0xb1, 0x20]],
    [
      'a key type it cannot read',
      [0x20],
      [0xc0, 0x05, 0x01, 0x20, 0x80, 0x10, 0x01],
    ],
  ])(
    'does not report a card as locked while it keeps %s',
    async (_, versions, otherKeys) => {
      const card = new FakeCardManager(DEV_KEY, { otherKeys });
      await expect(lock(card)).resolves.toEqual(
        unconfirmed({ otherKeyVersions: versions }),
      );
      expect(card.key).toEqual(LOCK_KEY);
      expect(card.lifeCycle).toBe(SECURED);
    },
  );

  it('reports a card already locked the same way', async () => {
    const card = new FakeCardManager(LOCK_KEY, { otherKeys: desKeyset(0x02) });
    await expect(lock(card)).resolves.toEqual(
      unconfirmed({ otherKeyVersions: [0x02] }),
    );
  });

  it('counts an initial keyset the card keeps beside version 1', async () => {
    const card = new FakeCardManager(GP_DEFAULT, {
      kvn: 0xff,
      keepsInitialKeyset: true,
    });
    await expect(lock(card)).resolves.toEqual(
      unconfirmed({ otherKeyVersions: [0xff] }),
    );
  });

  it('passes over a key version that holds only a public key', async () => {
    const card = new FakeCardManager(DEV_KEY, {
      otherKeys: [0xc0, 0x06, 0x01, 0x73, 0xa0, 0x03, 0xa1, 0x80],
    });
    await expect(lock(card)).resolves.toEqual({
      outcome: 'locked',
      cardManagerKey: 'lock',
    });
  });

  it.each([
    ['refuses it', { refuseGetData: 0x6a88 }],
    ['answers what does not parse', { template: [0xc0, 0x04, 1, 1, 0x80] }],
    ['lists no key at the version just written', { template: desKeyset(0x02) }],
    ['refuses the second SELECT', { refuseSecondSelect: 0x6a82 }],
  ])('says the keys went unchecked when the card %s', async (_, fields) => {
    const card = Object.assign(new FakeCardManager(DEV_KEY), fields);
    await expect(lock(card)).resolves.toEqual(
      unconfirmed({ unchecked: ['keys'] }),
    );
    expect(card.key).toEqual(LOCK_KEY);
  });

  it('passes a card lost during the read through untouched', async () => {
    const card = new FakeCardManager(DEV_KEY);
    card.loseOnGetData = true;
    const error = await lock(card).catch(e => e);
    expect(isTagLostError(error)).toBe(true);
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
  it('has the GET DATA and GET STATUS the lock sends', () => {
    expect(typeof GlobalPlatformCommandset.prototype.getData).toBe('function');
    expect(typeof GlobalPlatformCommandset.prototype.getStatus).toBe(
      'function',
    );
    expect([
      GlobalPlatformConstants.INS_GET_DATA,
      GlobalPlatformConstants.GET_DATA_KEY_INFORMATION_TEMPLATE,
      GlobalPlatformConstants.INS_GET_STATUS,
      GlobalPlatformConstants.GET_STATUS_P1_ISD,
      GlobalPlatformConstants.GET_STATUS_P1_APPLICATIONS,
      GlobalPlatformConstants.GET_STATUS_P2_TLV,
      GlobalPlatformConstants.GET_STATUS_P2_NEXT,
    ]).toEqual([0xca, 0x00e0, 0xf2, 0x80, 0x40, 0x02, 0x01]);
  });

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
