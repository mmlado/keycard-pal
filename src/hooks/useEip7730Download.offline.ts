import type { Eip7730DownloadState } from '@/providers/eip7730/context';

export function useEip7730Download(): Eip7730DownloadState {
  return { phase: 'idle', triggerDownload: () => {} };
}
