import '@walletconnect/react-native-compat';

import { Core, RELAYER_EVENTS } from '@walletconnect/core';
import { WalletKit, WalletKitTypes } from '@reown/walletkit';

import { APP_NAME } from '@/constants/app';
import { loadWCProjectId } from '@/storage/walletConnect';

type Client = Awaited<ReturnType<typeof WalletKit.init>>;
type ClientListener = (client: Client) => (() => void) | void;

let _client: Client | null = null;
let _initPromise: Promise<Client> | null = null;
let _created = 0;
const _listeners = new Set<ClientListener>();
const _detach = new Map<ClientListener, () => void>();

function attach(listener: ClientListener, client: Client) {
  const detach = listener(client);
  if (detach) {
    _detach.set(listener, detach);
  }
}

function detachAll() {
  _detach.forEach(detach => detach());
  _detach.clear();
}

async function createClient(): Promise<Client> {
  const projectId = await loadWCProjectId();
  if (!projectId) {
    throw new Error('WalletConnect needs a Project ID. Enter one in Settings.');
  }

  const memoryStorage = new Map<string, string>();
  const core = new Core({
    projectId,
    // The SDK hands back its first Core for a prefix it has seen, old Project ID included.
    customStoragePrefix: `keycardpal-${++_created}`,
    // On by default; it posts each pairing's wc: URI to WalletConnect.
    telemetryEnabled: false,
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

  return WalletKit.init({
    core,
    metadata: {
      name: APP_NAME,
      description: 'Air-gapped hardware wallet companion',
      url: 'https://keycardpal.com',
      icons: [],
    },
  });
}

// Creating the client opens the relay connection, so nothing may call this
// before the user scans a wc: code (ADR-0003).
function getClient(): Promise<Client> {
  if (_initPromise) {
    return _initPromise;
  }
  const promise: Promise<Client> = createClient().then(
    client => {
      if (_initPromise === promise) {
        _client = client;
        _listeners.forEach(listener => attach(listener, client));
      }
      return client;
    },
    e => {
      if (_initPromise === promise) {
        _initPromise = null;
      }
      throw e;
    },
  );
  _initPromise = promise;
  return promise;
}

function refusalMessage(error: Error): string {
  const reason = /\(([^)]+)\)\s*$/.exec(error.message)?.[1];
  return `The WalletConnect relay refused the connection${
    reason ? ` (${reason})` : ''
  }. Check the Project ID in Settings.`;
}

// The relay refuses a Project ID by closing the socket with 3000, and the SDK's pair() then never settles.
function unlessRefused<T>(client: Client, work: Promise<T>): Promise<T> {
  const { relayer } = client.core;
  return new Promise<T>((resolve, reject) => {
    const onRefused = (error: Error) =>
      reject(new Error(refusalMessage(error)));
    relayer.once(RELAYER_EVENTS.error, onRefused);
    work
      .then(resolve, reject)
      .finally(() => relayer.off(RELAYER_EVENTS.error, onRefused));
  });
}

export type WCClientEventMap = WalletKitTypes.EventArguments;

export const wcClient = {
  getClient,
  /** Runs `listener` for the client once it exists, and again for each new one. */
  onClient: (listener: ClientListener) => {
    _listeners.add(listener);
    if (_client) {
      attach(listener, _client);
    }
    return () => {
      _listeners.delete(listener);
      _detach.get(listener)?.();
      _detach.delete(listener);
    };
  },
  pair: async (uri: string) => {
    const client = await getClient();
    await unlessRefused(client, client.pair({ uri }));
  },
  respondSuccess: async (id: number, topic: string, result: string) => {
    const client = await getClient();
    await client.respondSessionRequest({
      topic,
      response: { id, jsonrpc: '2.0', result },
    });
  },
  respondError: async (
    id: number,
    topic: string,
    code: number,
    message: string,
  ) => {
    const client = await getClient();
    await client.respondSessionRequest({
      topic,
      response: {
        id,
        jsonrpc: '2.0',
        error: { code, message },
      },
    });
  },
  disconnect: async (topic: string) => {
    const client = await getClient();
    await client.disconnectSession({
      topic,
      reason: { code: 6000, message: 'User disconnected' },
    });
  },
  resetClient: () => {
    detachAll();
    _client?.core.relayer.transportClose().catch(() => {});
    _client = null;
    _initPromise = null;
  },
};
