import type { CallDescription } from '@/utils/callDescription';
import { lookupToken } from '@/utils/tokenMetadata';

import DecodedCallSection from './DecodedCallSection';
import Eip7730CallSection from './DecodedCallSection/Eip7730CallSection';
import TokenContractRows from './DecodedCallSection/TokenContractRows';

/** A call the review can read; one shown as written is the caller's to render. */
export default function CallSection({
  description,
  contract,
  chainId,
  depth = 0,
}: {
  description: CallDescription;
  contract: string | undefined;
  chainId: number | undefined;
  depth?: number;
}) {
  const { view, descriptor, decoded, contractRow } = description;
  if (descriptor) {
    const tokenCall = contractRow === 'token-contract';
    return (
      <>
        {tokenCall && (
          <TokenContractRows
            token={lookupToken(chainId, contract)}
            tokenContract={contract}
          />
        )}
        <Eip7730CallSection
          format={descriptor.format}
          resolvePath={descriptor.resolvePath}
          resolveEach={descriptor.resolveEach}
          depth={depth}
          contractAddress={contract}
          chainId={chainId}
          shownContract={tokenCall ? contract : undefined}
        />
      </>
    );
  }
  return view === 'decoded' && decoded ? (
    <DecodedCallSection
      call={decoded}
      tokenContract={contract}
      chainId={chainId}
    />
  ) : null;
}
