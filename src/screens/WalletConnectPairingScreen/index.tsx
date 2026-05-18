import { HDKey } from '@scure/bip32';
import Keycard from 'keycard-sdk';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { WalletConnectPairingScreenProps } from '@/navigation/types';
import {
  SUPPORTED_WC_EIP155_CHAIN_IDS,
  SUPPORTED_WC_METHODS,
} from '@/constants/walletConnect';
import { useKeycardOp } from '@/hooks/keycard/useKeycardOperation';
import { useWalletConnectSession } from '@/hooks/useWalletConnectSession.online';
import type { SessionProposalEvent } from '@/providers/walletConnect/context';
import { getChainName } from '@/utils/chainMetadata';
import { pubKeyToEthAddress } from '@/utils/ethereumAddress';
import { deriveAddresses } from '@/utils/hdAddress';

import AddressSelectionPhase from './AddressSelectionPhase';
import ApprovingPhase from './ApprovingPhase';
import ErrorPhase from './ErrorPhase';
import PairingPhase from './PairingPhase';
import ProposalPhase from './ProposalPhase';

const BATCH = 20;

type PathOption = {
  label: string;
  // Path exported from Keycard; addresses are derived as path/0/i (hasExternalChain=true) or path/i (false)
  accountPath: string;
  hasExternalChain: boolean;
};

const PATH_OPTIONS: PathOption[] = [
  {
    label: 'Ethereum (standard)',
    accountPath: "m/44'/60'/0'",
    hasExternalChain: true,
  },
  {
    label: 'Ledger Legacy',
    accountPath: "m/44'/60'/0'",
    hasExternalChain: false,
  },
];

type LocalPhase =
  | 'pairing'
  | 'proposal'
  | 'approving'
  | 'address_selection'
  | 'error';

export default function WalletConnectPairingScreen({
  navigation,
  route,
}: WalletConnectPairingScreenProps) {
  const { uri } = route.params;
  const insets = useSafeAreaInsets();
  const {
    phase: wcPhase,
    activeSession,
    pair,
    approveSession,
    rejectSession,
  } = useWalletConnectSession();

  const [localPhase, setLocalPhase] = useState<LocalPhase>('pairing');
  const [selectedPathIdx, setSelectedPathIdx] = useState(0);
  const [addresses, setAddresses] = useState<string[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [accountKey, setAccountKey] = useState<HDKey | null>(null);
  const [loading, setLoading] = useState(false);
  const nextIndexRef = useRef(0);

  const proposal = useMemo(() => {
    if (typeof wcPhase === 'object' && wcPhase.kind === 'proposal') {
      return wcPhase.proposal;
    }
    return null;
  }, [wcPhase]);

  useEffect(() => {
    pair(uri);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (wcPhase === 'pairing') {
      // pair() was just called — clear any stale error from a previous attempt
      setLocalPhase('pairing');
      return;
    }
    if (typeof wcPhase !== 'object') return;

    if (
      wcPhase.kind === 'proposal' &&
      (localPhase === 'pairing' || localPhase === 'proposal')
    ) {
      setLocalPhase('proposal');
    } else if (wcPhase.kind === 'active' && localPhase !== 'pairing') {
      // Only navigate to Dashboard when active arrives from our own approval flow.
      // Ignore if localPhase is still 'pairing' — that means a pre-existing active
      // session was present when this screen mounted, not our own new session.
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } else if (wcPhase.kind === 'error') {
      setLocalPhase('error');
    }
  }, [wcPhase, navigation, localPhase]);

  const selectedOpt = PATH_OPTIONS[selectedPathIdx];
  const accountKeyOp = useKeycardOp<HDKey>(
    useCallback(
      async cmdSet => {
        const resp = await cmdSet.exportExtendedKey(
          0,
          selectedOpt.accountPath,
          false,
        );
        resp.checkOK();
        return Keycard.BIP32KeyPair.extendedKey(resp.data);
      },
      [selectedOpt.accountPath],
    ),
    { requiresPin: true },
  );

  const { phase: nfcPhase, start: startNfc, cancel: cancelNfc } = accountKeyOp;

  useEffect(() => {
    if (nfcPhase === 'done' && accountKeyOp.result) {
      const key = accountKeyOp.result;
      const enumerationKey = selectedOpt.hasExternalChain
        ? key.deriveChild(0)
        : key;
      setAccountKey(enumerationKey);
      const batch = deriveAddresses(
        enumerationKey,
        BATCH,
        pubKeyToEthAddress,
        0,
      );
      nextIndexRef.current = BATCH;
      setAddresses(batch);
      setLocalPhase('address_selection');
    }
  }, [nfcPhase, accountKeyOp.result, selectedOpt.hasExternalChain]);

  const handleConfirm = useCallback(() => {
    setLocalPhase('approving');
    startNfc();
  }, [startNfc]);

  const handleRejectProposal = useCallback(async () => {
    if (proposal) {
      await rejectSession(proposal as SessionProposalEvent);
    }
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  }, [proposal, rejectSession, navigation]);

  const handleNfcCancel = useCallback(async () => {
    cancelNfc();
    if (proposal) {
      await rejectSession(proposal as SessionProposalEvent);
    }
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  }, [cancelNfc, proposal, rejectSession, navigation]);

  const handleConnect = useCallback(async () => {
    if (!selectedAddress) return;
    const idx = addresses.indexOf(selectedAddress);
    const fullPath = selectedOpt.hasExternalChain
      ? `${selectedOpt.accountPath}/0/${idx}`
      : `${selectedOpt.accountPath}/${idx}`;
    await approveSession(selectedAddress, fullPath);
  }, [selectedAddress, addresses, selectedOpt, approveSession]);

  const handleCancelAddressSelection = useCallback(async () => {
    if (proposal) {
      await rejectSession(proposal as SessionProposalEvent);
    }
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  }, [proposal, rejectSession, navigation]);

  const loadMore = useCallback(() => {
    if (!accountKey || loading) return;
    setLoading(true);
    const batch = deriveAddresses(
      accountKey,
      BATCH,
      pubKeyToEthAddress,
      nextIndexRef.current,
    );
    nextIndexRef.current += BATCH;
    setAddresses(prev => [...prev, ...batch]);
    setLoading(false);
  }, [accountKey, loading]);

  const requestedChains = useMemo(() => {
    const required = proposal?.params.requiredNamespaces.eip155?.chains ?? [];
    const optional = proposal?.params.optionalNamespaces?.eip155?.chains ?? [];
    const chains = [...new Set([...required, ...optional])];
    return chains.map(c => {
      const id = parseInt(c.replace('eip155:', ''), 10);
      return getChainName(id) || c;
    });
  }, [proposal]);

  const proposalError = useMemo(() => {
    if (!proposal) return null;
    const requiredNamespaces = proposal.params.requiredNamespaces ?? {};
    const unsupportedNamespaces = Object.keys(requiredNamespaces).filter(
      ns => ns !== 'eip155',
    );
    if (unsupportedNamespaces.length > 0) {
      return `Required namespaces not supported: ${unsupportedNamespaces.join(
        ', ',
      )}`;
    }

    const supported = SUPPORTED_WC_EIP155_CHAIN_IDS.map(id => `eip155:${id}`);
    const requiredChains = requiredNamespaces.eip155?.chains ?? [];
    const unsupportedChains = requiredChains.filter(
      c => !supported.includes(c),
    );
    if (unsupportedChains.length > 0) {
      return `Required chains not supported: ${unsupportedChains
        .map(c => c.replace('eip155:', ''))
        .join(', ')}`;
    }
    const requiredMethods = requiredNamespaces.eip155?.methods ?? [];
    const unsupported = requiredMethods.filter(
      m => !(SUPPORTED_WC_METHODS as readonly string[]).includes(m),
    );
    if (unsupported.length > 0) {
      return `Required methods not supported: ${unsupported.join(', ')}`;
    }
    return null;
  }, [proposal]);

  if (localPhase === 'pairing') {
    return <PairingPhase insets={insets} />;
  }

  if (localPhase === 'error') {
    const msg =
      typeof wcPhase === 'object' && wcPhase.kind === 'error'
        ? wcPhase.message
        : 'Connection failed';
    return (
      <ErrorPhase
        message={msg}
        insets={insets}
        onBack={() =>
          navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })
        }
      />
    );
  }

  if (localPhase === 'approving') {
    return (
      <ApprovingPhase
        accountKeyOp={accountKeyOp}
        insets={insets}
        onCancel={handleNfcCancel}
      />
    );
  }

  if (localPhase === 'address_selection') {
    return (
      <AddressSelectionPhase
        addresses={addresses}
        selectedAddress={selectedAddress}
        loading={loading}
        insets={insets}
        onSelect={setSelectedAddress}
        onLoadMore={loadMore}
        onConnect={handleConnect}
        onCancel={handleCancelAddressSelection}
      />
    );
  }

  return (
    <ProposalPhase
      dAppName={proposal?.params.proposer.metadata.name ?? ''}
      dAppUrl={proposal?.params.proposer.metadata.url ?? ''}
      requestedChains={requestedChains}
      pathOptions={PATH_OPTIONS}
      selectedPathIdx={selectedPathIdx}
      activeSessionName={activeSession?.peer.metadata.name ?? null}
      verification={proposal?.verifyContext?.verified ?? null}
      expiryTimestamp={proposal?.params.expiryTimestamp ?? 0}
      proposalError={proposalError}
      insets={insets}
      onSelectPath={setSelectedPathIdx}
      onConfirm={handleConfirm}
      onReject={handleRejectProposal}
    />
  );
}
