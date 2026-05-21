import {
  simulateTransaction,
  type SimulationParams,
} from '../src/utils/tenderly/client.online';

import { simulateTransaction as simulateOffline } from '../src/utils/tenderly/client.offline';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const CREDS = { accountSlug: 'acme', projectSlug: 'proj', apiKey: 'key123' };

const PARAMS: SimulationParams = {
  from: '0xaaaa000000000000000000000000000000000001',
  to: '0xbbbb000000000000000000000000000000000002',
  valueWei: '0',
  data: '0x',
  gasLimit: '21000',
  chainId: 1,
};

function mockOkResponse(body: object) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

function mockErrorResponse(status: number, text: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    text: () => Promise.resolve(text),
  });
}

function makeTxBody({
  status = true,
  simulationId = 'sim-id-123',
  assetChanges = [] as object[],
  errorMessage = null as string | null,
} = {}) {
  return {
    simulation: { id: simulationId },
    transaction: {
      status,
      transaction_info: {
        asset_changes: assetChanges,
      },
      error_info: errorMessage ? { error_message: errorMessage } : undefined,
    },
  };
}

describe('tenderlyClient.online — simulateTransaction', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('calls the correct Tenderly URL', async () => {
    mockOkResponse(makeTxBody());
    await simulateTransaction(CREDS, PARAMS);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.tenderly.co/api/v1/account/acme/project/proj/simulate',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('sends X-Access-Key header', async () => {
    mockOkResponse(makeTxBody());
    await simulateTransaction(CREDS, PARAMS);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['X-Access-Key']).toBe('key123');
  });

  it('sends correct body fields', async () => {
    mockOkResponse(makeTxBody());
    await simulateTransaction(CREDS, PARAMS);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.network_id).toBe('1');
    expect(body.from).toBe(PARAMS.from);
    expect(body.to).toBe(PARAMS.to);
    expect(body.gas).toBe(21000);
    expect(body.save).toBe(false);
  });

  it('returns success result when tx.status is true', async () => {
    mockOkResponse(makeTxBody({ status: true, simulationId: 'abc' }));
    const result = await simulateTransaction(CREDS, PARAMS);
    expect(result.status).toBe('success');
    expect(result.traceUrl).toContain('abc');
  });

  it('returns reverted result when tx.status is false', async () => {
    mockOkResponse(
      makeTxBody({ status: false, errorMessage: 'insufficient balance' }),
    );
    const result = await simulateTransaction(CREDS, PARAMS);
    expect(result.status).toBe('reverted');
    if (result.status === 'reverted') {
      expect(result.revertReason).toBe('insufficient balance');
    }
  });

  it('returns null revertReason when error_info is absent', async () => {
    mockOkResponse(makeTxBody({ status: false }));
    const result = await simulateTransaction(CREDS, PARAMS);
    if (result.status === 'reverted') {
      expect(result.revertReason).toBeNull();
    }
  });

  it('maps asset changes correctly', async () => {
    const change = {
      token_info: {
        symbol: 'USDC',
        contract_address: '0xusdc',
        decimals: 6,
      },
      from: '0xaaaa',
      to: '0xbbbb',
      amount: '1',
    };
    mockOkResponse(makeTxBody({ assetChanges: [change] }));
    const result = await simulateTransaction(CREDS, PARAMS);
    expect(result.assetChanges).toHaveLength(1);
    expect(result.assetChanges[0]).toEqual({
      tokenSymbol: 'USDC',
      tokenAddress: '0xusdc',
      from: '0xaaaa',
      to: '0xbbbb',
      amount: '1',
    });
  });

  it('builds trace URL from simulation id', async () => {
    mockOkResponse(makeTxBody({ simulationId: 'xyz789' }));
    const result = await simulateTransaction(CREDS, PARAMS);
    expect(result.traceUrl).toBe(
      'https://dashboard.tenderly.co/acme/proj/simulation/xyz789',
    );
  });

  it('returns empty traceUrl when simulation id is missing', async () => {
    mockOkResponse({
      simulation: {},
      transaction: { status: true, transaction_info: { asset_changes: [] } },
    });
    const result = await simulateTransaction(CREDS, PARAMS);
    expect(result.traceUrl).toBe('');
  });

  it('throws on non-ok HTTP response', async () => {
    mockErrorResponse(401, 'Unauthorized');
    await expect(simulateTransaction(CREDS, PARAMS)).rejects.toThrow(
      'Tenderly API error 401',
    );
  });

  it('throws on non-ok response and includes status text', async () => {
    mockErrorResponse(403, 'Forbidden');
    await expect(simulateTransaction(CREDS, PARAMS)).rejects.toThrow('403');
  });

  it('uses "0x" when data is empty string', async () => {
    mockOkResponse(makeTxBody());
    await simulateTransaction(CREDS, { ...PARAMS, data: '' });
    const [, options] = mockFetch.mock.calls[0];
    expect(JSON.parse(options.body).input).toBe('0x');
  });

  it('falls back to "?" for missing token symbol in asset change', async () => {
    const change = {
      token_info: {},
      from: '0xaaaa',
      to: '0xbbbb',
      amount: '1',
    };
    mockOkResponse(makeTxBody({ assetChanges: [change] }));
    const result = await simulateTransaction(CREDS, PARAMS);
    expect(result.assetChanges[0].tokenSymbol).toBe('?');
  });

  it('falls back to empty string for missing token address', async () => {
    const change = {
      token_info: {},
      from: '0xaaaa',
      to: '0xbbbb',
      amount: '1',
    };
    mockOkResponse(makeTxBody({ assetChanges: [change] }));
    const result = await simulateTransaction(CREDS, PARAMS);
    expect(result.assetChanges[0].tokenAddress).toBe('');
  });

  it('falls back to "0" for missing amount', async () => {
    const change = {
      token_info: { symbol: 'ETH', contract_address: '' },
      from: '0xaaaa',
      to: '0xbbbb',
    };
    mockOkResponse(makeTxBody({ assetChanges: [change] }));
    const result = await simulateTransaction(CREDS, PARAMS);
    expect(result.assetChanges[0].amount).toBe('0');
  });

  it('uses empty string when text() throws on error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.reject(new Error('read failed')),
    });
    await expect(simulateTransaction(CREDS, PARAMS)).rejects.toThrow(
      'Tenderly API error 500: ',
    );
  });

  it('throws "Simulation timed out" when fetch is aborted', async () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortErr);
    await expect(simulateTransaction(CREDS, PARAMS)).rejects.toThrow(
      'Simulation timed out',
    );
  });

  it('re-throws non-abort fetch errors as-is', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network failure'));
    await expect(simulateTransaction(CREDS, PARAMS)).rejects.toThrow(
      'network failure',
    );
  });
});

describe('tenderlyClient.offline — simulateTransaction', () => {
  it('throws "offline"', async () => {
    await expect(simulateOffline({} as any, {} as any)).rejects.toThrow(
      'offline',
    );
  });
});
