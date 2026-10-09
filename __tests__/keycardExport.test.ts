import {
  exportKeysForTarget,
  makeExportResumeCache,
} from '../src/utils/keycardExport';

jest.mock('keycard-sdk', () => ({
  __esModule: true,
  default: {
    BIP32KeyPair: {
      fromTLV: jest.fn((data: Uint8Array) => ({ publicKey: data })),
    },
  },
}));

jest.mock('../src/utils/cryptoAccount', () => ({
  pubKeyFingerprint: jest.fn(
    (pub: Uint8Array) => 0xf0000000 + pub[0], // distinct per response
  ),
}));

// exportKey responses carry a tag byte the fingerprint mock keys off.
function response(tag: number) {
  return { checkOK: jest.fn(), data: new Uint8Array([tag]) };
}

function makeCmdSet(parentTagsByPath: Record<string, number>) {
  return {
    exportKey: jest.fn((_p1: number, _p2: boolean, path: string) => {
      const tag = path === 'm' ? 1 : parentTagsByPath[path];
      if (tag === undefined) {
        throw new Error(`Unexpected exportKey path: ${path}`);
      }
      return Promise.resolve(response(tag));
    }),
    exportExtendedKey: jest.fn((_p1: number, path: string) =>
      Promise.resolve({
        checkOK: jest.fn(),
        data: new Uint8Array([0x50, path.length]),
      }),
    ),
  } as any;
}

describe('exportKeysForTarget', () => {
  it('exports the master key once and derives its fingerprint', async () => {
    const cmdSet = makeCmdSet({ "m/44'/60'": 2 });
    const result = await exportKeysForTarget(cmdSet, [
      { derivationPath: "m/44'/60'/0'", parentPath: "m/44'/60'" },
    ]);

    expect(cmdSet.exportKey).toHaveBeenCalledWith(0, true, 'm', false);
    expect(result.masterFingerprint).toBe(0xf0000000 + 1);
  });

  it('exports each planned key with its parent fingerprint and embeds the entry', async () => {
    const cmdSet = makeCmdSet({ "m/84'/0'": 2, "m/49'/0'": 3 });
    const entries = [
      { derivationPath: "m/84'/0'/0'", parentPath: "m/84'/0'", meta: 'a' },
      { derivationPath: "m/49'/0'/0'", parentPath: "m/49'/0'", meta: 'b' },
    ];

    const result = await exportKeysForTarget(cmdSet, entries);

    expect(cmdSet.exportExtendedKey).toHaveBeenNthCalledWith(
      1,
      0,
      "m/84'/0'/0'",
      false,
    );
    expect(cmdSet.exportExtendedKey).toHaveBeenNthCalledWith(
      2,
      0,
      "m/49'/0'/0'",
      false,
    );
    expect(result.keys).toHaveLength(2);
    expect(result.keys[0].entry).toBe(entries[0]);
    expect(result.keys[0].entry.meta).toBe('a');
    expect(result.keys[0].parentFingerprint).toBe(0xf0000000 + 2);
    expect(result.keys[1].parentFingerprint).toBe(0xf0000000 + 3);
  });

  it('fetches each distinct parent path once', async () => {
    const cmdSet = makeCmdSet({ "m/48'/0'/0'": 2 });
    await exportKeysForTarget(cmdSet, [
      { derivationPath: "m/48'/0'/0'/2'", parentPath: "m/48'/0'/0'" },
      { derivationPath: "m/48'/0'/0'/1'", parentPath: "m/48'/0'/0'" },
    ]);

    const parentCalls = cmdSet.exportKey.mock.calls.filter(
      (c: unknown[]) => c[2] === "m/48'/0'/0'",
    );
    expect(parentCalls).toHaveLength(1);
  });

  it("reuses the master fingerprint for parentPath 'm' without re-exporting", async () => {
    const cmdSet = makeCmdSet({});
    const result = await exportKeysForTarget(cmdSet, [
      { derivationPath: "m/45'", parentPath: 'm' },
    ]);

    // exportKey called exactly once — for the master read.
    expect(cmdSet.exportKey).toHaveBeenCalledTimes(1);
    expect(result.keys[0].parentFingerprint).toBe(result.masterFingerprint);
  });

  it('reports progress statuses', async () => {
    const cmdSet = makeCmdSet({ "m/84'/0'": 2, "m/49'/0'": 3 });
    const setStatus = jest.fn();
    await exportKeysForTarget(
      cmdSet,
      [
        { derivationPath: "m/84'/0'/0'", parentPath: "m/84'/0'" },
        { derivationPath: "m/49'/0'/0'", parentPath: "m/49'/0'" },
      ],
      setStatus,
    );

    expect(setStatus).toHaveBeenCalledWith('Reading master key...');
    expect(setStatus).toHaveBeenCalledWith('Exporting key 1 of 2...');
    expect(setStatus).toHaveBeenCalledWith('Exporting key 2 of 2...');
  });

  it('checks every card response', async () => {
    const bad = {
      checkOK: jest.fn(() => {
        throw new Error('SW error');
      }),
      data: new Uint8Array([1]),
    };
    const cmdSet = {
      exportKey: jest.fn().mockResolvedValue(bad),
      exportExtendedKey: jest.fn(),
    } as any;

    await expect(
      exportKeysForTarget(cmdSet, [
        { derivationPath: "m/44'/60'/0'", parentPath: "m/44'/60'" },
      ]),
    ).rejects.toThrow('SW error');
    expect(cmdSet.exportExtendedKey).not.toHaveBeenCalled();
  });

  // Resume after a tag loss: fetched keys are reused, bound to the key UID.
  describe('resume cache', () => {
    const PLAN = [
      { derivationPath: "m/84'/0'/0'", parentPath: "m/84'/0'" },
      { derivationPath: "m/44'/60'/0'", parentPath: "m/44'/60'" },
    ];
    const PARENTS = { "m/84'/0'": 2, "m/44'/60'": 3 };

    function withKeyUid(cmdSet: any, keyUid: number[], instanceUid = [0x01]) {
      cmdSet.applicationInfo = {
        instanceUID: new Uint8Array(instanceUid),
        keyUID: new Uint8Array(keyUid),
      };
      return cmdSet;
    }

    it('resumes at the first missing key on the same card', async () => {
      const cache = makeExportResumeCache();

      // First tap: key 1 exports, key 2 is cut short by tag loss.
      const first = withKeyUid(makeCmdSet(PARENTS), [0xaa, 0xbb]);
      first.exportExtendedKey
        .mockImplementationOnce((_p1: number, path: string) =>
          Promise.resolve({
            checkOK: jest.fn(),
            data: new Uint8Array([0x50, path.length]),
          }),
        )
        .mockImplementationOnce(() =>
          Promise.reject(new Error('CardIO Error: Error: Tag was lost.')),
        );
      await expect(
        exportKeysForTarget(first, PLAN, () => {}, cache),
      ).rejects.toThrow('Tag was lost');
      expect(first.exportExtendedKey).toHaveBeenCalledTimes(2);

      // Re-tap, same card: master read skipped, only key 2 exported.
      const second = withKeyUid(makeCmdSet(PARENTS), [0xaa, 0xbb]);
      const result = await exportKeysForTarget(second, PLAN, () => {}, cache);
      expect(second.exportKey).not.toHaveBeenCalledWith(0, true, 'm', false);
      expect(second.exportExtendedKey).toHaveBeenCalledTimes(1);
      expect(second.exportExtendedKey).toHaveBeenCalledWith(
        0,
        "m/44'/60'/0'",
        false,
      );
      expect(result.keys).toHaveLength(2);
      expect(result.keys.map(k => k.entry.derivationPath)).toEqual([
        "m/84'/0'/0'",
        "m/44'/60'/0'",
      ]);
    });

    it('discards the cache when the re-tap holds a different seed', async () => {
      const cache = makeExportResumeCache();
      const first = withKeyUid(makeCmdSet(PARENTS), [0xaa, 0xbb]);
      await exportKeysForTarget(first, PLAN, () => {}, cache);

      const other = withKeyUid(makeCmdSet(PARENTS), [0xcc, 0xdd]);
      await exportKeysForTarget(other, PLAN, () => {}, cache);
      // Keys of seed A never merge into seed B's export.
      expect(other.exportKey).toHaveBeenCalledWith(0, true, 'm', false);
      expect(other.exportExtendedKey).toHaveBeenCalledTimes(2);
    });

    it('does not trust the cache when the card has no applicationInfo', async () => {
      const cache = makeExportResumeCache();
      await exportKeysForTarget(
        withKeyUid(makeCmdSet(PARENTS), [0xaa]),
        PLAN,
        () => {},
        cache,
      );

      const anonymous = makeCmdSet(PARENTS); // no applicationInfo
      await exportKeysForTarget(anonymous, PLAN, () => {}, cache);
      expect(anonymous.exportKey).toHaveBeenCalledWith(0, true, 'm', false);
      expect(anonymous.exportExtendedKey).toHaveBeenCalledTimes(2);
    });

    // A factory reset with a new seed keeps the instance UID; the key UID changes.
    it('discards the cache when the same card now holds a different seed', async () => {
      const cache = makeExportResumeCache();
      const before = withKeyUid(makeCmdSet(PARENTS), [0xaa], [0x07]);
      await exportKeysForTarget(before, PLAN, () => {}, cache);

      const afterReset = withKeyUid(makeCmdSet(PARENTS), [0xbb], [0x07]);
      await exportKeysForTarget(afterReset, PLAN, () => {}, cache);
      expect(afterReset.exportKey).toHaveBeenCalledWith(0, true, 'm', false);
      expect(afterReset.exportExtendedKey).toHaveBeenCalledTimes(2);
    });

    it('keeps the cache across two cards holding the same seed', async () => {
      const cache = makeExportResumeCache();
      const cardA = withKeyUid(makeCmdSet(PARENTS), [0xaa], [0x01]);
      await exportKeysForTarget(cardA, PLAN, () => {}, cache);

      // Same seed exports identical keys, so resuming on a second card is safe.
      const cardB = withKeyUid(makeCmdSet(PARENTS), [0xaa], [0x02]);
      await exportKeysForTarget(cardB, PLAN, () => {}, cache);
      expect(cardB.exportKey).not.toHaveBeenCalledWith(0, true, 'm', false);
      expect(cardB.exportExtendedKey).not.toHaveBeenCalled();
    });

    it('does not trust the cache when no key is loaded', async () => {
      const cache = makeExportResumeCache();
      await exportKeysForTarget(
        withKeyUid(makeCmdSet(PARENTS), []),
        PLAN,
        () => {},
        cache,
      );

      const noKey = withKeyUid(makeCmdSet(PARENTS), []);
      await exportKeysForTarget(noKey, PLAN, () => {}, cache);
      expect(noKey.exportKey).toHaveBeenCalledWith(0, true, 'm', false);
      expect(noKey.exportExtendedKey).toHaveBeenCalledTimes(2);
    });
  });
});
