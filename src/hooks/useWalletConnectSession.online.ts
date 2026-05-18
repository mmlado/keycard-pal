import { useContext } from 'react';

import {
  WalletConnectContext,
  WalletConnectContextValue,
} from '@/providers/walletConnect/context';

export type {
  SessionPhase,
  WCRequest,
  ActiveSession,
} from '@/providers/walletConnect/context';

export function useWalletConnectSession(): WalletConnectContextValue {
  const ctx = useContext(WalletConnectContext);
  if (!ctx) {
    throw new Error(
      'useWalletConnectSession must be used inside WalletConnectProvider',
    );
  }
  return ctx;
}
