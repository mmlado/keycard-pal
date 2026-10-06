import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import PersonalMessagePanel from '../src/components/SignRequestDetail/eth/DataTabPanel/PersonalMessagePanel';
import { ERC191_DIGEST_EXPLAINER } from '../src/constants/erc8213';
import type { EthSignRequest } from '../src/types';
import { classifyEthPayload } from '../src/utils/ethPayload';

jest.mock('react-native-paper', () => {
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    Text: ({ children, ...props }: any) => <Text {...props}>{children}</Text>,
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
  default: { colors: { onSurfaceVariant: '#aaa', negative: '#f00' } },
}));

jest.mock('../src/components/InfoRow', () => {
  const { Text } = require('react-native');
  return ({ label, value }: { label: string; value: string }) => (
    <Text>{`${label}: ${value}`}</Text>
  );
});

// keccak256("\x19Ethereum Signed Message:\n11hello world")
const HELLO_WORLD_DIGEST =
  '0xd9eba16ed0ecae432b71fe008c98cc872bb4cc214d3220a36f365326cf807d68';

const SIWE_MESSAGE =
  'example.com wants you to sign in with your Ethereum account:\n' +
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2\n' +
  '\n' +
  'URI: https://example.com\n' +
  'Version: 1\n' +
  'Chain ID: 1\n' +
  'Nonce: 32891756\n' +
  'Issued At: 2026-10-05T10:00:00Z';

function requestFor(signData: string): EthSignRequest {
  return { signData, dataType: 3, derivationPath: "m/44'/60'/0'/0" };
}

function renderPanel(signData: string) {
  const request = requestFor(signData);
  const payload = classifyEthPayload(request.signData, request.dataType);
  if (payload.kind !== 'personal-message') throw new Error('unreachable');
  return render(<PersonalMessagePanel message={payload} request={request} />);
}

describe('PersonalMessagePanel', () => {
  it('shows the decoded message on the Message tab by default', () => {
    renderPanel(Buffer.from('hello world', 'utf8').toString('hex'));
    expect(screen.getByText('Message: hello world')).toBeTruthy();
  });

  it('decodes a SIWE login message with its line breaks', () => {
    renderPanel(Buffer.from(SIWE_MESSAGE, 'utf8').toString('hex'));
    expect(screen.getByText(`Message: ${SIWE_MESSAGE}`)).toBeTruthy();
  });

  it('decodes multi-byte UTF-8', () => {
    renderPanel(Buffer.from('héllo €', 'utf8').toString('hex'));
    expect(screen.getByText('Message: héllo €')).toBeTruthy();
  });

  it('shows the ERC-191 Digest as 0x-prefixed hex with the explainer', () => {
    renderPanel(Buffer.from('hello world', 'utf8').toString('hex'));
    fireEvent.press(screen.getByText('Digests'));
    expect(
      screen.getByText(`ERC-191 Digest: ${HELLO_WORLD_DIGEST}`),
    ).toBeTruthy();
    expect(screen.getByText(ERC191_DIGEST_EXPLAINER)).toBeTruthy();
    expect(screen.getByTestId('digest-explainer')).toBeTruthy();
  });

  it('shows the signData hex on the Raw tab', () => {
    const hex = Buffer.from('hello world', 'utf8').toString('hex');
    renderPanel(hex);
    fireEvent.press(screen.getByText('Raw'));
    expect(screen.getByText(`Data: ${hex}`)).toBeTruthy();
  });

  it('shows hex and a note when the bytes are not UTF-8', () => {
    renderPanel('fffe80');
    expect(screen.getByText('Message: fffe80')).toBeTruthy();
    expect(screen.getByText(/not UTF-8 text/)).toBeTruthy();
  });

  it('still shows the ERC-191 Digest when the bytes are not UTF-8', () => {
    renderPanel('fffe80');
    fireEvent.press(screen.getByText('Digests'));
    expect(screen.getByText(/ERC-191 Digest: 0x[0-9a-f]{64}/)).toBeTruthy();
  });

  it('says so when the message is empty', () => {
    renderPanel('');
    expect(screen.getByText('The message is empty.')).toBeTruthy();
    expect(screen.queryByText(/^Message:/)).toBeNull();
  });
});
