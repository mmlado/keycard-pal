import {
  eip712DomainChainId,
  encodeEip712Type,
  type Eip712RawTypedData,
} from '@/utils/eip712';
import { lookupEip712 } from '@/utils/eip7730/lookup';
import { buildEip712Resolvers } from '@/utils/eip7730/paths';
import { fitsRequest } from '@/utils/eip7730/visibility';
import type { Eip7730DisplayFormat } from '@/utils/eip7730/zip';

import type { MatchedDescriptor } from './callDescription';

export type MessageDescription = {
  /** The entry that describes the message; null when none does or the request fails its rules. */
  descriptor: MatchedDescriptor | null;
  rejected: boolean;
  chainId: number | undefined;
  verifyingContract: string | undefined;
};

/** Waits only while the entry's saved slice is read. */
export function describeMessage(
  typed: Eip712RawTypedData | null,
  from: string | undefined,
): MessageDescription | Promise<MessageDescription> {
  // ERC-7730 binds a message to its domain's chain; WalletConnect requests carry no other.
  const chainId = typed ? eip712DomainChainId(typed.domain) : undefined;
  const contract = typed?.domain.verifyingContract;
  // As written: the lookup ignores case, and nothing but an address names an entry.
  const verifyingContract =
    typeof contract === 'string' && contract !== '' ? contract : undefined;
  const none: MessageDescription = {
    descriptor: null,
    rejected: false,
    chainId,
    verifyingContract,
  };
  const encodedType = typed && encodeEip712Type(typed.primaryType, typed.types);
  if (!typed || chainId === undefined || !verifyingContract || !encodedType) {
    return none;
  }

  const describe = (
    format: Eip7730DisplayFormat | null,
  ): MessageDescription => {
    if (!format) return none;
    const descriptor = {
      format,
      ...buildEip712Resolvers(typed, {
        from,
        to: verifyingContract,
        value: '0',
        chainId,
      }),
    };
    return fitsRequest(format, descriptor)
      ? { ...none, descriptor }
      : { ...none, rejected: true };
  };
  // The domain as written: the entry compares its values exactly.
  const found = lookupEip712(
    chainId,
    verifyingContract,
    encodedType,
    typed.domain,
  );
  return found instanceof Promise ? found.then(describe) : describe(found);
}
