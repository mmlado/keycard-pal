import type { WCContext } from '@/constants/walletConnect';
import type {
  SessionPhase,
  WCRequest,
  ActiveSession,
} from './useWalletConnectSession.online';

export type { SessionPhase, WCRequest, ActiveSession };

export function useWalletConnectSession() {
  const phase: SessionPhase = 'idle';
  const activeSession: ActiveSession | null = null;
  const pendingRequest: WCRequest | null = null;

  return {
    phase,
    activeSession,
    pendingRequest,
    pair: async (_uri: string) => {},
    approveSession: async (_address: string, _derivationPath: string) => {},
    rejectSession: async (_proposal: unknown) => {},
    disconnect: async () => {},
    respondSuccess: async (_context: WCContext, _result: string) => {},
    respondError: async (
      _context: WCContext,
      _code: number,
      _message: string,
    ) => {},
  };
}
