export const DEFAULT_ENS_RPC_URL = '';

export interface EnsSettings {
  enabled: boolean;
  rpcUrl: string;
}

export async function loadEnsSettings(): Promise<EnsSettings> {
  return { enabled: false, rpcUrl: '' };
}

export async function loadEnsRpcUrl(): Promise<string | null> {
  return null;
}

export async function saveEnsEnabled(_enabled: boolean): Promise<void> {}

export async function saveEnsRpcUrl(_url: string): Promise<void> {}
