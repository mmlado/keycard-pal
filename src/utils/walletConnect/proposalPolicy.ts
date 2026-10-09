import {
  SUPPORTED_WC_EIP155_CHAIN_IDS,
  SUPPORTED_WC_METHODS,
} from '@/constants/walletConnect';
import type { SessionProposalEvent } from '@/providers/walletConnect/context';

const SUPPORTED_METHODS: string[] = [...SUPPORTED_WC_METHODS];

export type ResolvedNamespaces = {
  approvedChains: string[];
  approvedMethods: string[];
  unsupportedNamespaces: string[];
  unsupportedRequired: string[];
  unsupportedRequiredChains: string[];
};

/**
 * The WalletConnect allowlist policy: which of a proposal's namespaces,
 * chains, and methods this wallet supports. The provider (session rejection)
 * and the pairing screen (pre-NFC banner) both consume this module, so the
 * reason sent to the dApp and the banner shown to the user can never drift.
 */
export function resolveNamespaces(
  proposal: SessionProposalEvent,
): ResolvedNamespaces {
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

export type ProposalVerdict = { ok: true } | { ok: false; reason: string };

/** One verdict for both surfaces: the dApp rejection reason and the user-facing banner. */
export function validateProposal(
  proposal: SessionProposalEvent,
): ProposalVerdict {
  const {
    unsupportedNamespaces,
    unsupportedRequired,
    unsupportedRequiredChains,
  } = resolveNamespaces(proposal);

  if (unsupportedNamespaces.length > 0) {
    return {
      ok: false,
      reason: `Required namespaces not supported: ${unsupportedNamespaces.join(
        ', ',
      )}`,
    };
  }
  if (unsupportedRequiredChains.length > 0) {
    return {
      ok: false,
      reason: `Required chains not supported: ${unsupportedRequiredChains.join(
        ', ',
      )}`,
    };
  }
  if (unsupportedRequired.length > 0) {
    return {
      ok: false,
      reason: `Required methods not supported: ${unsupportedRequired.join(
        ', ',
      )}`,
    };
  }
  return { ok: true };
}
