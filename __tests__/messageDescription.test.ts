// The bundled index; no bundled entry fails its rules or waits for a slice, so those cases stub the lookup.
import type { Eip712RawTypedData } from '../src/utils/eip712';
import { displayMessage, type DisplayNode } from '../src/utils/eip7730/display';
import * as lookup from '../src/utils/eip7730/lookup';
import { checksumEthAddress } from '../src/utils/ethereumAddress';
import {
  describeMessage,
  type MessageDescription,
} from '../src/utils/messageDescription';

jest.mock('../src/utils/eip7730/lookup', () => {
  const actual = jest.requireActual('../src/utils/eip7730/lookup');
  return { ...actual, lookupEip712: jest.fn(actual.lookupEip712) };
});

const mockLookupEip712 = lookup.lookupEip712 as jest.MockedFunction<
  typeof lookup.lookupEip712
>;

const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const SIGNER = '0xd3cda913deb6f4967b2ef3aa68f5a843da74c4ef';
const RECIPIENT = '0x1111111254eeb25477b68fb85ed929f73a960582';
const ENCODED_TYPE =
  'TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)';

function transferWithAuthorization(
  domain: Record<string, unknown> = {},
  message: Record<string, unknown> = {},
): Eip712RawTypedData {
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    domain: {
      name: 'USD Coin',
      version: '2',
      chainId: 1,
      verifyingContract: USDC,
      ...domain,
    },
    message: {
      from: SIGNER,
      to: RECIPIENT,
      value: '1500000',
      validAfter: '0',
      validBefore: '1800000000',
      nonce: `0x${'11'.repeat(32)}`,
      ...message,
    },
  };
}

function now(
  result: MessageDescription | Promise<MessageDescription>,
): MessageDescription {
  if (result instanceof Promise)
    throw new Error('bundled lookup returned a promise');
  return result;
}

function rowValue(nodes: DisplayNode[], label: string): string | undefined {
  for (const node of nodes) {
    if (
      (node.kind === 'text' || node.kind === 'address') &&
      node.label === label
    )
      return node.value;
  }
  return undefined;
}

// One letter's case flipped from the EIP-55 form, so it is mixed case and wrong.
function miscased(address: string): string {
  const good = checksumEthAddress(address);
  const at = good.slice(2).search(/[a-f]/i) + 2;
  const letter = good[at];
  const flipped =
    letter === letter.toLowerCase()
      ? letter.toUpperCase()
      : letter.toLowerCase();
  return good.slice(0, at) + flipped + good.slice(at + 1);
}

beforeEach(() => mockLookupEip712.mockClear());

describe('describeMessage', () => {
  it('describes a message by the bundled entry for its domain', () => {
    const typed = transferWithAuthorization();
    const description = now(describeMessage(typed, SIGNER));
    expect(description.descriptor?.format.intent).toBe(
      'Authorize USDC transfer',
    );
    expect(description.rejected).toBe(false);
    expect(description.chainId).toBe(1);
    expect(description.verifyingContract).toBe(USDC);
    expect(mockLookupEip712).toHaveBeenCalledWith(
      1,
      USDC,
      ENCODED_TYPE,
      typed.domain,
    );
  });

  it('matches a verifying contract written with an uppercase 0X, as the lookup ignores case', () => {
    const written = `0X${USDC.slice(2).toUpperCase()}`;
    const description = now(
      describeMessage(
        transferWithAuthorization({ verifyingContract: written }),
        SIGNER,
      ),
    );
    expect(description.verifyingContract).toBe(written);
    expect(description.descriptor?.format.intent).toBe(
      'Authorize USDC transfer',
    );
  });

  it('finds no entry for a verifying contract that is not an address', () => {
    const description = now(
      describeMessage(
        transferWithAuthorization({ verifyingContract: 'Permit2' }),
        SIGNER,
      ),
    );
    expect(description.descriptor).toBeNull();
    expect(description.rejected).toBe(false);
  });

  it('reads the signer as @.from and the verifying contract as @.to', () => {
    const description = now(
      describeMessage(transferWithAuthorization(), SIGNER),
    );
    const { resolvePath } = description.descriptor!;
    expect(resolvePath('@.from')).toBe(checksumEthAddress(SIGNER));
    expect(resolvePath('@.to')).toBe(checksumEthAddress(USDC));
    expect(resolvePath('@.value')).toBe('0');
    // The entry takes its token from @.to.
    const display = displayMessage(description.descriptor!, description);
    expect(rowValue(display.nodes, 'Amount')).toBe('1.5 USDC');
  });

  it('takes the chain from the domain, hex included', () => {
    const description = now(
      describeMessage(transferWithAuthorization({ chainId: '0x1' }), SIGNER),
    );
    expect(description.chainId).toBe(1);
    expect(description.descriptor?.format.intent).toBe(
      'Authorize USDC transfer',
    );
  });

  // The signature would not be valid on the entry's contract, so its intent would mislead.
  it.each([
    ['verifyingContract', 'string'],
    ['verifyingContract', 'bytes'],
    ['chainId', 'string'],
    ['version', 'uint256'],
  ])('answers no entry when the domain declares %s as %s', (field, type) => {
    const typed = transferWithAuthorization();
    const retyped: Eip712RawTypedData = {
      ...typed,
      types: {
        ...typed.types,
        EIP712Domain: (
          typed.types.EIP712Domain as { name: string; type: string }[]
        ).map(m => (m.name === field ? { ...m, type } : m)),
      },
    };
    const description = now(describeMessage(retyped, SIGNER));
    expect(description.descriptor).toBeNull();
    expect(description.rejected).toBe(false);
    expect(mockLookupEip712).not.toHaveBeenCalled();
  });

  it.each([
    [
      'declares a standard field twice',
      [{ name: 'verifyingContract', type: 'address' }],
      {},
    ],
    [
      'declares a field whose name is not a string',
      [{ name: ['salt'], type: 'bytes32' }],
      {},
    ],
    [
      'declares a field EIP-712 does not define',
      [{ name: 'foo', type: 'string' }],
      { foo: 'x' },
    ],
  ])('answers no entry when the domain %s', (_, extra, domain) => {
    const typed = transferWithAuthorization(domain);
    const declared: Eip712RawTypedData = {
      ...typed,
      types: {
        ...typed.types,
        EIP712Domain: [...(typed.types.EIP712Domain as unknown[]), ...extra],
      },
    };
    const description = now(describeMessage(declared, SIGNER));
    expect(description.descriptor).toBeNull();
    expect(mockLookupEip712).not.toHaveBeenCalled();
  });

  it('answers no entry when the domain declares its fields in another order', () => {
    const typed = transferWithAuthorization();
    const reordered: Eip712RawTypedData = {
      ...typed,
      types: {
        ...typed.types,
        EIP712Domain: [...(typed.types.EIP712Domain as unknown[])].reverse(),
      },
    };
    const description = now(describeMessage(reordered, SIGNER));
    expect(description.descriptor).toBeNull();
    expect(description.rejected).toBe(false);
    expect(mockLookupEip712).not.toHaveBeenCalled();
  });

  it('describes a message whose domain type is not declared', () => {
    const typed = transferWithAuthorization();
    delete typed.types.EIP712Domain;
    const description = now(describeMessage(typed, SIGNER));
    expect(description.descriptor?.format.intent).toBe(
      'Authorize USDC transfer',
    );
  });

  it('answers no entry for a domain the entry does not name', () => {
    const description = now(
      describeMessage(transferWithAuthorization({ name: 'Fake Coin' }), SIGNER),
    );
    expect(description).toEqual({
      descriptor: null,
      rejected: false,
      chainId: 1,
      verifyingContract: USDC,
    });
  });

  it.each([
    ['no typed data', null],
    [
      'a domain without a chain',
      transferWithAuthorization({ chainId: undefined }),
    ],
    [
      'a domain without a verifying contract',
      transferWithAuthorization({ verifyingContract: undefined }),
    ],
    [
      'an empty verifying contract',
      transferWithAuthorization({ verifyingContract: '' }),
    ],
    [
      'a verifying contract that is not a string',
      transferWithAuthorization({ verifyingContract: 42 }),
    ],
    ['no primary type', { ...transferWithAuthorization(), primaryType: '' }],
  ])('looks nothing up for %s', (_, typed) => {
    const description = now(describeMessage(typed, SIGNER));
    expect(description.descriptor).toBeNull();
    expect(description.rejected).toBe(false);
    expect(mockLookupEip712).not.toHaveBeenCalled();
  });

  it('rejects the entry for a request outside its mustMatch list, and keeps it for one inside', () => {
    const typed = transferWithAuthorization();
    const format = now(describeMessage(typed, SIGNER)).descriptor!.format;
    const onlyTo = (allowed: string) => ({
      ...format,
      fields: format.fields.map(field =>
        field.path === 'to'
          ? { ...field, visible: { mustMatch: [allowed] } }
          : field,
      ),
    });

    mockLookupEip712.mockReturnValueOnce(onlyTo(SIGNER));
    expect(now(describeMessage(typed, SIGNER))).toEqual({
      descriptor: null,
      rejected: true,
      chainId: 1,
      verifyingContract: USDC,
    });

    mockLookupEip712.mockReturnValueOnce(onlyTo(RECIPIENT));
    const kept = now(describeMessage(typed, SIGNER));
    expect(kept.rejected).toBe(false);
    expect(kept.descriptor).not.toBeNull();
  });

  it('marks a declared address the request wrote with a wrong checksum', () => {
    const description = now(
      describeMessage(
        transferWithAuthorization({}, { to: miscased(RECIPIENT) }),
        SIGNER,
      ),
    );
    expect(description.descriptor!.miscasedAt('to')).toBe(true);
    expect(description.descriptor!.miscasedAt('from')).toBe(false);
  });

  it('waits while a saved slice is read, then answers the same way', async () => {
    const typed = transferWithAuthorization();
    const format = now(describeMessage(typed, SIGNER)).descriptor!.format;
    mockLookupEip712.mockReturnValueOnce(Promise.resolve(format));

    const pending = describeMessage(typed, SIGNER);
    expect(pending).toBeInstanceOf(Promise);
    const description = await pending;
    expect(description.descriptor?.format).toBe(format);
    expect(description.descriptor?.resolvePath('@.to')).toBe(
      checksumEthAddress(USDC),
    );
  });
});
