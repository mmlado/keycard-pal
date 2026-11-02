import { Core } from '@walletconnect/core';

function makeCore(telemetryEnabled: boolean) {
  const memoryStorage = new Map<string, string>();
  return new Core({
    projectId: 'test-project',
    telemetryEnabled,
    storage: {
      getItem: async (key: string) => memoryStorage.get(key) ?? undefined,
      setItem: async (key: string, value: string) => {
        memoryStorage.set(key, value);
      },
      removeItem: async (key: string) => {
        memoryStorage.delete(key);
      },
      getKeys: async () => [...memoryStorage.keys()],
    } as any,
  });
}

// WalletKit calls eventClient.init() on every client it creates.
describe('WalletConnect event client', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;

  // A second `new Core` otherwise returns the first one, telemetry setting included.
  beforeAll(() => {
    process.env.DISABLE_GLOBAL_CORE = 'true';
  });

  afterAll(() => {
    delete process.env.DISABLE_GLOBAL_CORE;
  });

  beforeEach(() => {
    fetchMock = jest.fn(async () => ({ ok: true }));
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('sends its INIT event with telemetry on', async () => {
    const core = makeCore(true);
    await core.crypto.init();
    await core.eventClient.init();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      'pulse.walletconnect.org',
    );
  });

  it('sends nothing with telemetry off', async () => {
    const core = makeCore(false);
    await core.crypto.init();
    await core.eventClient.init();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
