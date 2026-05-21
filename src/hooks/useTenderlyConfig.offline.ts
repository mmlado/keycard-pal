import type { TenderlyCredentials } from '@/storage/tenderly.offline';

export type { TenderlyCredentials };

export function useTenderlyConfig(): {
  credentials: TenderlyCredentials | null;
} {
  return { credentials: null };
}
