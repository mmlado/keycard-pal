import { encodeFunctionData, parseAbiItem, type AbiFunction } from 'viem';

import {
  describeCall,
  MAX_CALL_DEPTH,
  type CallDescription,
  type CallRequest,
} from '../src/utils/callDescription';
import * as eip7730Lookup from '../src/utils/eip7730/lookup';

const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const UNKNOWN = '0x000000000000000000000000000000000000dEaD';
const RECIPIENT = '0xD3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef';
const SENDER = '0x2222222222222222222222222222222222222222';

function encode(signature: string, args: unknown[]): string {
  return encodeFunctionData({
    abi: [parseAbiItem(`function ${signature}`) as AbiFunction],
    args,
  });
}

const transfer = encode('transfer(address to, uint256 amount)', [
  RECIPIENT,
  1_500_000n,
]);
const unknownCall =
  '0xdeadbeef0000000000000000000000000000000000000000000000000000000000000001';

// The bundled index answers at once.
function describe0(request: Partial<CallRequest>): CallDescription {
  const description = describeCall({
    chainId: 1,
    contract: USDT,
    data: transfer,
    depth: 0,
    ...request,
  });
  if (description instanceof Promise) throw new Error('waited for a slice');
  return description;
}

afterEach(() => jest.restoreAllMocks());

describe('describeCall', () => {
  it("matches the registry's entry and decodes the call by its signature", () => {
    const description = describe0({ from: SENDER, value: '5' });
    expect(description).toMatchObject({
      view: 'descriptor',
      rejected: false,
      selector: '0xa9059cbb',
      decoded: { kind: 'erc20-transfer' },
      contractRow: 'token-contract',
    });
    expect(description.descriptor?.format.intent).toBe('Send');
    expect(description.descriptor?.resolvePath('@.value')).toBe('5');
    expect(description.descriptor?.resolvePath('@.from')).toBe(SENDER);
  });

  it("shows the app's own decoding, with a warning, when the request fails the entry", () => {
    jest.spyOn(eip7730Lookup, 'lookupCalldata').mockReturnValue({
      intent: 'Send',
      signature: 'transfer(address to, uint256 amount)',
      fields: [
        {
          path: 'to',
          label: 'To',
          format: 'raw',
          visible: { mustMatch: [UNKNOWN] },
        },
      ],
    });
    expect(describe0({})).toMatchObject({
      view: 'decoded',
      descriptor: null,
      rejected: true,
      decoded: { kind: 'erc20-transfer' },
    });
  });

  it('ignores an entry whose signature does not fit the bytes', () => {
    jest.spyOn(eip7730Lookup, 'lookupCalldata').mockReturnValue({
      intent: 'Send',
      signature: 'transfer(address to, uint256 amount, bytes memo)',
      fields: [],
    });
    expect(describe0({})).toMatchObject({
      view: 'decoded',
      descriptor: null,
      rejected: false,
    });
  });

  it("shows the app's own decoding alone when no entry names the call", () => {
    expect(describe0({ contract: UNKNOWN })).toMatchObject({
      view: 'decoded',
      descriptor: null,
      rejected: false,
      decoded: { kind: 'erc20-transfer' },
      contractRow: 'token-contract',
    });
  });

  it('decodes without asking the registry when the chain is unknown', () => {
    const lookup = jest.spyOn(eip7730Lookup, 'lookupCalldata');
    expect(describe0({ chainId: undefined }).view).toBe('decoded');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('shows a call nothing knows as written, selector included', () => {
    expect(describe0({ contract: UNKNOWN, data: unknownCall })).toMatchObject({
      view: 'raw',
      descriptor: null,
      selector: '0xdeadbeef',
      decoded: { kind: 'unknown-call' },
      contractRow: 'to',
    });
  });

  it('shows data without a selector as written', () => {
    expect(describe0({ data: '0x' })).toMatchObject({
      view: 'raw',
      selector: null,
      decoded: null,
    });
  });

  it('never decodes data that is not whole bytes', () => {
    const lookup = jest.spyOn(eip7730Lookup, 'lookupCalldata');
    expect(describe0({ data: transfer.slice(0, -1) })).toMatchObject({
      view: 'raw',
      selector: null,
      decoded: null,
    });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('shows a call past the depth limit as written, keeping its selector', () => {
    const lookup = jest.spyOn(eip7730Lookup, 'lookupCalldata');
    expect(describe0({ depth: MAX_CALL_DEPTH + 1 })).toMatchObject({
      view: 'raw',
      selector: '0xa9059cbb',
      decoded: null,
      contractRow: 'contract',
    });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('names the contract To for the transaction and Contract for an inner call', () => {
    expect(
      describe0({ contract: UNKNOWN, data: unknownCall }).contractRow,
    ).toBe('to');
    expect(
      describe0({ contract: UNKNOWN, data: unknownCall, depth: 1 }).contractRow,
    ).toBe('contract');
    expect(describe0({ depth: 1 }).contractRow).toBe('token-contract');
  });

  it('waits for an entry in a saved slice', async () => {
    jest.spyOn(eip7730Lookup, 'lookupCalldata').mockReturnValue(
      Promise.resolve({
        intent: 'Pay',
        signature: 'transfer(address to, uint256 amount)',
        fields: [],
      }),
    );
    const pending = describeCall({
      chainId: 1,
      contract: USDT,
      data: transfer,
      depth: 0,
    });
    expect(pending).toBeInstanceOf(Promise);
    const description = await pending;
    expect(description.view).toBe('descriptor');
    expect(description.descriptor?.format.intent).toBe('Pay');
  });
});
