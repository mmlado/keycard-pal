import { createContext } from 'react';

export type Eip7730DownloadPhase =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'processing'
  | 'done'
  | 'error';

export type Eip7730DownloadState = {
  phase: Eip7730DownloadPhase;
  progress?: number;
  error?: string;
  triggerDownload: () => void;
};

export const Eip7730Context = createContext<Eip7730DownloadState>({
  phase: 'idle',
  triggerDownload: () => {},
});
