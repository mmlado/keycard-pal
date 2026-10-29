import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import Eip712JsonPanel from '../src/components/SignRequestDetail/eth/DataTabPanel/Eip712JsonPanel';
import { MISCASED_ADDRESS_WARNING } from '../src/constants/eip712';
import { DESCRIPTOR_CHECK_FAILED_WARNING } from '../src/constants/eip7730';

import type { Eip712Summary } from '../src/utils/eip712';
import { NOT_REVIEWED_TEXT } from '../src/utils/eip7730/source';
import { checksumEthAddress } from '../src/utils/ethereumAddress';
import { classifyEthPayload } from '../src/utils/ethPayload';
import { wcRequestToScanResult } from '../src/utils/walletConnect/requestAdapter';
import type { EthSignRequest } from '../src/types';

// The classification SignRequestDetail hands the panel.
function Panel(
  props: Omit<React.ComponentProps<typeof Eip712JsonPanel>, 'payload'>,
) {
  return (
    <Eip712JsonPanel
      {...props}
      payload={classifyEthPayload(
        props.request.signData,
        props.request.dataType,
      )}
    />
  );
}

const CYFRIN = '0x3846c3A30E62075Fa916216b35EF04B8F53931f6';

jest.mock('react-native-paper', () => {
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    Text: ({ children, ...props }: any) => <Text {...props}>{children}</Text>,
    Icon: () => <View />,
    SegmentedButtons: ({
      buttons,
      onValueChange,
    }: {
      value: string;
      onValueChange: (v: string) => void;
      buttons: { value: string; label: string }[];
    }) => (
      <View>
        {buttons.map((b: any) => (
          <TouchableOpacity
            key={b.value}
            onPress={() => onValueChange(b.value)}
          >
            <Text>{b.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
  };
});

jest.mock('../src/theme', () => ({
  __esModule: true,
  default: {
    colors: {
      onSurfaceVariant: '#aaa',
      negative: '#f00',
      primary: '#1e88e5',
    },
  },
}));

jest.mock('../src/components/InfoRow', () => {
  const { Text } = require('react-native');
  return ({ label, value }: { label: string; value: string }) => (
    <Text>{`${label}: ${value}`}</Text>
  );
});

jest.mock('../src/components/ens/AddressInfoRow.online', () => {
  const { Text } = require('react-native');
  return ({ label, value }: { label: string; value: string }) => (
    <Text>{`ADDR ${label}: ${value}`}</Text>
  );
});

jest.mock(
  '../src/components/SignRequestDetail/eth/DataTabPanel/SpecialEip712Section',
  () => {
    const { Text } = require('react-native');
    return () => <Text>SpecialEip712Section</Text>;
  },
);

const mockLookupEip712 = jest.fn();
jest.mock('../src/utils/eip7730/lookup', () => ({
  lookupEip712: (...args: any[]) => mockLookupEip712(...args),
  getSavedIndex: () => null,
  subscribeSavedIndex: () => () => {},
}));

beforeEach(() => jest.clearAllMocks());

const VERIFYING = '0x000000000022d473030f116ddee9f6b43ac78ba3';

function buildPayload(message: Record<string, unknown>) {
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      PermitSingle: [
        { name: 'spender', type: 'address' },
        { name: 'sigDeadline', type: 'uint256' },
      ],
    },
    primaryType: 'PermitSingle',
    domain: {
      name: 'Permit2',
      verifyingContract: VERIFYING,
      chainId: 1,
    },
    message,
  };
}

function buildRequest(payload: object): EthSignRequest {
  return {
    signData: Buffer.from(JSON.stringify(payload), 'utf8').toString('hex'),
    dataType: 2,
    derivationPath: "m/44'/60'/0'/0",
  };
}

function buildSummary(message: Record<string, string>): Eip712Summary {
  return {
    rawJson: JSON.stringify(buildPayload(message), null, 2),
    miscasedAddresses: [],
    primaryType: 'PermitSingle',
    domain: {
      name: 'Permit2',
      verifyingContract: VERIFYING,
      chainId: '1',
    },
    message,
  };
}

describe('Eip712JsonPanel EIP-7730 integration', () => {
  it('renders descriptor intent and fields when the app has no reviewer of its own', () => {
    mockLookupEip712.mockReturnValue({
      intent: 'Approve spender',
      fields: [
        { path: 'spender', label: 'Spender', format: 'addressName' },
        { path: 'sigDeadline', label: 'Expires', format: 'date' },
      ],
    });
    const payload = buildPayload({
      spender: '0xabc0000000000000000000000000000000000001',
      sigDeadline: '1700000000',
    });
    const eip712 = buildSummary({
      spender: '0xabc0000000000000000000000000000000000001',
      sigDeadline: '1700000000',
    });

    render(
      <Panel request={buildRequest(payload)} eip712={eip712} chainId={1} />,
    );

    expect(screen.getByText('Approve spender')).toBeTruthy();
    expect(screen.getByTestId('descriptor-source')).toBeTruthy();
    expect(screen.getByText(NOT_REVIEWED_TEXT)).toBeTruthy();
    expect(
      screen.getByText(
        'ADDR Spender: 0xABC0000000000000000000000000000000000001',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('SpecialEip712Section')).toBeNull();
  });

  function renderPermit() {
    const eip712 = {
      ...buildSummary({ spender: '0xabc', sigDeadline: '1' }),
      special: { kind: 'permit' } as any,
    };
    render(
      <Panel
        request={buildRequest(
          buildPayload({ spender: '0xabc', sigDeadline: '1' }),
        )}
        eip712={eip712}
        chainId={1}
      />,
    );
  }

  it("lets a reviewed descriptor replace the app's own Permit reviewer", () => {
    mockLookupEip712.mockReturnValue({
      intent: 'Approve spender',
      fields: [],
      reviewedBy: [CYFRIN],
    });
    renderPermit();
    expect(screen.getByText('Approve spender')).toBeTruthy();
    expect(screen.getByText('Reviewed by Cyfrin')).toBeTruthy();
    expect(screen.queryByText('SpecialEip712Section')).toBeNull();
  });

  it("keeps the app's own Permit reviewer over a descriptor nobody reviewed", () => {
    mockLookupEip712.mockReturnValue({ intent: 'Approve spender', fields: [] });
    renderPermit();
    expect(screen.getByText('SpecialEip712Section')).toBeTruthy();
    expect(screen.queryByText('Approve spender')).toBeNull();
  });

  it('counts only a trusted attester as a review', () => {
    mockLookupEip712.mockReturnValue({
      intent: 'Approve spender',
      fields: [],
      reviewedBy: ['0x00000000000000000000000000000000000000aa'],
    });
    renderPermit();
    expect(screen.getByText('SpecialEip712Section')).toBeTruthy();
  });

  it('looks the descriptor up by encoded type and passes the message domain', () => {
    mockLookupEip712.mockReturnValue(null);
    const payload = buildPayload({ spender: '0xabc', sigDeadline: '1' });
    render(
      <Panel
        request={buildRequest(payload)}
        eip712={buildSummary({ spender: '0xabc', sigDeadline: '1' })}
        chainId={1}
      />,
    );
    expect(mockLookupEip712).toHaveBeenCalledWith(
      1,
      VERIFYING,
      'PermitSingle(address spender,uint256 sigDeadline)',
      payload.domain,
    );
  });

  it('reads WalletConnect typed data from the request the adapter hands over', () => {
    mockLookupEip712.mockReturnValue(null);
    const payload = buildPayload({ spender: '0xabc', sigDeadline: '1' });
    const signer = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    const scan = wcRequestToScanResult(
      {
        id: 1,
        topic: 'topic',
        method: 'eth_signTypedData_v4',
        params: [signer, JSON.stringify(payload)],
      },
      new Map([[signer.toLowerCase(), "m/44'/60'/0'/0/0"]]),
    );
    if (scan.kind !== 'eth-sign-request') throw new Error(scan.kind);
    render(
      <Panel
        request={scan.request}
        eip712={buildSummary({ spender: '0xabc', sigDeadline: '1' })}
        chainId={undefined}
      />,
    );
    expect(mockLookupEip712).toHaveBeenCalledWith(
      1,
      VERIFYING,
      'PermitSingle(address spender,uint256 sigDeadline)',
      payload.domain,
    );
  });

  it('reads @. fields from the message container', () => {
    mockLookupEip712.mockReturnValue({
      intent: 'Sign',
      fields: [
        { path: '@.to', label: 'Contract', format: 'raw' },
        { path: '@.from', label: 'Signer', format: 'raw' },
      ],
    });
    const payload = buildPayload({ spender: '0xabc', sigDeadline: '1' });
    render(
      <Panel
        request={{
          ...buildRequest(payload),
          address: '0x00000000000000000000000000000000000000aa',
        }}
        eip712={buildSummary({ spender: '0xabc', sigDeadline: '1' })}
        chainId={1}
      />,
    );
    expect(
      screen.getByText(`Contract: ${checksumEthAddress(VERIFYING)}`),
    ).toBeTruthy();
    expect(
      screen.getByText(
        `Signer: ${checksumEthAddress(
          '0x00000000000000000000000000000000000000aa',
        )}`,
      ),
    ).toBeTruthy();
  });

  it('writes an address field in ERC-55 and leaves a string that looks like one alone', () => {
    const mixed = '0xa0b86991c6218b36C1d19d4a2e9eb0ce3606eb48';
    mockLookupEip712.mockReturnValue({
      intent: 'Permit',
      fields: [
        { path: 'spender', label: 'Spender', format: 'raw' },
        { path: 'note', label: 'Note', format: 'raw' },
      ],
    });
    const payload = {
      ...buildPayload({ spender: mixed, sigDeadline: '1' }),
      types: {
        ...buildPayload({}).types,
        PermitSingle: [
          { name: 'spender', type: 'address' },
          { name: 'note', type: 'string' },
        ],
      },
      message: { spender: mixed, note: mixed },
    };
    render(
      <Panel
        request={buildRequest(payload)}
        eip712={buildSummary({ spender: mixed, note: mixed })}
        chainId={1}
      />,
    );
    expect(
      screen.getByText(`Spender: ${checksumEthAddress(mixed)}`),
    ).toBeTruthy();
    expect(screen.getByText(`Note: ${mixed}`)).toBeTruthy();
  });

  it('falls back to SpecialEip712Section when descriptor not found', () => {
    mockLookupEip712.mockReturnValue(null);
    const eip712 = {
      ...buildSummary({ spender: '0xabc' }),
      special: { kind: 'permit' } as any,
    };
    render(
      <Panel
        request={buildRequest(buildPayload({ spender: '0xabc' }))}
        eip712={eip712}
        chainId={1}
      />,
    );
    expect(screen.getByText('SpecialEip712Section')).toBeTruthy();
  });

  it("shows the entry's sentence in place of its intent", () => {
    mockLookupEip712.mockReturnValue({
      intent: 'Approve spender',
      interpolatedIntent: 'Allow {spender} to spend',
      fields: [{ path: 'spender', label: 'Spender', format: 'addressName' }],
    });
    const message = {
      spender: '0xabc0000000000000000000000000000000000001',
      sigDeadline: '1',
    };
    render(
      <Panel
        request={buildRequest(buildPayload(message))}
        eip712={buildSummary(message)}
        chainId={1}
      />,
    );
    expect(
      screen.getByText(
        'Allow 0xABC0000000000000000000000000000000000001 to spend',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Approve spender')).toBeNull();
  });

  it('shows neither reviewer while a saved slice is read', async () => {
    let finish: (format: unknown) => void = () => {};
    mockLookupEip712.mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    const eip712 = {
      ...buildSummary({ spender: '0xabc' }),
      special: { kind: 'permit' } as any,
    };
    render(
      <Panel
        request={buildRequest(buildPayload({ spender: '0xabc' }))}
        eip712={eip712}
        chainId={1}
      />,
    );
    expect(screen.queryByText('SpecialEip712Section')).toBeNull();

    await act(async () =>
      finish({ intent: 'Approve spender', fields: [], reviewedBy: [CYFRIN] }),
    );
    expect(screen.getByText('Approve spender')).toBeTruthy();
    expect(screen.queryByText('SpecialEip712Section')).toBeNull();
  });

  it('does not call lookup when verifyingContract is missing', () => {
    const payload = {
      types: { EIP712Domain: [], Mail: [] },
      primaryType: 'Mail',
      domain: { name: 'NoContract' },
      message: {},
    };
    const eip712: Eip712Summary = {
      rawJson: JSON.stringify(payload),
      miscasedAddresses: [],
      primaryType: 'Mail',
      domain: { name: 'NoContract' },
      message: {},
    };
    render(
      <Panel request={buildRequest(payload)} eip712={eip712} chainId={1} />,
    );
    expect(mockLookupEip712).not.toHaveBeenCalled();
  });

  it("looks up the domain's chain, not the request's", () => {
    mockLookupEip712.mockReturnValue(null);
    const payload = {
      ...buildPayload({}),
      domain: {
        name: 'Permit2',
        verifyingContract: VERIFYING,
        chainId: '0x89',
      },
    };
    render(
      <Panel
        request={buildRequest(payload)}
        eip712={buildSummary({})}
        chainId={1}
      />,
    );
    expect(mockLookupEip712).toHaveBeenCalledWith(
      137,
      VERIFYING,
      expect.any(String),
      payload.domain,
    );
  });

  it('does not call lookup when the domain names no chain', () => {
    const payload = {
      ...buildPayload({}),
      domain: { name: 'Permit2', verifyingContract: VERIFYING },
    };
    render(
      <Panel
        request={buildRequest(payload)}
        eip712={buildSummary({})}
        chainId={1}
      />,
    );
    expect(mockLookupEip712).not.toHaveBeenCalled();
  });
  it('does not repeat the verifying contract as an unknown token contract', () => {
    mockLookupEip712.mockReturnValue({
      intent: 'Permit',
      fields: [
        {
          path: 'sigDeadline',
          label: 'Amount',
          format: 'tokenAmount',
          params: { tokenPath: '@.to' },
        },
      ],
    });
    const message = { spender: '0xabc', sigDeadline: '5' };
    render(
      <Panel
        request={buildRequest(buildPayload(message))}
        eip712={buildSummary(message)}
        chainId={1}
      />,
    );
    expect(screen.getByText('Unknown token')).toBeTruthy();
    expect(
      screen.getByText(`ADDR verifyingContract: ${VERIFYING}`),
    ).toBeTruthy();
    expect(screen.queryByText(/Token contract/)).toBeNull();
  });

  it('warns under a descriptor field holding an address the request wrote with a wrong checksum', () => {
    mockLookupEip712.mockReturnValue({
      intent: 'Permit',
      fields: [{ path: 'spender', label: 'Spender', format: 'addressName' }],
    });
    // Mixed case, not the EIP-55 form.
    const spender = '0xd3CDa913deb6F4967B2eF3Aa68F5a843da74c4Ef';
    const message = { spender, sigDeadline: '5' };
    render(
      <Panel
        request={buildRequest(buildPayload(message))}
        eip712={buildSummary(message)}
        chainId={1}
      />,
    );
    expect(
      screen.getByText(`ADDR Spender: ${checksumEthAddress(spender)}`),
    ).toBeTruthy();
    expect(screen.getByText(MISCASED_ADDRESS_WARNING)).toBeTruthy();
  });

  it('drops an entry whose bundled lists differ in length, and says so', () => {
    const group = { id: 0, iteration: 'bundled' };
    mockLookupEip712.mockReturnValue({
      intent: 'Batch',
      fields: [
        { path: 'tokens.[]', label: 'Token', format: 'raw', group },
        { path: 'amounts.[]', label: 'Amount', format: 'raw', group },
      ],
    });
    const message = { tokens: ['0x01', '0x02'], amounts: ['1'] } as any;
    render(
      <Panel
        request={buildRequest(buildPayload(message))}
        eip712={buildSummary(message)}
        chainId={1}
      />,
    );
    expect(screen.getByText(DESCRIPTOR_CHECK_FAILED_WARNING)).toBeTruthy();
    expect(screen.queryByText('Batch')).toBeNull();
  });

  describe('visibility rules', () => {
    const SPENDER = '0xabc0000000000000000000000000000000000001';

    function renderWith(fields: object[], sigDeadline: string) {
      mockLookupEip712.mockReturnValue({ intent: 'Approve spender', fields });
      const message = { spender: SPENDER, sigDeadline };
      render(
        <Panel
          request={buildRequest(buildPayload(message))}
          eip712={buildSummary(message)}
          chainId={1}
        />,
      );
    }

    const expires = {
      path: 'sigDeadline',
      label: 'Expires',
      format: 'date',
      visible: { ifNotIn: ['0'] },
    };

    it('hides a field whose value its ifNotIn list names', () => {
      renderWith([expires], '0');
      expect(screen.getByText('Approve spender')).toBeTruthy();
      expect(screen.queryByText(/Expires/)).toBeNull();
      expect(screen.queryByText('Message')).toBeNull();
    });

    it('shows it for any other value', () => {
      renderWith([expires], '1700000000');
      expect(screen.getByText(/Expires/)).toBeTruthy();
    });

    it('uses an entry whose mustMatch value is listed, the field hidden', () => {
      renderWith(
        [
          {
            path: 'spender',
            label: 'Spender',
            visible: { mustMatch: [SPENDER] },
          },
          { path: 'sigDeadline', label: 'Deadline', format: 'raw' },
        ],
        '5',
      );
      expect(screen.getByText('Approve spender')).toBeTruthy();
      expect(screen.getByText('Deadline: 5')).toBeTruthy();
      expect(screen.queryByText(/Spender/)).toBeNull();
      expect(screen.queryByText(DESCRIPTOR_CHECK_FAILED_WARNING)).toBeNull();
    });

    it('drops an entry whose mustMatch value is not listed, and says so', () => {
      renderWith(
        [
          {
            path: 'spender',
            label: 'Spender',
            visible: { mustMatch: ['0x1'] },
          },
          { path: 'sigDeadline', label: 'Deadline', format: 'raw' },
        ],
        '5',
      );
      expect(screen.getByText(DESCRIPTOR_CHECK_FAILED_WARNING)).toBeTruthy();
      expect(screen.queryByText('Approve spender')).toBeNull();
      expect(screen.queryByText('Deadline: 5')).toBeNull();
      expect(screen.getByText('Message Fields')).toBeTruthy();
      expect(screen.getByText(`ADDR spender: ${SPENDER}`)).toBeTruthy();
    });
  });
});
