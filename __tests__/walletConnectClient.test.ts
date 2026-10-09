const mockInit = jest.fn();
const mockCore = jest.fn();
const mockLoadWCProjectId = jest.fn();

jest.mock('@walletconnect/react-native-compat', () => ({}));
jest.mock('@walletconnect/core', () => ({
  Core: function Core(options: unknown) {
    mockCore(options);
  },
}));
jest.mock('@reown/walletkit', () => ({
  WalletKit: { init: (...args: unknown[]) => mockInit(...args) },
}));
jest.mock('../src/storage/walletConnect', () => ({
  loadWCProjectId: () => mockLoadWCProjectId(),
}));

function makeClient() {
  return {
    pair: jest.fn().mockResolvedValue(undefined),
    core: {
      relayer: { transportClose: jest.fn().mockResolvedValue(undefined) },
    },
  };
}

function loadClient() {
  let mod!: typeof import('../src/utils/walletConnect/client.online');
  jest.isolateModules(() => {
    mod = require('../src/utils/walletConnect/client.online');
  });
  return mod.wcClient;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadWCProjectId.mockResolvedValue('stored-id');
  mockInit.mockImplementation(async () => makeClient());
});

describe('wcClient', () => {
  it('creates nothing when it is loaded or subscribed to', async () => {
    const wcClient = loadClient();
    wcClient.onClient(jest.fn());
    await Promise.resolve();

    expect(mockLoadWCProjectId).not.toHaveBeenCalled();
    expect(mockCore).not.toHaveBeenCalled();
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('creates the client on pair(), with the Project ID from storage', async () => {
    const wcClient = loadClient();
    await wcClient.pair('wc:uri');

    expect(mockCore).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'stored-id' }),
    );
    const client = await wcClient.getClient();
    expect(client.pair).toHaveBeenCalledWith({ uri: 'wc:uri' });
  });

  it('refuses to start without a Project ID', async () => {
    mockLoadWCProjectId.mockResolvedValue('');
    const wcClient = loadClient();

    await expect(wcClient.pair('wc:uri')).rejects.toThrow(
      'WalletConnect needs a Project ID. Enter one in Settings.',
    );
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('creates one client for concurrent callers', async () => {
    const wcClient = loadClient();
    const [a, b] = await Promise.all([
      wcClient.getClient(),
      wcClient.getClient(),
    ]);

    expect(a).toBe(b);
    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  it('can try again after a failed start', async () => {
    mockInit.mockRejectedValueOnce(new Error('relay down'));
    const wcClient = loadClient();

    await expect(wcClient.getClient()).rejects.toThrow('relay down');
    await expect(wcClient.getClient()).resolves.toBeDefined();
    expect(mockInit).toHaveBeenCalledTimes(2);
  });

  it('keeps its storage in memory', async () => {
    const wcClient = loadClient();
    await wcClient.getClient();
    const { storage } = mockCore.mock.calls[0][0];

    await storage.setItem('k', 'v');
    expect(await storage.getItem('k')).toBe('v');
    expect(await storage.getKeys()).toEqual(['k']);
    await storage.removeItem('k');
    expect(await storage.getItem('k')).toBeUndefined();
  });

  describe('onClient', () => {
    it('runs the listener once the client exists', async () => {
      const wcClient = loadClient();
      const listener = jest.fn();
      wcClient.onClient(listener);
      expect(listener).not.toHaveBeenCalled();

      const client = await wcClient.getClient();
      expect(listener).toHaveBeenCalledWith(client);
    });

    it('runs a late listener for the client that already exists', async () => {
      const wcClient = loadClient();
      const client = await wcClient.getClient();
      const listener = jest.fn();
      wcClient.onClient(listener);

      expect(listener).toHaveBeenCalledWith(client);
    });

    it('detaches the listener when it unsubscribes', async () => {
      const wcClient = loadClient();
      const detach = jest.fn();
      const unsubscribe = wcClient.onClient(() => detach);
      await wcClient.getClient();

      unsubscribe();
      expect(detach).toHaveBeenCalledTimes(1);

      wcClient.resetClient();
      await wcClient.getClient();
      expect(detach).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetClient', () => {
    it('uses the new Project ID for the next client', async () => {
      const wcClient = loadClient();
      await wcClient.getClient();

      mockLoadWCProjectId.mockResolvedValue('new-id');
      wcClient.resetClient();
      await wcClient.getClient();

      expect(mockCore).toHaveBeenLastCalledWith(
        expect.objectContaining({ projectId: 'new-id' }),
      );
    });

    it('detaches listeners from the old client and attaches them to the new one', async () => {
      const wcClient = loadClient();
      const detach = jest.fn();
      const listener = jest.fn(() => detach);
      wcClient.onClient(listener);
      const first = await wcClient.getClient();

      wcClient.resetClient();
      expect(detach).toHaveBeenCalledTimes(1);
      expect(first.core.relayer.transportClose).toHaveBeenCalled();

      const second = await wcClient.getClient();
      expect(second).not.toBe(first);
      expect(listener).toHaveBeenLastCalledWith(second);
    });

    it('ignores a client whose start was overtaken by a reset', async () => {
      let release!: (client: unknown) => void;
      mockInit.mockImplementationOnce(
        () => new Promise(resolve => (release = resolve)),
      );
      const wcClient = loadClient();
      const listener = jest.fn();
      wcClient.onClient(listener);

      const stale = wcClient.getClient();
      await Promise.resolve();
      await Promise.resolve();
      wcClient.resetClient();
      release(makeClient());
      await stale;

      expect(listener).not.toHaveBeenCalled();
    });

    it('is harmless before any client exists', () => {
      expect(() => loadClient().resetClient()).not.toThrow();
    });
  });

  describe('session calls', () => {
    it('answers a request with a result or an error, and disconnects', async () => {
      const client = {
        ...makeClient(),
        respondSessionRequest: jest.fn().mockResolvedValue(undefined),
        disconnectSession: jest.fn().mockResolvedValue(undefined),
      };
      mockInit.mockResolvedValue(client);
      const wcClient = loadClient();

      await wcClient.respondSuccess(1, 'topic', '0xsig');
      expect(client.respondSessionRequest).toHaveBeenLastCalledWith({
        topic: 'topic',
        response: { id: 1, jsonrpc: '2.0', result: '0xsig' },
      });

      await wcClient.respondError(2, 'topic', 4001, 'Rejected');
      expect(client.respondSessionRequest).toHaveBeenLastCalledWith({
        topic: 'topic',
        response: {
          id: 2,
          jsonrpc: '2.0',
          error: { code: 4001, message: 'Rejected' },
        },
      });

      await wcClient.disconnect('topic');
      expect(client.disconnectSession).toHaveBeenCalledWith({
        topic: 'topic',
        reason: { code: 6000, message: 'User disconnected' },
      });
    });
  });
});
