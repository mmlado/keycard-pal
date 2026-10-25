import { UNLIMITED_APPROVAL_WARNING } from '@/constants/approval';

import type { DisplayNode, DisplayRow } from '@/utils/eip7730/display';
import { checksumEthAddress } from '@/utils/ethereumAddress';
import {
  formatTokenAmount,
  lookupToken,
  type TokenMetadata,
} from '@/utils/tokenMetadata';
import type { DecodedCall, DecodedCallArg } from '@/utils/txParser';

const UINT256_MAX = 2n ** 256n - 1n;

const textRow = (label: string, value: string): DisplayRow => ({
  kind: 'text',
  label,
  value,
  warnings: [],
});

const addressRow = (label: string, value: string): DisplayRow => ({
  kind: 'address',
  label,
  value,
  ens: true,
  warnings: [],
});

function argRow(arg: DecodedCallArg): DisplayRow {
  const label = `${arg.name} (${arg.type})`;
  return arg.type === 'address'
    ? addressRow(label, arg.value)
    : textRow(label, arg.value);
}

const amountText = (amount: bigint, token: TokenMetadata | null) =>
  token ? formatTokenAmount(amount, token) : amount.toString();

export function tokenContractRows(
  token: TokenMetadata | null,
  tokenContract: string | undefined,
): DisplayNode[] {
  return [
    ...(token ? [{ kind: 'token' as const, token }] : []),
    ...(tokenContract
      ? [addressRow('Token contract', checksumEthAddress(tokenContract))]
      : []),
  ];
}

export function displayDecodedCall(
  call: DecodedCall,
  tokenContract: string | undefined,
  chainId: number | undefined,
): DisplayNode[] {
  switch (call.kind) {
    case 'erc20-transfer': {
      const token = lookupToken(chainId, tokenContract);
      return [
        { kind: 'section', title: 'ERC-20 Transfer' },
        ...tokenContractRows(token, tokenContract),
        addressRow('Recipient', call.to),
        textRow(
          token ? 'Amount' : 'Amount (raw units)',
          amountText(call.amount, token),
        ),
      ];
    }
    case 'erc20-transferFrom': {
      const token = lookupToken(chainId, tokenContract);
      return [
        { kind: 'section', title: 'ERC-20 Transfer From' },
        ...tokenContractRows(token, tokenContract),
        addressRow('From', call.from),
        addressRow('Recipient', call.to),
        textRow(
          token ? 'Amount' : 'Amount (raw units)',
          amountText(call.amount, token),
        ),
      ];
    }
    case 'erc20-approve': {
      const token = lookupToken(chainId, tokenContract);
      const unlimited = call.amount === UINT256_MAX;
      const allowance = unlimited
        ? token
          ? `Unlimited ${token.symbol}`
          : 'Unlimited'
        : amountText(call.amount, token);
      return [
        { kind: 'section', title: 'ERC-20 Approve' },
        ...tokenContractRows(token, tokenContract),
        addressRow('Spender', call.spender),
        {
          ...textRow('Allowance', allowance),
          warnings: unlimited ? [UNLIMITED_APPROVAL_WARNING] : [],
        },
      ];
    }
    case 'contract-call':
      return [
        { kind: 'section', title: 'Contract Call' },
        textRow('Function', call.signature),
        ...call.args.map(argRow),
        ...(call.highRisk
          ? [
              {
                kind: 'warning' as const,
                text: `High-risk approval: ${
                  call.risk ?? 'review this contract permission carefully'
                }`,
              },
            ]
          : []),
      ];
    case 'universal-router-execute':
      return [
        { kind: 'section', title: 'Uniswap Universal Router' },
        ...(call.deadline ? [textRow('Deadline', call.deadline)] : []),
        ...(call.error ? [{ kind: 'warning' as const, text: call.error }] : []),
        ...call.commands.map(
          (command): DisplayNode => ({
            kind: 'group',
            rows: [
              textRow(
                `Command ${command.index + 1}`,
                `${command.name}${
                  command.allowRevert ? ' (allow revert)' : ''
                }`,
              ),
              ...command.args.map(argRow),
              ...(command.error ? [textRow('Decode', command.error)] : []),
              ...(command.rawInput ? [textRow('Input', command.rawInput)] : []),
            ],
          }),
        ),
      ];
    case 'unknown-call':
      return [textRow('Contract call', call.selector)];
  }
}
