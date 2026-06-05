import '@walletconnect/react-native-compat';

import { Core } from '@walletconnect/core';
import { WalletKit, WalletKitTypes } from '@reown/walletkit';

import { APP_NAME } from '@/constants/app';
import { WC_PROJECT_ID } from '@/utils/buildConfig';

let _client: Awaited<ReturnType<typeof WalletKit.init>> | null = null;
let _initPromise: Promise<Awaited<ReturnType<typeof WalletKit.init>>> | null =
  null;

async function getClient(
  projectIdOverride?: string,
): Promise<Awaited<ReturnType<typeof WalletKit.init>>> {
  if (_client) {
    return _client;
  }
  if (_initPromise) {
    return _initPromise;
  }
  const projectId = projectIdOverride ?? WC_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      'WalletConnect Project ID is not configured. Set WC_PROJECT_ID in build environment or override it in Settings.',
    );
  }

  const memoryStorage = new Map<string, string>();
  const core = new Core({
    projectId,
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

  _initPromise = WalletKit.init({
    core,
    metadata: {
      name: APP_NAME,
      description: 'Air-gapped hardware wallet companion',
      url: 'https://keycardpal.com',
      icons: [],
    },
  }).catch(e => {
    _initPromise = null;
    throw e;
  });

  _client = await _initPromise;
  return _client;
}

export type WCClientEventMap = WalletKitTypes.EventArguments;

export const wcClient = {
  getClient,
  pair: async (uri: string, projectIdOverride?: string) => {
    const client = await getClient(projectIdOverride);
    await client.pair({ uri });
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
    _client = null;
    _initPromise = null;
  },
};
