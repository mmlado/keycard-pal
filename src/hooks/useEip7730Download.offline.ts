import type { Eip7730DownloadState } from '@/providers/eip7730/context';
import type { SatisfiesOnline } from '@/utils/onlineParity';

export function useEip7730Download(): Eip7730DownloadState {
  return { phase: 'idle', triggerDownload: () => {} };
}

// tsc drift guard: this stub must stay interface-compatible with its online twin.
export type _OnlineParity = SatisfiesOnline<
  typeof import('./useEip7730Download.online'),
  typeof import('./useEip7730Download.offline')
>;
