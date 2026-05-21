export type TenderlyCredentials = {
  accountSlug: string;
  projectSlug: string;
  apiKey: string;
};

export type AssetChange = {
  tokenSymbol: string;
  tokenAddress: string;
  from: string;
  to: string;
  amount: string;
};

export type SimulationResult =
  | { status: 'success'; assetChanges: AssetChange[]; traceUrl: string }
  | {
      status: 'reverted';
      revertReason: string | null;
      assetChanges: AssetChange[];
      traceUrl: string;
    };

export type SimulationParams = {
  from: string;
  to: string;
  valueWei: string;
  data: string;
  gasLimit: string;
  chainId: number;
};

export async function simulateTransaction(
  _credentials: TenderlyCredentials,
  _params: SimulationParams,
): Promise<SimulationResult> {
  throw new Error('offline');
}
