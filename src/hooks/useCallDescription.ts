import { useCallback } from 'react';

import { useRegistryAnswer } from '@/hooks/useRegistryAnswer';

import {
  describeCall,
  type CallDescription,
  type CallRequest,
} from '@/utils/callDescription';

/** `description` is null while the entry's saved slice is read. */
export function useCallDescription({
  chainId,
  contract,
  data,
  from,
  value,
  depth,
}: CallRequest): { description: CallDescription | null; loading: boolean } {
  const ask = useCallback(
    () => describeCall({ chainId, contract, data, from, value, depth }),
    [chainId, contract, data, from, value, depth],
  );
  const { answer, loading } = useRegistryAnswer(ask);
  return { description: answer, loading };
}
