import { UNLIMITED_APPROVAL_WARNING } from '@/constants/approval';
import {
  DELEGATE_CALL_WARNING,
  SAFE_MULTI_SEND_VERSIONS,
  UNKNOWN_MULTI_SEND_WARNING,
  ZERO_ADDRESS_CALL_WARNING,
} from '@/constants/safe';

import { getNativeCurrencySymbol } from '@/utils/chainMetadata';
import { customTokenRemarks } from '@/utils/customTokenChecks';
import type {
  CallPlace,
  DisplayNode,
  DisplayRow,
} from '@/utils/eip7730/display';
import { checksumEthAddress } from '@/utils/ethereumAddress';
import {
  formatTokenAmount,
  lookupToken,
  type TokenMetadata,
} from '@/utils/tokenMetadata';
import {
  weiToNative,
  type DecodedCall,
  type DecodedCallArg,
  type MultiSendCall,
} from '@/utils/txParser';

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
  chainId: number | undefined,
): DisplayNode[] {
  if (!tokenContract) {
    return token ? [{ kind: 'token', token, warnings: [] }] : [];
  }
  const address = checksumEthAddress(tokenContract);
  const contractRow: DisplayNode = {
    kind: 'address',
    label: 'Token contract',
    value: address,
    ens: true,
    warnings: [],
    ...(!token && { addToken: { chainId, address } }),
  };
  if (!token) return [contractRow];
  const { caption, warnings } = customTokenRemarks(token, chainId, address);
  return [
    { kind: 'token', token, ...(caption && { caption }), warnings },
    contractRow,
  ];
}

function multiSendItem(
  sub: MultiSendCall,
  index: number,
  count: number,
  place: CallPlace,
  zeroIsSafe: boolean,
): DisplayNode {
  const isCall = sub.operation === 'call';
  const symbol =
    place.chainId === undefined
      ? 'ETH'
      : getNativeCurrencySymbol(place.chainId);
  return {
    kind: 'item',
    title: `Call ${index + 1} of ${count}`,
    nodes: [
      isCall
        ? textRow('Operation', 'Call')
        : {
            ...textRow('Operation', 'Delegate call'),
            warnings: [DELEGATE_CALL_WARNING],
          },
      // A delegate call carries no value.
      ...(isCall ? [textRow('Value', weiToNative(sub.value, symbol))] : []),
      ...(zeroIsSafe && /^0x0{40}$/.test(sub.to)
        ? [{ kind: 'warning' as const, text: ZERO_ADDRESS_CALL_WARNING }]
        : []),
      {
        kind: 'call',
        request: {
          chainId: place.chainId,
          contract: sub.to,
          data: sub.data,
          ...(isCall && { value: sub.value.toString() }),
          depth: place.depth + 1,
        },
      },
    ],
  };
}

function displayMultiSend(
  call: Extract<DecodedCall, { kind: 'multi-send' }>,
  place: CallPlace,
): DisplayNode[] {
  const version = place.contract
    ? SAFE_MULTI_SEND_VERSIONS.get(place.contract.toLowerCase())
    : undefined;
  const nodes: DisplayNode[] = [{ kind: 'section', title: 'Safe MultiSend' }];
  if (!version) {
    nodes.push({ kind: 'warning', text: UNKNOWN_MULTI_SEND_WARNING });
  }
  if (call.error) {
    nodes.push(
      { kind: 'warning', text: call.error },
      textRow('Transactions', call.rawInput ?? '—'),
    );
    return nodes;
  }
  if (call.calls.length === 0) {
    nodes.push(textRow('Calls', 'None'));
  }
  // Before 1.5.0 the zero address is called as written.
  const zeroIsSafe = !version || version === '1.5.0';
  return [
    ...nodes,
    ...call.calls.map((sub, i) =>
      multiSendItem(sub, i, call.calls.length, place, zeroIsSafe),
    ),
  ];
}

export function displayDecodedCall(
  call: DecodedCall,
  tokenContract: string | undefined,
  chainId: number | undefined,
  depth = 0,
): DisplayNode[] {
  switch (call.kind) {
    case 'erc20-transfer': {
      const token = lookupToken(chainId, tokenContract);
      return [
        { kind: 'section', title: 'ERC-20 Transfer' },
        ...tokenContractRows(token, tokenContract, chainId),
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
        ...tokenContractRows(token, tokenContract, chainId),
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
        ...tokenContractRows(token, tokenContract, chainId),
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
    case 'multi-send':
      return displayMultiSend(call, {
        chainId,
        contract: tokenContract,
        depth,
      });
    case 'unknown-call':
      return [textRow('Contract call', call.selector)];
  }
}
