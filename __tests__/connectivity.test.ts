// The netinfo mock must exist before connectivity.online is evaluated, since
// that module calls NetInfo.configure at load; jest.mock is hoisted above the
// imports, so declaring the jest.fn()s inside the factory keeps them out of
// the temporal dead zone.
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    fetch: jest.fn(),
    addEventListener: jest.fn(),
  },
}));

import NetInfo from '@react-native-community/netinfo';

import * as offline from '../src/utils/connectivity.offline';
import * as online from '../src/utils/connectivity.online';

const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;

type Listener = (state: { isConnected: boolean | null }) => void;

function stateWith(isConnected: boolean | null) {
  return { isConnected } as any;
}

describe('connectivity.online', () => {
  // Runs first: the snapshot is only "unknown" before any fetch or event.
  it('assumes connected before the first OS event', () => {
    expect(online.getNetworkConnected()).toBe(true);
  });

  it("switches NetInfo's reachability probe off at module load", () => {
    expect(mockNetInfo.configure).toHaveBeenCalledTimes(1);
    const config = mockNetInfo.configure.mock.calls[0][0];
    expect(config.reachabilityShouldRun?.()).toBe(false);
  });

  describe('isNetworkConnected', () => {
    beforeEach(() => {
      mockNetInfo.fetch.mockReset();
    });

    it('is true when the OS reports a connection', async () => {
      mockNetInfo.fetch.mockResolvedValue(stateWith(true));
      await expect(online.isNetworkConnected()).resolves.toBe(true);
    });

    it('is false when the OS reports no connection', async () => {
      mockNetInfo.fetch.mockResolvedValue(stateWith(false));
      await expect(online.isNetworkConnected()).resolves.toBe(false);
    });

    it('treats an unknown state as disconnected', async () => {
      mockNetInfo.fetch.mockResolvedValue(stateWith(null));
      await expect(online.isNetworkConnected()).resolves.toBe(false);
    });

    it('treats a NetInfo failure as disconnected, snapshot included', async () => {
      mockNetInfo.fetch.mockResolvedValue(stateWith(true));
      await online.isNetworkConnected();
      expect(online.getNetworkConnected()).toBe(true);

      mockNetInfo.fetch.mockRejectedValue(new Error('no native module'));
      await expect(online.isNetworkConnected()).resolves.toBe(false);
      expect(online.getNetworkConnected()).toBe(false);
    });

    it('updates the synchronous snapshot', async () => {
      mockNetInfo.fetch.mockResolvedValue(stateWith(false));
      await online.isNetworkConnected();
      expect(online.getNetworkConnected()).toBe(false);

      mockNetInfo.fetch.mockResolvedValue(stateWith(true));
      await online.isNetworkConnected();
      expect(online.getNetworkConnected()).toBe(true);
    });
  });

  describe('subscribeNetworkConnected', () => {
    let listener: Listener | undefined;
    const unsubscribe = jest.fn();

    beforeEach(() => {
      listener = undefined;
      unsubscribe.mockClear();
      mockNetInfo.addEventListener.mockReset();
      mockNetInfo.addEventListener.mockImplementation((fn: any) => {
        listener = fn;
        return unsubscribe;
      });
    });

    it('notifies on change and exposes the new state through the snapshot', () => {
      const onChange = jest.fn();
      online.subscribeNetworkConnected(onChange);

      listener!(stateWith(false));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(online.getNetworkConnected()).toBe(false);

      listener!(stateWith(true));
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(online.getNetworkConnected()).toBe(true);
    });

    it("returns NetInfo's unsubscribe", () => {
      const off = online.subscribeNetworkConnected(jest.fn());
      off();
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});

describe('connectivity.offline', () => {
  it('always reports disconnected', async () => {
    expect(offline.getNetworkConnected()).toBe(false);
    await expect(offline.isNetworkConnected()).resolves.toBe(false);
  });

  it('returns a no-op unsubscribe', () => {
    // Fewer parameters than the online twin is fine for the parity guard;
    // useSyncExternalStore still passes its onChange, which is ignored.
    const off = offline.subscribeNetworkConnected();
    expect(() => off()).not.toThrow();
  });
});
