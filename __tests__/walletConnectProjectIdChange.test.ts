const mockLoadWCProjectId = jest.fn();

jest.mock('@walletconnect/react-native-compat', () => ({}));
jest.mock('@reown/walletkit', () => ({
  WalletKit: {
    init: async ({ core }: { core: unknown }) => ({
      core,
      pair: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));
jest.mock('../src/storage/walletConnect', () => ({
  loadWCProjectId: () => mockLoadWCProjectId(),
}));

import { wcClient } from '../src/utils/walletConnect/client.online';

// The real Core, whose constructor hands back a cached instance.
describe('a Project ID saved in Settings', () => {
  it('is the one the next client uses, without a restart', async () => {
    mockLoadWCProjectId.mockResolvedValue('first-id');
    const first = await wcClient.getClient();

    mockLoadWCProjectId.mockResolvedValue('second-id');
    wcClient.resetClient();
    const second = await wcClient.getClient();

    expect(first.core.projectId).toBe('first-id');
    expect(second.core.projectId).toBe('second-id');
    expect(second.core).not.toBe(first.core);
  });
});
