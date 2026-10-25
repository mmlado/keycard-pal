import { DisplayNodes } from '@/components/SignRequestDetail/eth/DataTabPanel/Eip7730Display';

import { displayDecodedCall } from '@/utils/decodedCallDisplay';
import type { DecodedCall } from '@/utils/txParser';

export default function DecodedCallSection({
  call,
  tokenContract,
  chainId,
}: {
  call: DecodedCall;
  tokenContract?: string;
  chainId?: number;
}) {
  return (
    <DisplayNodes nodes={displayDecodedCall(call, tokenContract, chainId)} />
  );
}
