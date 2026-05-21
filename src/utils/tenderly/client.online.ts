import type { TenderlyCredentials } from '@/storage/tenderly.online';

const TIMEOUT_MS = 30_000;

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
  credentials: TenderlyCredentials,
  params: SimulationParams,
): Promise<SimulationResult> {
  const { accountSlug, projectSlug, apiKey } = credentials;
  const url = `https://api.tenderly.co/api/v1/account/${accountSlug}/project/${projectSlug}/simulate`;

  const body = {
    network_id: params.chainId.toString(),
    from: params.from,
    to: params.to,
    input: params.data || '0x',
    value: params.valueWei,
    gas: parseInt(params.gasLimit, 10),
    gas_price: '0',
    save: false,
    save_if_fails: false,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal as unknown as RequestInit['signal'],
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Simulation timed out');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Tenderly API error ${response.status}: ${text}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  const tx = json.transaction as Record<string, unknown> | undefined;
  const sim = json.simulation as Record<string, unknown> | undefined;
  const simulationId: string = sim?.id != null ? String(sim.id) : '';
  const traceUrl = simulationId
    ? `https://dashboard.tenderly.co/${accountSlug}/${projectSlug}/simulation/${simulationId}`
    : '';

  const txInfo = tx?.transaction_info as Record<string, unknown> | undefined;
  const rawChanges = Array.isArray(txInfo?.asset_changes)
    ? (txInfo.asset_changes as Record<string, unknown>[])
    : [];
  const assetChanges: AssetChange[] = rawChanges.map(c => ({
    tokenSymbol: String(
      (c.token_info as Record<string, unknown>)?.symbol ?? '?',
    ),
    tokenAddress: String(
      (c.token_info as Record<string, unknown>)?.contract_address ?? '',
    ),
    from: String(c.from ?? ''),
    to: String(c.to ?? ''),
    amount: String(c.amount ?? '0'),
  }));

  if (tx?.status === true) {
    return { status: 'success', assetChanges, traceUrl };
  }
  const errInfo = tx?.error_info as Record<string, unknown> | undefined;
  return {
    status: 'reverted',
    revertReason:
      errInfo?.error_message != null ? String(errInfo.error_message) : null,
    assetChanges,
    traceUrl,
  };
}
