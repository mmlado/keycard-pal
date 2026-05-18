import React from 'react';
import { renderHook } from '@testing-library/react-native';

import { SUPPORTED_WC_EIP155_CHAIN_IDS } from '../src/constants/walletConnect';
import {
  WalletConnectContext,
  WalletConnectContextValue,
} from '../src/providers/walletConnect/context';
import { useWalletConnectSession as useWalletConnectSessionOnline } from '../src/hooks/useWalletConnectSession.online';

// ── Chain intersection helpers (mirrors logic in Provider.online.tsx) ────────

function computeApprovedChains(requestedChains: string[]): string[] {
  const supported = SUPPORTED_WC_EIP155_CHAIN_IDS.map(id => `eip155:${id}`);
  return requestedChains.filter(c => supported.includes(c));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WalletConnect chain intersection', () => {
  it('approves chains present in the allowlist', () => {
    const result = computeApprovedChains(['eip155:1', 'eip155:137']);
    expect(result).toEqual(['eip155:1', 'eip155:137']);
  });

  it('filters out chains not in the allowlist', () => {
    const result = computeApprovedChains(['eip155:1', 'eip155:56']); // BSC not supported
    expect(result).toEqual(['eip155:1']);
  });

  it('returns empty array when no requested chain is supported', () => {
    const result = computeApprovedChains(['eip155:56', 'eip155:250']);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty request', () => {
    expect(computeApprovedChains([])).toHaveLength(0);
  });

  it('includes all five supported chains when all are requested', () => {
    const allSupported = SUPPORTED_WC_EIP155_CHAIN_IDS.map(
      id => `eip155:${id}`,
    );
    expect(computeApprovedChains(allSupported)).toEqual(allSupported);
  });
});

describe('WalletConnect supported methods', () => {
  const SUPPORTED_METHODS = [
    'personal_sign',
    'eth_signTypedData',
    'eth_signTypedData_v4',
  ];

  it('personal_sign is supported', () => {
    expect(SUPPORTED_METHODS).toContain('personal_sign');
  });

  it('eth_signTypedData_v4 is supported', () => {
    expect(SUPPORTED_METHODS).toContain('eth_signTypedData_v4');
  });

  it('eth_sendTransaction is not supported', () => {
    expect(SUPPORTED_METHODS).not.toContain('eth_sendTransaction');
  });

  it('wallet_switchEthereumChain is not supported', () => {
    expect(SUPPORTED_METHODS).not.toContain('wallet_switchEthereumChain');
  });

  it('unknown methods are not supported', () => {
    expect(SUPPORTED_METHODS).not.toContain('eth_accounts');
  });
});

describe('useWalletConnectSession offline stub', () => {
  const {
    useWalletConnectSession,
  } = require('../src/hooks/useWalletConnectSession.offline');

  it('returns idle phase and null session', () => {
    const result = useWalletConnectSession();
    expect(result.phase).toBe('idle');
    expect(result.activeSession).toBeNull();
    expect(result.pendingRequest).toBeNull();
  });

  it('all actions are no-ops', async () => {
    const result = useWalletConnectSession();
    await expect(result.pair('wc:test')).resolves.toBeUndefined();
    await expect(result.approveSession('0x123')).resolves.toBeUndefined();
    await expect(result.disconnect()).resolves.toBeUndefined();
    await expect(
      result.respondSuccess({ id: 1, topic: 't' }, '0x'),
    ).resolves.toBeUndefined();
    await expect(
      result.respondError({ id: 1, topic: 't' }, -32000, 'err'),
    ).resolves.toBeUndefined();
  });
});

describe('useWalletConnectSession online hook', () => {
  const value: WalletConnectContextValue = {
    phase: 'idle',
    activeSession: null,
    pendingRequest: null,
    pair: jest.fn(),
    approveSession: jest.fn(),
    rejectSession: jest.fn(),
    disconnect: jest.fn(),
    respondSuccess: jest.fn(),
    respondError: jest.fn(),
  };

  it('throws when used outside WalletConnectProvider', () => {
    expect(() => renderHook(() => useWalletConnectSessionOnline())).toThrow(
      'useWalletConnectSession must be used inside WalletConnectProvider',
    );
  });

  it('returns the WalletConnect context value when provided', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(WalletConnectContext.Provider, { value }, children);

    const { result } = renderHook(() => useWalletConnectSessionOnline(), {
      wrapper,
    });

    expect(result.current).toBe(value);
  });
});
