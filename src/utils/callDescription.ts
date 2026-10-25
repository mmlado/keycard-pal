import { lookupCalldata } from '@/utils/eip7730/lookup';
import {
  buildArgsEachResolver,
  buildArgsPathResolver,
  decodeArgsBySignature,
} from '@/utils/eip7730/paths';
import { fitsRequest } from '@/utils/eip7730/visibility';
import type { Eip7730DisplayFormat } from '@/utils/eip7730/zip';
import { isWholeBytes } from '@/utils/hex';
import { decodeCalldata, type DecodedCall } from '@/utils/txParser';

// Deeper than this a crafted registry or calldata could nest without end.
export const MAX_CALL_DEPTH = 3;

export type CallRequest = {
  chainId: number | undefined;
  /** The transaction's `to`, or an inner call's callee. */
  contract: string | undefined;
  data: string;
  /** What `@.from` and `@.value` read. */
  from?: string;
  value?: string;
  /** 0 for the transaction itself. */
  depth: number;
};

/** A registry entry that matched a call or a message, with the values it reads. */
export type MatchedDescriptor = {
  format: Eip7730DisplayFormat;
  resolvePath: (path: string) => string | null;
  resolveEach: (path: string) => string[];
  miscasedAt: (path: string) => boolean;
};

export type CallDescription = {
  /** The entry's fields, the app's own section, or the selector and data as written. */
  view: 'descriptor' | 'decoded' | 'raw';
  descriptor: MatchedDescriptor | null;
  /** An entry names the call but the request fails its rules; the review warns over its own view. */
  rejected: boolean;
  /** The app's own decoding, through selectors.json. */
  decoded: DecodedCall | null;
  /** When the data is whole bytes that begin with a selector. */
  selector: string | null;
  /** A token call's own section names its contract "Token contract". */
  contractRow: 'to' | 'contract' | 'token-contract';
};

type Match = Pick<CallDescription, 'descriptor' | 'rejected'>;

const NO_MATCH: Match = { descriptor: null, rejected: false };

const TOKEN_CALLS: readonly DecodedCall['kind'][] = [
  'erc20-transfer',
  'erc20-transferFrom',
  'erc20-approve',
];

function matchEntry(
  request: CallRequest,
  format: Eip7730DisplayFormat | null,
): Match {
  if (!format?.signature) return NO_MATCH;
  // An entry whose signature does not fit the bytes is not describing this call.
  const args = decodeArgsBySignature(format.signature, request.data);
  if (!args) return NO_MATCH;
  const container = {
    from: request.from,
    to: request.contract,
    value: request.value,
    chainId: request.chainId,
  };
  const descriptor = {
    format,
    resolvePath: buildArgsPathResolver(args, container),
    resolveEach: buildArgsEachResolver(args, container),
    // Calldata holds an address as 20 bytes, with no case to get wrong.
    miscasedAt: () => false,
  };
  return fitsRequest(format, descriptor)
    ? { descriptor, rejected: false }
    : { descriptor: null, rejected: true };
}

function describe(
  request: CallRequest,
  format: Eip7730DisplayFormat | null,
  decoded: DecodedCall | null,
  selector: string | null,
): CallDescription {
  const match = matchEntry(request, format);
  const view = match.descriptor
    ? 'descriptor'
    : decoded && decoded.kind !== 'unknown-call'
    ? 'decoded'
    : 'raw';
  const contractRow =
    decoded && TOKEN_CALLS.includes(decoded.kind)
      ? 'token-contract'
      : request.depth === 0
      ? 'to'
      : 'contract';
  return { view, ...match, decoded, selector, contractRow };
}

/** Waits only while the entry's saved slice is read. */
export function describeCall(
  request: CallRequest,
): CallDescription | Promise<CallDescription> {
  const { chainId, contract, data, depth } = request;
  // Data that is not whole bytes decodes shifted, so it is only ever shown as written.
  const selector =
    isWholeBytes(data) && /^0x[0-9a-f]{8}/i.test(data)
      ? data.slice(0, 10)
      : null;
  const readable = selector !== null && depth <= MAX_CALL_DEPTH;
  const decoded = readable ? decodeCalldata(data) : null;
  const found =
    readable && chainId !== undefined && contract
      ? lookupCalldata(chainId, contract, selector)
      : null;
  return found instanceof Promise
    ? found.then(format => describe(request, format, decoded, selector))
    : describe(request, found, decoded, selector);
}
