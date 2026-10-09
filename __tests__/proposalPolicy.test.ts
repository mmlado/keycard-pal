import type { SessionProposalEvent } from '../src/providers/walletConnect/context';
import {
  resolveNamespaces,
  validateProposal,
} from '../src/utils/walletConnect/proposalPolicy';

function proposal(params: {
  required?: Record<string, { chains?: string[]; methods: string[] }>;
  optional?: Record<string, { chains?: string[]; methods: string[] }>;
}): SessionProposalEvent {
  return {
    id: 1,
    params: {
      id: 1,
      expiryTimestamp: 0,
      proposer: { metadata: { name: 'App', url: '', icons: [] } },
      requiredNamespaces: params.required ?? {},
      optionalNamespaces: params.optional ?? {},
    },
  } as SessionProposalEvent;
}

describe('validateProposal', () => {
  it('accepts a proposal with supported required chains and methods', () => {
    const verdict = validateProposal(
      proposal({
        required: {
          eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
        },
      }),
    );
    expect(verdict).toEqual({ ok: true });
  });

  it('accepts a proposal with no required namespaces', () => {
    expect(validateProposal(proposal({}))).toEqual({ ok: true });
  });

  it('rejects non-eip155 required namespaces, naming them', () => {
    const verdict = validateProposal(
      proposal({
        required: {
          eip155: { chains: ['eip155:1'], methods: [] },
          cosmos: { chains: ['cosmos:cosmoshub-4'], methods: [] },
        },
      }),
    );
    expect(verdict).toEqual({
      ok: false,
      reason: 'Required namespaces not supported: cosmos',
    });
  });

  it('rejects unsupported required chains, naming them', () => {
    const verdict = validateProposal(
      proposal({
        required: {
          eip155: { chains: ['eip155:1', 'eip155:56'], methods: [] },
        },
      }),
    );
    expect(verdict).toEqual({
      ok: false,
      reason: 'Required chains not supported: eip155:56',
    });
  });

  it('rejects unsupported required methods, naming them', () => {
    const verdict = validateProposal(
      proposal({
        required: {
          eip155: {
            chains: ['eip155:1'],
            methods: ['personal_sign', 'eth_sendTransaction'],
          },
        },
      }),
    );
    expect(verdict).toEqual({
      ok: false,
      reason: 'Required methods not supported: eth_sendTransaction',
    });
  });

  it('unsupported optional chains and methods do not reject', () => {
    const verdict = validateProposal(
      proposal({
        required: {
          eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
        },
        optional: {
          eip155: { chains: ['eip155:56'], methods: ['eth_sendTransaction'] },
        },
      }),
    );
    expect(verdict).toEqual({ ok: true });
  });

  it('namespace problems take precedence over chain and method problems', () => {
    const verdict = validateProposal(
      proposal({
        required: {
          cosmos: { chains: [], methods: [] },
          eip155: { chains: ['eip155:56'], methods: ['eth_sendTransaction'] },
        },
      }),
    );
    expect(verdict).toEqual({
      ok: false,
      reason: 'Required namespaces not supported: cosmos',
    });
  });
});

describe('resolveNamespaces', () => {
  it('approves the intersection of requested and supported chains and methods', () => {
    const resolved = resolveNamespaces(
      proposal({
        required: {
          eip155: { chains: ['eip155:1'], methods: ['personal_sign'] },
        },
        optional: {
          eip155: {
            chains: ['eip155:137', 'eip155:56'],
            methods: ['eth_signTypedData_v4', 'eth_sendTransaction'],
          },
        },
      }),
    );
    expect(resolved.approvedChains).toEqual(['eip155:1', 'eip155:137']);
    expect(resolved.approvedMethods).toEqual([
      'personal_sign',
      'eth_signTypedData_v4',
    ]);
  });

  it('falls back to every supported chain and method when none are requested', () => {
    const resolved = resolveNamespaces(proposal({}));
    expect(resolved.approvedChains).toContain('eip155:1');
    expect(resolved.approvedChains.length).toBeGreaterThan(1);
    expect(resolved.approvedMethods).toContain('personal_sign');
    expect(resolved.unsupportedNamespaces).toEqual([]);
    expect(resolved.unsupportedRequired).toEqual([]);
    expect(resolved.unsupportedRequiredChains).toEqual([]);
  });
});
