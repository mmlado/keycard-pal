import { createContext } from 'react';

import type { WCContext } from '@/constants/walletConnect';
import type { ScanResult } from '@/types';

export type SessionPhase =
  | 'idle'
  | 'pairing'
  | { kind: 'proposal'; proposal: SessionProposalEvent }
  | 'approving'
  | { kind: 'active'; session: ActiveSession }
  | { kind: 'error'; message: string };

export type WCRequest = {
  id: number;
  topic: string;
  method: string;
  params: unknown;
};

// Minimal session shape we need from WalletKit (avoids importing WalletKit types here)
export type ActiveSession = {
  topic: string;
  peer: { metadata: { name: string; url: string; icons: string[] } };
  namespaces: Record<string, { accounts: string[] }>;
};

export type VerifyValidation = 'VALID' | 'INVALID' | 'UNKNOWN';

// Minimal proposal shape
export type SessionProposalEvent = {
  id: number;
  verifyContext?: {
    verified: {
      validation: VerifyValidation;
      isScam?: boolean;
      origin: string;
    };
  };
  params: {
    id: number;
    expiryTimestamp: number;
    proposer: { metadata: { name: string; url: string; icons: string[] } };
    requiredNamespaces: Record<
      string,
      { chains?: string[]; methods?: string[] }
    >;
    optionalNamespaces: Record<
      string,
      { chains?: string[]; methods?: string[] }
    >;
  };
};

export type WalletConnectContextValue = {
  phase: SessionPhase;
  activeSession: ActiveSession | null;
  pendingRequest: WCRequest | null;
  pair: (uri: string) => Promise<void>;
  approveSession: (address: string, derivationPath: string) => Promise<void>;
  rejectSession: (proposal: SessionProposalEvent) => Promise<void>;
  disconnect: () => Promise<void>;
  respondSuccess: (context: WCContext, result: string) => Promise<void>;
  respondError: (
    context: WCContext,
    code: number,
    message: string,
  ) => Promise<void>;
};

// Used by ScanResult conversion in requestAdapter (Task 5+)
export type { ScanResult };

export const WalletConnectContext =
  createContext<WalletConnectContextValue | null>(null);
