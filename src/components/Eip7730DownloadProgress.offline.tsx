import type { SatisfiesOnline } from '@/utils/onlineParity';

export default function Eip7730DownloadProgress() {
  return null;
}

// tsc drift guard: this stub must stay interface-compatible with its online twin.
export type _OnlineParity = SatisfiesOnline<
  typeof import('./Eip7730DownloadProgress.online'),
  typeof import('./Eip7730DownloadProgress.offline')
>;
