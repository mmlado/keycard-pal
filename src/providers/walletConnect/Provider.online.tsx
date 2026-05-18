import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';

import {
  SUPPORTED_WC_EIP155_CHAIN_IDS,
  SUPPORTED_WC_METHODS,
  WCContext,
} from '@/constants/walletConnect';
import { navigationRef } from '@/navigation/navigationRef';
import { wcClient } from '@/utils/walletConnect/client.online';
import { wcRequestToScanResult } from '@/utils/walletConnect/requestAdapter';

import {
  ActiveSession,
  SessionPhase,
  SessionProposalEvent,
  WalletConnectContext,
  WalletConnectContextValue,
  WCRequest,
} from './context';

const SUPPORTED_METHODS: string[] = [...SUPPORTED_WC_METHODS];

type ResolvedNamespaces = {
  approvedChains: string[];
  approvedMethods: string[];
  unsupportedNamespaces: string[];
  unsupportedRequired: string[];
  unsupportedRequiredChains: string[];
};

function resolveNamespaces(proposal: SessionProposalEvent): ResolvedNamespaces {
  const supported = SUPPORTED_WC_EIP155_CHAIN_IDS.map(id => `eip155:${id}`);
  const unsupportedNamespaces = Object.keys(
    proposal.params.requiredNamespaces,
  ).filter(ns => ns !== 'eip155');

  const requiredChains =
    proposal.params.requiredNamespaces.eip155?.chains ?? [];
  const optionalChains =
    proposal.params.optionalNamespaces?.eip155?.chains ?? [];
  const requestedChains = [...new Set([...requiredChains, ...optionalChains])];
  const approvedChains =
    requestedChains.length > 0
      ? requestedChains.filter(c => supported.includes(c))
      : supported;

  const requiredMethods =
    proposal.params.requiredNamespaces.eip155?.methods ?? [];
  const optionalMethods =
    proposal.params.optionalNamespaces?.eip155?.methods ?? [];
  const requestedMethods = [
    ...new Set([...requiredMethods, ...optionalMethods]),
  ];
  const approvedMethods =
    requestedMethods.length > 0
      ? requestedMethods.filter(m => SUPPORTED_METHODS.includes(m))
      : SUPPORTED_METHODS;

  const unsupportedRequired = requiredMethods.filter(
    m => !SUPPORTED_METHODS.includes(m),
  );

  const unsupportedRequiredChains = requiredChains.filter(
    c => !supported.includes(c),
  );

  return {
    approvedChains,
    approvedMethods,
    unsupportedNamespaces,
    unsupportedRequired,
    unsupportedRequiredChains,
  };
}

export function WalletConnectProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [phase, setPhase] = useState<SessionPhase>('idle');
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(
    null,
  );
  const [pendingRequest, setPendingRequest] = useState<WCRequest | null>(null);

  const activeSessionRef = useRef<ActiveSession | null>(null);
  const activeRequestRef = useRef<WCRequest | null>(null);
  const addressPathRef = useRef<Map<string, string>>(new Map());
  const respondedRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let mounted = true;
    let removeListeners: (() => void) | undefined;

    wcClient.getClient().then(client => {
      if (!mounted) return;

      function onProposal(event: SessionProposalEvent) {
        if (!mounted) return;
        setPhase({ kind: 'proposal', proposal: event });
      }

      async function onRequest(event: {
        id: number;
        topic: string;
        params: { request: { method: string; params: unknown } };
      }) {
        if (!mounted) return;

        const { id, topic } = event;
        const { method, params } = event.params.request;

        if (!SUPPORTED_METHODS.includes(method)) {
          await wcClient.respondError(
            id,
            topic,
            -32601,
            `${method} not supported`,
          );
          return;
        }

        if (activeRequestRef.current) {
          await wcClient.respondError(id, topic, -32000, 'Wallet is busy');
          return;
        }

        if (appStateRef.current !== 'active') {
          await wcClient.respondError(
            id,
            topic,
            -32000,
            'Wallet is not active',
          );
          return;
        }

        const req: WCRequest = { id, topic, method, params };
        activeRequestRef.current = req;
        respondedRef.current = false;
        setPendingRequest(req);

        try {
          const result = wcRequestToScanResult(req, addressPathRef.current);
          if (navigationRef.isReady()) {
            navigationRef.navigate('TransactionDetail', {
              result,
              wcContext: { id, topic },
            });
          } else {
            await wcClient.respondError(id, topic, -32000, 'Wallet not ready');
            activeRequestRef.current = null;
            respondedRef.current = true;
            setPendingRequest(null);
          }
        } catch {
          await wcClient.respondError(id, topic, -32602, 'Invalid params');
          activeRequestRef.current = null;
          respondedRef.current = true;
          setPendingRequest(null);
        }
      }

      function onDelete() {
        if (!mounted) return;
        activeSessionRef.current = null;
        activeRequestRef.current = null;
        addressPathRef.current.clear();
        setActiveSession(null);
        setPendingRequest(null);
        setPhase('idle');
      }

      client.on('session_proposal', onProposal);
      client.on('session_request', onRequest);
      client.on('session_delete', onDelete);

      removeListeners = () => {
        client.off('session_proposal', onProposal);
        client.off('session_request', onRequest);
        client.off('session_delete', onDelete);
      };
    });

    return () => {
      mounted = false;
      removeListeners?.();
    };
  }, []);

  const pair = useCallback(async (uri: string) => {
    setPhase('pairing');
    try {
      await wcClient.pair(uri);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Pairing failed';
      setPhase({ kind: 'error', message: msg });
    }
  }, []);

  const rejectProposal = useCallback(
    async (
      proposal: SessionProposalEvent,
      reason: string,
      code = 5100,
      noSessionPhase: SessionPhase = { kind: 'error', message: reason },
    ) => {
      try {
        const client = await wcClient.getClient();
        await client.rejectSession({
          id: proposal.id,
          reason: { code, message: reason },
        });
      } catch {
        // ignore
      }
      setPhase(
        activeSessionRef.current
          ? { kind: 'active', session: activeSessionRef.current }
          : noSessionPhase,
      );
    },
    [],
  );

  const displaceActiveSession = useCallback(async () => {
    if (!activeSessionRef.current) return;
    if (activeRequestRef.current) {
      const { id, topic } = activeRequestRef.current;
      await wcClient.respondError(id, topic, -32000, 'Wallet session replaced');
      activeRequestRef.current = null;
      setPendingRequest(null);
    }
    await wcClient.disconnect(activeSessionRef.current.topic);
  }, []);

  const approveSession = useCallback(
    async (address: string, derivationPath: string) => {
      const currentPhase = phase;
      if (
        typeof currentPhase !== 'object' ||
        currentPhase.kind !== 'proposal'
      ) {
        return;
      }
      const { proposal } = currentPhase;
      const {
        approvedChains,
        approvedMethods,
        unsupportedNamespaces,
        unsupportedRequired,
        unsupportedRequiredChains,
      } = resolveNamespaces(proposal);

      if (
        unsupportedNamespaces.length > 0 ||
        unsupportedRequiredChains.length > 0 ||
        unsupportedRequired.length > 0
      ) {
        const reason =
          unsupportedNamespaces.length > 0
            ? `Required namespaces not supported: ${unsupportedNamespaces.join(
                ', ',
              )}`
            : unsupportedRequiredChains.length > 0
            ? `Required chains not supported: ${unsupportedRequiredChains.join(
                ', ',
              )}`
            : `Required methods not supported: ${unsupportedRequired.join(
                ', ',
              )}`;
        await rejectProposal(proposal, reason);
        return;
      }

      addressPathRef.current.set(address.toLowerCase(), derivationPath);
      setPhase('approving');

      try {
        await displaceActiveSession();

        const client = await wcClient.getClient();
        const session = await client.approveSession({
          id: proposal.id,
          namespaces: {
            eip155: {
              chains: approvedChains,
              methods: approvedMethods,
              events: ['accountsChanged', 'chainChanged'],
              accounts: approvedChains.map((c: string) => `${c}:${address}`),
            },
          },
        });

        activeSessionRef.current = session as unknown as ActiveSession;
        setActiveSession(session as unknown as ActiveSession);
        setPhase({
          kind: 'active',
          session: session as unknown as ActiveSession,
        });
      } catch (e: unknown) {
        const raw = e instanceof Error ? e.message : '';
        const msg =
          raw.includes("proposal id doesn't exist") ||
          raw.includes('No matching key')
            ? 'Connection request expired. Scan the QR code again.'
            : raw || 'Session approval failed';
        setPhase({ kind: 'error', message: msg });
      }
    },
    [phase, rejectProposal, displaceActiveSession],
  );

  const rejectSession = useCallback(
    async (proposal: SessionProposalEvent) => {
      await rejectProposal(
        proposal,
        'User rejected the session proposal',
        5000,
        'idle',
      );
    },
    [rejectProposal],
  );

  const disconnect = useCallback(async () => {
    const session = activeSessionRef.current;
    if (!session) return;
    try {
      await wcClient.disconnect(session.topic);
    } catch {
      // ignore — session may already be gone on the relay
    }
    activeSessionRef.current = null;
    activeRequestRef.current = null;
    addressPathRef.current.clear();
    setActiveSession(null);
    setPendingRequest(null);
    setPhase('idle');
  }, []);

  const respondSuccess = useCallback(
    async (context: WCContext, result: string) => {
      if (respondedRef.current) return;
      respondedRef.current = true;
      try {
        await wcClient.respondSuccess(context.id, context.topic, result);
      } catch {
        // ignore — request may have expired on the relay
      }
      activeRequestRef.current = null;
      setPendingRequest(null);
    },
    [],
  );

  const respondError = useCallback(
    async (context: WCContext, code: number, message: string) => {
      if (respondedRef.current) return;
      respondedRef.current = true;
      try {
        await wcClient.respondError(context.id, context.topic, code, message);
      } catch {
        // ignore — request may have expired on the relay
      }
      activeRequestRef.current = null;
      setPendingRequest(null);
    },
    [],
  );

  const value = useMemo<WalletConnectContextValue>(
    () => ({
      phase,
      activeSession,
      pendingRequest,
      pair,
      approveSession,
      rejectSession,
      disconnect,
      respondSuccess,
      respondError,
    }),
    [
      phase,
      activeSession,
      pendingRequest,
      pair,
      approveSession,
      rejectSession,
      disconnect,
      respondSuccess,
      respondError,
    ],
  );

  return (
    <WalletConnectContext.Provider value={value}>
      {children}
    </WalletConnectContext.Provider>
  );
}
