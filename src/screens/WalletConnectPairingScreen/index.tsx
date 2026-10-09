import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { WalletConnectPairingScreenProps } from '@/navigation/types';
import {
  useAddressEnumeration,
  type AddressRow,
} from '@/hooks/keycard/useAddressEnumeration';
import { useWalletConnectSession } from '@/hooks/useWalletConnectSession.online';
import type { SessionProposalEvent } from '@/providers/walletConnect/context';
import { getChainName } from '@/utils/chainMetadata';
import { pubKeyToEthAddress } from '@/utils/ethereumAddress';
import { validateProposal } from '@/utils/walletConnect/proposalPolicy';

import AddressSelectionPhase from './AddressSelectionPhase';
import ApprovingPhase from './ApprovingPhase';
import ErrorPhase from './ErrorPhase';
import PairingPhase from './PairingPhase';
import ProposalPhase from './ProposalPhase';

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
  const [selectedRow, setSelectedRow] = useState<AddressRow | null>(null);

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
  const { rows, loading, loadMore, nfc } = useAddressEnumeration(
    selectedOpt.accountPath,
    pubKeyToEthAddress,
    { hasExternalChain: selectedOpt.hasExternalChain },
  );
  const { phase: nfcPhase, start: startNfc, cancel: cancelNfc } = nfc;

  useEffect(() => {
    if (nfcPhase === 'done') {
      setLocalPhase('address_selection');
    }
  }, [nfcPhase]);

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
    if (!selectedRow) return;
    // Address and path travel together in the row — approveSession stores
    // exactly the pair the enumeration derived from one child key.
    await approveSession(selectedRow.address, selectedRow.path);
  }, [selectedRow, approveSession]);

  const handleCancelAddressSelection = useCallback(async () => {
    if (proposal) {
      await rejectSession(proposal as SessionProposalEvent);
    }
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  }, [proposal, rejectSession, navigation]);

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
    // Same policy the provider rejects with — banner and rejection reason
    // are composed from one verdict and cannot drift.
    const verdict = validateProposal(proposal);
    return verdict.ok ? null : verdict.reason;
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
        accountKeyOp={nfc}
        insets={insets}
        onCancel={handleNfcCancel}
      />
    );
  }

  if (localPhase === 'address_selection') {
    return (
      <AddressSelectionPhase
        rows={rows}
        selectedRow={selectedRow}
        loading={loading}
        insets={insets}
        onSelect={setSelectedRow}
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
