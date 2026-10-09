export type TenderlyCredentials = {
  accountSlug: string;
  projectSlug: string;
  apiKey: string;
};

export interface TenderlyConfig {
  enabled: boolean;
  credentials: TenderlyCredentials;
}

export async function loadTenderlyConfig(): Promise<TenderlyConfig> {
  return {
    enabled: false,
    credentials: { accountSlug: '', projectSlug: '', apiKey: '' },
  };
}

export async function saveTenderlyEnabled(_value: boolean): Promise<void> {}

export async function saveTenderlyCredentials(
  _c: TenderlyCredentials,
): Promise<void> {}

import type { SatisfiesOnline } from '@/utils/onlineParity';

// tsc drift guard: this stub must stay interface-compatible with its online twin.
export type _OnlineParity = SatisfiesOnline<
  typeof import('./tenderly.online'),
  typeof import('./tenderly.offline')
>;
