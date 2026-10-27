import type { ApplicationInfo } from 'keycard-sdk/dist/application-info';

// Not a root __mocks__ file: that would apply to every test.

type Listener = (...args: any[]) => unknown;
type BridgeEvent = 'connected' | 'disconnected' | 'cancelled' | 'timeout';

const listeners: Record<BridgeEvent, Set<Listener>> = {
  connected: new Set(),
  disconnected: new Set(),
  cancelled: new Set(),
  timeout: new Set(),
};

function subscribe(event: BridgeEvent, listener: Listener) {
  listeners[event].add(listener);
  return { remove: () => listeners[event].delete(listener) };
}

export const mockStartNFC = jest.fn();
// No message: the session's own teardown, not a success or an error.
export const mockStopNFC = jest.fn();
export const mockStopNFCWithMessage = jest.fn();
export const mockStopNFCWithError = jest.fn();
export const mockIsNFCEnabled = jest.fn();
export const mockOpenNFCSettings = jest.fn();
export const mockSetNFCMessage = jest.fn();

export const bridgeModule = {
  __esModule: true,
  default: {
    Core: {
      onKeycardConnected: (listener: Listener) =>
        subscribe('connected', listener),
      onKeycardDisconnected: (listener: Listener) =>
        subscribe('disconnected', listener),
      onNFCUserCancelled: (listener: Listener) =>
        subscribe('cancelled', listener),
      onNFCTimeout: (listener: Listener) => subscribe('timeout', listener),
      startNFC: (message: string) => mockStartNFC(message),
      stopNFC: (message?: string, isError?: boolean) =>
        isError
          ? mockStopNFCWithError(message)
          : message
          ? mockStopNFCWithMessage(message)
          : mockStopNFC(),
      isNFCEnabled: () => mockIsNFCEnabled(),
      openNFCSettings: () => mockOpenNFCSettings(),
      setNFCMessage: (message: string) => mockSetNFCMessage(message),
    },
    NFCCardChannel: class {},
  },
};

function fire(event: BridgeEvent, ...args: unknown[]): unknown[] {
  return [...listeners[event]].map(listener => listener(...args));
}

export async function tapCard(...args: unknown[]): Promise<void> {
  await Promise.all(fire('connected', ...args));
}

export function loseCard(): void {
  fire('disconnected');
}

export function cancelSheet(): void {
  fire('cancelled');
}

export function timeOut(): void {
  fire('timeout');
}

export type FakeCommandset = {
  applicationInfo?: ApplicationInfo | null | Record<string, unknown>;
  select: jest.Mock;
  [command: string]: unknown;
};

export function fakeCommandset(
  applicationInfo?: FakeCommandset['applicationInfo'],
  commands: Record<string, unknown> = {},
): FakeCommandset {
  return {
    applicationInfo,
    select: jest.fn().mockResolvedValue({ sw: 0x9000 }),
    ...commands,
  };
}

let inserted: object = fakeCommandset();

export function insertCard<T extends object>(card: T): T {
  inserted = card;
  return card;
}

export const mockCommandset: jest.Mock = jest.fn(() => inserted);

export function sdkModule(extra: Record<string, unknown> = {}) {
  return {
    __esModule: true,
    default: { Commandset: mockCommandset, ...extra },
  };
}

// Listeners from the last test's hooks must not answer this test's taps.
export function resetFakeCard(): void {
  for (const set of Object.values(listeners)) set.clear();
  mockStartNFC.mockReset().mockResolvedValue(undefined);
  mockStopNFC.mockReset().mockResolvedValue(undefined);
  mockStopNFCWithMessage.mockReset().mockResolvedValue(undefined);
  mockStopNFCWithError.mockReset().mockResolvedValue(undefined);
  mockIsNFCEnabled.mockReset().mockResolvedValue(true);
  mockOpenNFCSettings.mockReset().mockResolvedValue(true);
  mockSetNFCMessage.mockReset().mockResolvedValue(true);
  inserted = fakeCommandset();
  mockCommandset.mockReset().mockImplementation(() => inserted);
}
