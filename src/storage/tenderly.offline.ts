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
