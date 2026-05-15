import { type Eip712SpecialReview } from '@/utils/eip712';

import PermitReviewSection from './PermitReviewSection';
import SafeTxReviewSection from './SafeTxReviewSection';

export default function SpecialEip712Section({
  special,
  fallbackChainId,
}: {
  special: Eip712SpecialReview;
  fallbackChainId: number | undefined;
}) {
  const chainId = special.chainId ?? fallbackChainId;
  if (special.kind === 'permit' || special.kind === 'permit-single') {
    return <PermitReviewSection special={special} chainId={chainId} />;
  }
  return <SafeTxReviewSection special={special} chainId={chainId} />;
}
