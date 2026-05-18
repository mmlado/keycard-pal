import React from 'react';
import { AppState } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';

// ── Module-level captured state (accessible inside jest.mock closures) ────────

type EventHandler = (...args: any[]) => void;
const capturedHandlers: Record<string, EventHandler> = {};

const mockOn = jest.fn((event: string, handler: EventHandler) => {
  capturedHandlers[event] = handler;
});
const mockOff = jest.fn();
const mockApproveSession = jest.fn();
const mockRejectSession = jest.fn().mockResolvedValue(undefined);
const mockRespondSuccess = jest.fn().mockResolvedValue(undefined);
const mockRespondError = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);
const mockPair = jest.fn().mockResolvedValue(undefined);
const mockGetClient = jest.fn();
let mockNavigationReady = true;
const mockNavigate = jest.fn();
let capturedAppStateHandler: ((next: any) => void) | null = null;

jest.mock('../src/utils/walletConnect/client.online', () => ({
  wcClient: {
    getClient: (...args: unknown[]) => mockGetClient(...args),
    pair: (...args: unknown[]) => mockPair(...args),
    respondSuccess: (...args: unknown[]) => mockRespondSuccess(...args),
    respondError: (...args: unknown[]) => mockRespondError(...args),
    disconnect: (...args: unknown[]) => mockDisconnect(...args),
  },
}));

jest.mock('../src/navigation/navigationRef', () => ({
  navigationRef: { isReady: () => mockNavigationReady, navigate: mockNavigate },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { WalletConnectProvider } from '../src/providers/walletConnect/Provider.online';
import { navigationRef } from '../src/navigation/navigationRef';
import { useWalletConnectSession } from '../src/hooks/useWalletConnectSession.online';

function wrapper({ children }: { children: React.ReactNode }) {
  return <WalletConnectProvider>{children}</WalletConnectProvider>;
}

function makeFakeClient() {
  return {
    on: mockOn,
    off: mockOff,
    approveSession: mockApproveSession,
    rejectSession: mockRejectSession,
  };
}

async function waitForClientInit() {
  await act(async () => {
    await Promise.resolve();
  });
}

const signerAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const signerPath = "m/44'/60'/0'/0/0";

async function approveTestSession(result: any) {
  await act(async () => {
    capturedHandlers.session_proposal?.({
      id: 42,
      params: {
        id: 42,
        expiryTimestamp: 0,
        proposer: {
          metadata: { name: 'dApp', url: 'https://dapp.io', icons: [] },
        },
        requiredNamespaces: {
          eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
        },
        optionalNamespaces: {},
      },
    });
  });
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await result.current.approveSession(signerAddress, signerPath);
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(capturedHandlers).forEach(k => delete capturedHandlers[k]);

  mockApproveSession.mockResolvedValue({
    topic: 'approved-topic',
    peer: { metadata: { name: 'dApp', url: 'https://dapp.io', icons: [] } },
    namespaces: { eip155: { accounts: ['eip155:1:0xabc'] } },
  });
  mockGetClient.mockResolvedValue(makeFakeClient());
  mockNavigationReady = true;
  (navigationRef as any).isReady = jest.fn(() => mockNavigationReady);
  (navigationRef as any).navigate = mockNavigate;
  capturedAppStateHandler = null;

  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, handler) => {
      capturedAppStateHandler = handler as any;
      return { remove: jest.fn() } as any;
    });
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
    writable: true,
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WalletConnectProvider — initial state', () => {
  it('starts in idle phase', async () => {
    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();
    expect(result.current.phase).toBe('idle');
    expect(result.current.activeSession).toBeNull();
    expect(result.current.pendingRequest).toBeNull();
  });
});

describe('WalletConnectProvider — pairing', () => {
  it('sets phase to pairing when pair() is called', async () => {
    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();

    await act(async () => {
      result.current.pair('wc:test-uri');
    });

    expect(mockPair).toHaveBeenCalledWith('wc:test-uri');
    expect(result.current.phase).toBe('pairing');
  });

  it('transitions to proposal phase when session_proposal fires', async () => {
    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();

    const fakeProposal = {
      id: 1,
      params: {
        id: 1,
        proposer: {
          metadata: { name: 'dApp', url: 'https://dapp.io', icons: [] },
        },
        requiredNamespaces: {
          eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
        },
        optionalNamespaces: {},
      },
    };

    await act(async () => {
      capturedHandlers.session_proposal?.(fakeProposal);
    });

    expect(result.current.phase).toEqual({
      kind: 'proposal',
      proposal: fakeProposal,
    });
  });
});

describe('WalletConnectProvider — approveSession', () => {
  async function setupProposal(
    requiredNamespaces: Record<
      string,
      { chains?: string[]; methods?: string[] }
    > = {
      eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
    },
    optionalNamespaces: Record<
      string,
      { chains?: string[]; methods?: string[] }
    > = {},
  ) {
    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();

    const fakeProposal = {
      id: 42,
      params: {
        id: 42,
        proposer: {
          metadata: { name: 'dApp', url: 'https://dapp.io', icons: [] },
        },
        requiredNamespaces,
        optionalNamespaces,
      },
    };

    await act(async () => {
      capturedHandlers.session_proposal?.(fakeProposal);
    });

    return { result, fakeProposal };
  }

  it('approves session with intersection chains and transitions to active', async () => {
    const { result } = await setupProposal({
      eip155: {
        chains: ['eip155:1', 'eip155:137'],
        methods: ['personal_sign'],
      },
    });

    await act(async () => {
      await result.current.approveSession('0xabc', "m/44'/60'/0'/0/0");
    });

    expect(mockApproveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 42,
        namespaces: expect.objectContaining({
          eip155: expect.objectContaining({
            chains: expect.arrayContaining(['eip155:1', 'eip155:137']),
            accounts: expect.arrayContaining([
              'eip155:1:0xabc',
              'eip155:137:0xabc',
            ]),
          }),
        }),
      }),
    );
    expect(result.current.phase).toEqual(
      expect.objectContaining({ kind: 'active' }),
    );
  });

  it('approves all supported chains and methods when proposal omits them', async () => {
    const { result } = await setupProposal({ eip155: {} });

    await act(async () => {
      await result.current.approveSession('0xabc', "m/44'/60'/0'/0/0");
    });

    expect(mockApproveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        namespaces: expect.objectContaining({
          eip155: expect.objectContaining({
            chains: expect.arrayContaining(['eip155:1', 'eip155:137']),
            methods: expect.arrayContaining(['personal_sign']),
          }),
        }),
      }),
    );
  });

  it('rejects session when intersection is empty', async () => {
    const { result } = await setupProposal({
      eip155: { chains: ['eip155:56'], methods: ['personal_sign'] },
    }); // BSC not supported

    await act(async () => {
      await result.current.approveSession('0xabc', "m/44'/60'/0'/0/0");
    });

    expect(mockRejectSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42 }),
    );
    expect(result.current.phase).toEqual(
      expect.objectContaining({ kind: 'error' }),
    );
  });

  it('rejects session when a required namespace is unsupported', async () => {
    const { result } = await setupProposal({
      cosmos: { chains: ['cosmos:cosmoshub-4'], methods: [] },
      eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
    });

    await act(async () => {
      await result.current.approveSession('0xabc', "m/44'/60'/0'/0/0");
    });

    expect(mockRejectSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 42,
        reason: expect.objectContaining({
          message: expect.stringContaining('cosmos'),
        }),
      }),
    );
    expect(result.current.phase).toEqual(
      expect.objectContaining({
        kind: 'error',
        message: expect.stringContaining('cosmos'),
      }),
    );
  });

  it('rejects session when a required method is unsupported', async () => {
    const { result } = await setupProposal({
      eip155: {
        chains: ['eip155:1'],
        methods: ['eth_sendTransaction'],
      },
    });

    await act(async () => {
      await result.current.approveSession('0xabc', "m/44'/60'/0'/0/0");
    });

    expect(mockRejectSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 42,
        reason: expect.objectContaining({
          message: expect.stringContaining('eth_sendTransaction'),
        }),
      }),
    );
    expect(result.current.phase).toEqual(
      expect.objectContaining({
        kind: 'error',
        message: expect.stringContaining('eth_sendTransaction'),
      }),
    );
  });
});

describe('WalletConnectProvider — session_request', () => {
  it('sets pendingRequest for supported method when app is active', async () => {
    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();
    await approveTestSession(result);

    await act(async () => {
      await capturedHandlers.session_request?.({
        id: 99,
        topic: 'test-topic',
        params: {
          request: {
            method: 'personal_sign',
            params: ['0xdeadbeef', signerAddress],
          },
        },
      });
    });

    expect(result.current.pendingRequest).toMatchObject({
      id: 99,
      topic: 'test-topic',
      method: 'personal_sign',
    });
    expect(mockRespondError).not.toHaveBeenCalled();
  });

  it('rejects unsupported method immediately', async () => {
    renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();

    await act(async () => {
      await capturedHandlers.session_request?.({
        id: 100,
        topic: 'test-topic',
        params: { request: { method: 'eth_sendTransaction', params: [] } },
      });
    });

    expect(mockRespondError).toHaveBeenCalledWith(
      100,
      'test-topic',
      -32601,
      expect.stringContaining('eth_sendTransaction'),
    );
  });

  it('rejects second request when busy', async () => {
    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();
    await approveTestSession(result);

    await act(async () => {
      await capturedHandlers.session_request?.({
        id: 1,
        topic: 'topic1',
        params: {
          request: {
            method: 'personal_sign',
            params: ['0xdeadbeef', signerAddress],
          },
        },
      });
    });

    mockRespondError.mockClear();

    await act(async () => {
      await capturedHandlers.session_request?.({
        id: 2,
        topic: 'topic2',
        params: { request: { method: 'personal_sign', params: [] } },
      });
    });

    expect(mockRespondError).toHaveBeenCalledWith(
      2,
      'topic2',
      -32000,
      'Wallet is busy',
    );
  });

  it('rejects request when app is in background', async () => {
    Object.defineProperty(AppState, 'currentState', {
      value: 'background',
      configurable: true,
      writable: true,
    });

    renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();

    await act(async () => {
      await capturedHandlers.session_request?.({
        id: 5,
        topic: 'topic',
        params: { request: { method: 'personal_sign', params: [] } },
      });
    });

    expect(mockRespondError).toHaveBeenCalledWith(
      5,
      'topic',
      -32000,
      'Wallet is not active',
    );
  });

  it('uses AppState change events to reject background requests', async () => {
    renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();

    act(() => {
      capturedAppStateHandler?.('background');
    });

    await act(async () => {
      await capturedHandlers.session_request?.({
        id: 7,
        topic: 'topic',
        params: { request: { method: 'personal_sign', params: [] } },
      });
    });

    expect(mockRespondError).toHaveBeenCalledWith(
      7,
      'topic',
      -32000,
      'Wallet is not active',
    );
  });

  it('rejects and clears pending request when navigation is not ready', async () => {
    mockNavigationReady = false;
    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();
    await approveTestSession(result);

    await act(async () => {
      await capturedHandlers.session_request?.({
        id: 6,
        topic: 'topic',
        params: {
          request: {
            method: 'personal_sign',
            params: ['0xdeadbeef', signerAddress],
          },
        },
      });
    });

    expect(mockRespondError).toHaveBeenCalledWith(
      6,
      'topic',
      -32000,
      'Wallet not ready',
    );
    expect(result.current.pendingRequest).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('WalletConnectProvider — respondSuccess / respondError', () => {
  it('respondSuccess calls wcClient and clears pendingRequest', async () => {
    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();
    await approveTestSession(result);

    await act(async () => {
      await capturedHandlers.session_request?.({
        id: 77,
        topic: 'topic-x',
        params: {
          request: {
            method: 'personal_sign',
            params: ['0xdeadbeef', signerAddress],
          },
        },
      });
    });

    await act(async () => {
      await result.current.respondSuccess(
        { id: 77, topic: 'topic-x' },
        '0xsig',
      );
    });

    expect(mockRespondSuccess).toHaveBeenCalledWith(77, 'topic-x', '0xsig');
    expect(result.current.pendingRequest).toBeNull();
  });

  it('respondSuccess is idempotent — second call ignored', async () => {
    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();
    await approveTestSession(result);

    await act(async () => {
      await capturedHandlers.session_request?.({
        id: 88,
        topic: 'topic-y',
        params: {
          request: {
            method: 'personal_sign',
            params: ['0xdeadbeef', signerAddress],
          },
        },
      });
    });

    await act(async () => {
      await result.current.respondSuccess(
        { id: 88, topic: 'topic-y' },
        '0xsig',
      );
    });
    await act(async () => {
      await result.current.respondSuccess(
        { id: 88, topic: 'topic-y' },
        '0xsig2',
      );
    });

    expect(mockRespondSuccess).toHaveBeenCalledTimes(1);
  });

  it('respondError calls wcClient, clears pendingRequest, and is idempotent', async () => {
    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();
    await approveTestSession(result);

    await act(async () => {
      await capturedHandlers.session_request?.({
        id: 77,
        topic: 'topic-x',
        params: {
          request: {
            method: 'personal_sign',
            params: ['0xdeadbeef', signerAddress],
          },
        },
      });
    });

    await act(async () => {
      await result.current.respondError(
        { id: 77, topic: 'topic-x' },
        4001,
        'User rejected',
      );
    });
    await act(async () => {
      await result.current.respondError(
        { id: 77, topic: 'topic-x' },
        4001,
        'User rejected again',
      );
    });

    expect(mockRespondError).toHaveBeenCalledTimes(1);
    expect(mockRespondError).toHaveBeenCalledWith(
      77,
      'topic-x',
      4001,
      'User rejected',
    );
    expect(result.current.pendingRequest).toBeNull();
  });
});

describe('WalletConnectProvider — session_delete', () => {
  it('clears session and resets to idle on session_delete', async () => {
    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();

    const fakeProposal = {
      id: 1,
      params: {
        id: 1,
        proposer: {
          metadata: { name: 'dApp', url: 'https://dapp.io', icons: [] },
        },
        requiredNamespaces: {
          eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
        },
        optionalNamespaces: {},
      },
    };

    await act(async () => {
      capturedHandlers.session_proposal?.(fakeProposal);
    });
    await act(async () => {
      await result.current.approveSession('0xabc', "m/44'/60'/0'/0/0");
    });
    expect(result.current.activeSession).not.toBeNull();

    await act(async () => {
      capturedHandlers.session_delete?.();
    });

    expect(result.current.activeSession).toBeNull();
    expect(result.current.phase).toBe('idle');
    expect(result.current.pendingRequest).toBeNull();
  });
});

describe('WalletConnectProvider — session_request invalid params', () => {
  it('responds with -32602 when wcRequestToScanResult throws', async () => {
    renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();

    await act(async () => {
      await capturedHandlers.session_request?.({
        id: 55,
        topic: 'topic-bad',
        params: { request: { method: 'personal_sign', params: [] } },
      });
    });

    expect(mockRespondError).toHaveBeenCalledWith(
      55,
      'topic-bad',
      -32602,
      'Invalid params',
    );
  });
});

describe('WalletConnectProvider — approveSession edge cases', () => {
  it('is a no-op when phase is not proposal', async () => {
    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();

    await act(async () => {
      await result.current.approveSession('0xabc', "m/44'/60'/0'/0/0");
    });

    expect(mockApproveSession).not.toHaveBeenCalled();
  });

  it('sets error phase with friendly message when proposal has expired', async () => {
    mockApproveSession.mockRejectedValueOnce(
      new Error("proposal id doesn't exist"),
    );

    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();

    const fakeProposal = {
      id: 99,
      params: {
        id: 99,
        proposer: { metadata: { name: 'dApp', url: '', icons: [] } },
        requiredNamespaces: {
          eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
        },
        optionalNamespaces: {},
      },
    };

    await act(async () => {
      capturedHandlers.session_proposal?.(fakeProposal);
    });
    await act(async () => {
      await result.current.approveSession('0xabc', "m/44'/60'/0'/0/0");
    });

    expect(result.current.phase).toEqual(
      expect.objectContaining({
        kind: 'error',
        message: expect.stringContaining('expired'),
      }),
    );
  });

  it('sets error phase with friendly message when WalletConnect reports no matching key', async () => {
    mockApproveSession.mockRejectedValueOnce(new Error('No matching key'));

    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();

    const fakeProposal = {
      id: 101,
      params: {
        id: 101,
        proposer: { metadata: { name: 'dApp', url: '', icons: [] } },
        requiredNamespaces: {
          eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
        },
        optionalNamespaces: {},
      },
    };

    await act(async () => {
      capturedHandlers.session_proposal?.(fakeProposal);
    });
    await act(async () => {
      await result.current.approveSession('0xabc', "m/44'/60'/0'/0/0");
    });

    expect(result.current.phase).toEqual(
      expect.objectContaining({
        kind: 'error',
        message: expect.stringContaining('expired'),
      }),
    );
  });

  it('rejects pending request and disconnects active session before approving a replacement', async () => {
    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();
    await approveTestSession(result);

    await act(async () => {
      await capturedHandlers.session_request?.({
        id: 123,
        topic: 'request-topic',
        params: {
          request: {
            method: 'personal_sign',
            params: ['0xdeadbeef', signerAddress],
          },
        },
      });
    });
    expect(result.current.pendingRequest).toMatchObject({ id: 123 });

    await act(async () => {
      capturedHandlers.session_proposal?.({
        id: 100,
        params: {
          id: 100,
          expiryTimestamp: 0,
          proposer: {
            metadata: {
              name: 'Replacement dApp',
              url: 'https://replacement.example',
              icons: [],
            },
          },
          requiredNamespaces: {
            eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
          },
          optionalNamespaces: {},
        },
      });
    });

    await act(async () => {
      await result.current.approveSession('0xdef', "m/44'/60'/0'/0/1");
    });

    expect(mockRespondError).toHaveBeenCalledWith(
      123,
      'request-topic',
      -32000,
      'Wallet session replaced',
    );
    expect(mockDisconnect).toHaveBeenCalledWith('approved-topic');
    expect(result.current.pendingRequest).toBeNull();
  });

  it('disconnects active session before approving a replacement with no pending request', async () => {
    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();
    await approveTestSession(result);
    mockDisconnect.mockClear();
    mockRespondError.mockClear();

    await act(async () => {
      capturedHandlers.session_proposal?.({
        id: 101,
        params: {
          id: 101,
          expiryTimestamp: 0,
          proposer: {
            metadata: {
              name: 'Replacement dApp',
              url: 'https://replacement.example',
              icons: [],
            },
          },
          requiredNamespaces: {
            eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
          },
          optionalNamespaces: {},
        },
      });
    });

    await act(async () => {
      await result.current.approveSession('0xdef', "m/44'/60'/0'/0/1");
    });

    expect(mockDisconnect).toHaveBeenCalledWith('approved-topic');
    expect(mockRespondError).not.toHaveBeenCalled();
  });
});

describe('WalletConnectProvider — rejectSession', () => {
  it('goes to idle when no active session', async () => {
    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();

    const fakeProposal = {
      id: 5,
      params: {
        id: 5,
        proposer: { metadata: { name: 'dApp', url: '', icons: [] } },
        requiredNamespaces: {
          eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
        },
        optionalNamespaces: {},
      },
    };

    await act(async () => {
      capturedHandlers.session_proposal?.(fakeProposal);
    });
    await act(async () => {
      await result.current.rejectSession(fakeProposal as any);
    });

    expect(mockRejectSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5 }),
    );
    expect(result.current.phase).toBe('idle');
  });

  it('restores active phase when rejecting a new proposal over an active session', async () => {
    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();
    await approveTestSession(result);

    const fakeProposal = {
      id: 6,
      params: {
        id: 6,
        proposer: { metadata: { name: 'dApp2', url: '', icons: [] } },
        requiredNamespaces: {
          eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
        },
        optionalNamespaces: {},
      },
    };

    await act(async () => {
      capturedHandlers.session_proposal?.(fakeProposal);
    });
    await act(async () => {
      await result.current.rejectSession(fakeProposal as any);
    });

    expect(result.current.phase).toEqual(
      expect.objectContaining({ kind: 'active' }),
    );
  });
});

describe('WalletConnectProvider — pair failure', () => {
  it('sets error phase when pair throws', async () => {
    mockPair.mockRejectedValueOnce(new Error('Pairing failed'));
    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();

    await act(async () => {
      await result.current.pair('wc:bad-uri');
    });

    expect(result.current.phase).toEqual(
      expect.objectContaining({ kind: 'error', message: 'Pairing failed' }),
    );
  });

  it('uses fallback error when pair throws a non-Error value', async () => {
    mockPair.mockRejectedValueOnce('bad pairing');
    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();

    await act(async () => {
      await result.current.pair('wc:bad-uri');
    });

    expect(result.current.phase).toEqual(
      expect.objectContaining({ kind: 'error', message: 'Pairing failed' }),
    );
  });
});

describe('WalletConnectProvider — disconnect', () => {
  it('is a no-op when no session is active', async () => {
    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();

    await act(async () => {
      await result.current.disconnect();
    });

    expect(mockDisconnect).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
  });

  it('resets to idle and clears session on disconnect', async () => {
    const { result } = renderHook(() => useWalletConnectSession(), { wrapper });
    await waitForClientInit();

    const fakeProposal = {
      id: 1,
      params: {
        id: 1,
        proposer: {
          metadata: { name: 'dApp', url: 'https://dapp.io', icons: [] },
        },
        requiredNamespaces: {
          eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
        },
        optionalNamespaces: {},
      },
    };

    await act(async () => {
      capturedHandlers.session_proposal?.(fakeProposal);
    });
    await act(async () => {
      await result.current.approveSession('0xabc', "m/44'/60'/0'/0/0");
    });

    expect(result.current.activeSession).not.toBeNull();

    await act(async () => {
      await result.current.disconnect();
    });

    expect(mockDisconnect).toHaveBeenCalled();
    expect(result.current.activeSession).toBeNull();
    expect(result.current.phase).toBe('idle');
  });
});
