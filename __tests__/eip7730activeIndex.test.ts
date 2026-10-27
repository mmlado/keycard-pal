import { BUNDLED_ATTESTATIONS } from '../src/utils/eip7730/knownAttestations';

import { testIndex } from './eip7730Index.testUtils';

type Manifest = {
  version: number;
  generatedAt: string;
  source?: 'import' | 'download';
  bundled: string;
};

// The saved folder, as the storage adapter would leave it.
let mockDisk: Manifest | null = null;
let mockSaveGate: Promise<void> = Promise.resolve();
const mockLoadManifest = jest.fn();
const mockSaveIndex = jest.fn();
const mockClearSavedIndex = jest.fn();
jest.mock('../src/storage/eip7730Index', () => ({
  BUNDLED_REGISTRY: 'registry-b',
  loadManifest: (...args: any[]) => mockLoadManifest(...args),
  loadSlice: async () => null,
  saveIndex: (...args: any[]) => mockSaveIndex(...args),
  clearSavedIndex: (...args: any[]) => mockClearSavedIndex(...args),
}));

const mockProcess = jest.fn();
jest.mock('../src/utils/eip7730/zip', () => ({
  ...jest.requireActual('../src/utils/eip7730/zip'),
  processRegistryZip: (...args: any[]) => mockProcess(...args),
}));

const INDEX = testIndex({
  generatedAt: '2026-10-12T00:00:00.000Z',
  contracts: { '1:0xabc': { '0xa9059cbb': { intent: 'Send', fields: [] } } },
});
const SAVED: Manifest = {
  version: 3,
  generatedAt: '2026-10-11T00:00:00.000Z',
  bundled: 'registry-b',
};
const OLDER: Manifest = { ...SAVED, bundled: 'registry-a' };
const BYTES = new Uint8Array([1, 2, 3]);

function load(): typeof import('../src/utils/eip7730/lookup') {
  let lookup!: typeof import('../src/utils/eip7730/lookup');
  jest.isolateModules(() => {
    lookup = require('../src/utils/eip7730/lookup');
  });
  return lookup;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

/** The active source and the saved folder agree. */
function expectInStep(lookup: ReturnType<typeof load>) {
  const active = lookup.getSavedIndex();
  expect(active && { generatedAt: active.generatedAt }).toEqual(
    mockDisk && { generatedAt: mockDisk.generatedAt },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDisk = null;
  mockSaveGate = Promise.resolve();
  mockLoadManifest.mockImplementation(async () => mockDisk);
  mockSaveIndex.mockImplementation(async (index, source) => {
    await mockSaveGate;
    mockDisk = {
      version: 3,
      generatedAt: index.generatedAt,
      source,
      bundled: 'registry-b',
    };
    return mockDisk;
  });
  mockClearSavedIndex.mockImplementation(async () => {
    mockDisk = null;
  });
  mockProcess.mockReturnValue(INDEX);
});

describe('restorePersistedIndex', () => {
  it('makes a saved index the source, from its manifest alone', async () => {
    mockDisk = { ...SAVED, source: 'download' };
    const lookup = load();
    await lookup.restorePersistedIndex();
    expect(lookup.getSavedIndex()).toEqual({
      generatedAt: SAVED.generatedAt,
      source: 'download',
    });
  });

  it('reads the manifest once per app run', async () => {
    mockDisk = SAVED;
    const lookup = load();
    await Promise.all([
      lookup.restorePersistedIndex(),
      lookup.restorePersistedIndex(),
    ]);
    expect(mockLoadManifest).toHaveBeenCalledTimes(1);
  });

  it('keeps an index saved under this build whatever the clock said', async () => {
    mockDisk = { ...SAVED, generatedAt: '2000-01-01T00:00:00.000Z' };
    const lookup = load();
    await lookup.restorePersistedIndex();
    expect(mockClearSavedIndex).not.toHaveBeenCalled();
    expect(lookup.getSavedIndex()?.generatedAt).toBe(
      '2000-01-01T00:00:00.000Z',
    );
  });

  it('drops an index saved before an update brought another registry', async () => {
    mockDisk = OLDER;
    const lookup = load();
    await lookup.restorePersistedIndex();
    expect(mockClearSavedIndex).toHaveBeenCalled();
    expectInStep(lookup);
    expect(lookup.getSavedIndex()).toBeNull();
  });

  it('keeps the bundled index when nothing is saved', async () => {
    const lookup = load();
    await lookup.restorePersistedIndex();
    expect(lookup.getSavedIndex()).toBeNull();
    expect(mockClearSavedIndex).not.toHaveBeenCalled();
  });

  it('lets an adoption started while it reads land after it', async () => {
    const reading = deferred<Manifest>();
    mockLoadManifest.mockReturnValue(reading.promise);
    mockDisk = OLDER;
    const lookup = load();
    const restoring = lookup.restorePersistedIndex();
    const adopting = lookup.adoptRegistry(BYTES, 'import');
    reading.resolve(OLDER);
    await Promise.all([restoring, adopting]);
    expect(lookup.getSavedIndex()).toEqual({
      generatedAt: INDEX.generatedAt,
      source: 'import',
    });
    expectInStep(lookup);
  });

  it('leaves an adoption that ran first alone', async () => {
    const lookup = load();
    await lookup.adoptRegistry(BYTES, 'import');
    await lookup.restorePersistedIndex();
    expect(mockLoadManifest).not.toHaveBeenCalled();
    expectInStep(lookup);
  });
});

describe('revertToBundledIndex', () => {
  it('deletes the saved index and makes the bundled one the source', async () => {
    mockDisk = SAVED;
    const lookup = load();
    await lookup.restorePersistedIndex();
    await lookup.revertToBundledIndex();
    expect(mockClearSavedIndex).toHaveBeenCalled();
    expect(lookup.getSavedIndex()).toBeNull();
    expectInStep(lookup);
  });

  it('waits for a restore still reading, so it cannot bring the index back', async () => {
    const reading = deferred<Manifest>();
    mockLoadManifest.mockReturnValue(reading.promise);
    mockDisk = SAVED;
    const lookup = load();
    const restoring = lookup.restorePersistedIndex();
    const reverting = lookup.revertToBundledIndex();
    reading.resolve(SAVED);
    await Promise.all([restoring, reverting]);
    expect(lookup.getSavedIndex()).toBeNull();
    expectInStep(lookup);
  });

  it('lands after an adoption still saving, so the bundled index stays', async () => {
    const saving = deferred<void>();
    mockSaveGate = saving.promise;
    const lookup = load();
    const adopting = lookup.adoptRegistry(BYTES, 'download');
    const reverting = lookup.revertToBundledIndex();
    saving.resolve();
    await Promise.all([adopting, reverting]);
    expect(lookup.getSavedIndex()).toBeNull();
    expectInStep(lookup);
  });

  it('is replaced by an adoption started after it', async () => {
    mockDisk = SAVED;
    const lookup = load();
    await lookup.restorePersistedIndex();
    const clearing = deferred<void>();
    mockClearSavedIndex.mockImplementationOnce(async () => {
      await clearing.promise;
      mockDisk = null;
    });
    const reverting = lookup.revertToBundledIndex();
    const adopting = lookup.adoptRegistry(BYTES, 'import');
    clearing.resolve();
    await Promise.all([reverting, adopting]);
    expect(lookup.getSavedIndex()).toEqual({
      generatedAt: INDEX.generatedAt,
      source: 'import',
    });
    expectInStep(lookup);
  });
});

describe('adoptRegistry', () => {
  it('builds, saves and activates an index with descriptors', async () => {
    const lookup = load();
    expect(await lookup.adoptRegistry(BYTES, 'download')).toEqual({
      ok: true,
    });
    expect(mockProcess).toHaveBeenCalledWith(BYTES, {
      verified: BUNDLED_ATTESTATIONS,
    });
    expect(mockSaveIndex).toHaveBeenCalledWith(INDEX, 'download');
    expect(lookup.getSavedIndex()).toEqual({
      generatedAt: INDEX.generatedAt,
      source: 'download',
    });
  });

  it('refuses a registry with no descriptors and keeps the current index', async () => {
    mockProcess.mockReturnValue({ ...INDEX, contracts: {} });
    const lookup = load();
    expect(await lookup.adoptRegistry(BYTES, 'import')).toEqual({
      ok: false,
      reason: 'invalid',
      message: 'The file has no descriptors this app can read.',
    });
    expect(mockSaveIndex).not.toHaveBeenCalled();
    expect(lookup.getSavedIndex()).toBeNull();
  });

  it('refuses a file that is not a registry zip', async () => {
    mockProcess.mockImplementation(() => {
      throw new Error('not a zip');
    });
    const lookup = load();
    expect(await lookup.adoptRegistry(BYTES, 'import')).toEqual({
      ok: false,
      reason: 'invalid',
      message: 'not a zip',
    });
  });

  it('reports a failed save and keeps the current index', async () => {
    mockDisk = SAVED;
    mockSaveIndex.mockRejectedValueOnce(new Error('ENOSPC'));
    const lookup = load();
    await lookup.restorePersistedIndex();
    expect(await lookup.adoptRegistry(BYTES, 'import')).toEqual({
      ok: false,
      reason: 'unsaved',
      message: 'ENOSPC',
    });
    expect(lookup.getSavedIndex()?.generatedAt).toBe(SAVED.generatedAt);
    expectInStep(lookup);
  });

  it('falls back to the bundled index when a failed save removed the old one', async () => {
    mockDisk = SAVED;
    mockSaveIndex.mockImplementationOnce(async () => {
      mockDisk = null;
      throw new Error('rename failed');
    });
    const lookup = load();
    await lookup.restorePersistedIndex();
    expect(await lookup.adoptRegistry(BYTES, 'import')).toMatchObject({
      ok: false,
      reason: 'unsaved',
    });
    expect(lookup.getSavedIndex()).toBeNull();
    expectInStep(lookup);
  });
});
