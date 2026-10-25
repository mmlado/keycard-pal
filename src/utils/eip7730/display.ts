import { MISCASED_ADDRESS_WARNING } from '@/constants/eip712';
import { DESCRIPTOR_CHECK_FAILED_WARNING } from '@/constants/eip7730';

import type {
  CallDescription,
  CallRequest,
  MatchedDescriptor,
} from '@/utils/callDescription';
import {
  displayDecodedCall,
  tokenContractRows,
} from '@/utils/decodedCallDisplay';
import { checksumEthAddress } from '@/utils/ethereumAddress';
import { lookupToken, type TokenMetadata } from '@/utils/tokenMetadata';

import {
  arrayIndices,
  bindField,
  firstArraySelector,
  type ArraySelector,
} from './arrays';
import {
  describeFieldValue,
  interpolateIntent,
  SENDER_TEXT,
  type Eip7730FieldContext,
  type FieldValue,
} from './format';
import { descriptorReview } from './source';
import { isFieldShown, shownFields } from './visibility';
import {
  interpolationParts,
  type Eip7730DisplayFormat,
  type Eip7730Field,
} from './zip';

export const ENCRYPTED_VALUE_LABEL = 'Encrypted value';
export const SIGNER_CAPTION = 'The address signing this';
export const MESSAGE_SECTION = 'Message';
const TOKEN_CONTRACT_LABEL = 'Token contract';

type Row = {
  label: string;
  value: string;
  token?: TokenMetadata;
  caption?: string;
  warnings: string[];
};

export type DisplayRow =
  | ({ kind: 'text' } & Row)
  // `ens` is false where the descriptor's sources leave ENS out.
  | ({ kind: 'address'; ens: boolean } & Row);

export type DisplayNode =
  | DisplayRow
  | { kind: 'warning'; text: string }
  | { kind: 'section'; title: string }
  | { kind: 'item'; title?: string; nodes: DisplayNode[] }
  // Rows that read as one entry, such as a Universal Router command and its arguments.
  | { kind: 'group'; rows: DisplayRow[] }
  // Its entry may wait for a saved slice, so the review describes it on its own.
  | { kind: 'call'; request: CallRequest }
  | { kind: 'token'; token: TokenMetadata }
  | { kind: 'entry'; display: DescriptorDisplay };

export type DescriptorDisplay = {
  /** The sentence when it fills, else the intent. */
  heading: string | undefined;
  interpolated: boolean;
  /** Only the outermost entry says where the descriptors came from. */
  source: boolean;
  review: string;
  nodes: DisplayNode[];
};

export type CallPlace = Pick<CallRequest, 'chainId' | 'contract' | 'depth'>;

type Scope = {
  format: Eip7730DisplayFormat;
  ctx: Eip7730FieldContext;
  each: (path: string) => string[];
  miscasedAt: (path: string) => boolean;
  depth: number;
  shownContract: string | undefined;
};

type Entry = { field: Eip7730Field; selector: ArraySelector };
type Item = { field: Eip7730Field } | { entries: Entry[] };

const textRow = (label: string, value: string): DisplayNode => ({
  kind: 'text',
  label,
  value,
  warnings: [],
});

const addressRow = (label: string, value: string): DisplayNode => ({
  kind: 'address',
  label,
  value,
  ens: true,
  warnings: [],
});

function arrayKey(entry: Entry, position: number): string {
  const iteration = entry.field.group?.iteration;
  if (iteration === 'bundled') return `group-${entry.field.group?.id}`;
  if (iteration === 'sequential') return `field-${position}`;
  return entry.selector.prefix;
}

function itemsOf(fields: Eip7730Field[]): Item[] {
  const items: Item[] = [];
  const arrays = new Map<string, Entry[]>();
  fields.forEach((field, position) => {
    const selector =
      field.value === undefined ? firstArraySelector(field.path) : null;
    if (!selector) {
      items.push({ field });
      return;
    }
    const entry = { field, selector };
    const key = arrayKey(entry, position);
    const known = arrays.get(key);
    if (known) {
      known.push(entry);
      return;
    }
    const entries = [entry];
    arrays.set(key, entries);
    items.push({ entries });
  });
  // An array of inner calls alone already lists its calls.
  return items.flatMap(item =>
    'entries' in item &&
    item.entries.every(e => e.field.format === 'calldata') &&
    !item.entries.some(e => e.field.separator)
      ? item.entries.map(({ field }) => ({ field }))
      : [item],
  );
}

function separatorTitle(entries: Entry[], index: number): string | null {
  const template = entries.find(e => e.field.separator)?.field.separator;
  const parts = template ? interpolationParts(template) : null;
  if (!parts) return null;
  let title = '';
  for (const part of parts) {
    if ('text' in part) title += part.text;
    else if (part.path === 'index') title += String(index);
    else return null;
  }
  return title;
}

const SELECTOR_RE = /^0x[0-9a-f]{8}$/i;

// The spec lets the selector come apart from the arguments.
function withSelector(data: string, selector: string | undefined): string {
  return selector &&
    SELECTOR_RE.test(selector) &&
    !data.toLowerCase().startsWith(selector.toLowerCase())
    ? `${selector}${data.slice(2)}`
    : data;
}

function pick(
  params: Record<string, unknown> | undefined,
  pathKey: string,
  valueKey: string,
  each: (path: string) => string[],
): string[] {
  const path = params?.[pathKey];
  if (typeof path === 'string') return each(path);
  const value = params?.[valueKey];
  return typeof value === 'string' || typeof value === 'number'
    ? [String(value)]
    : [];
}

function innerCalls(field: Eip7730Field, s: Scope): DisplayNode[] {
  const calls = field.value !== undefined ? [field.value] : s.each(field.path);
  if (calls.length === 0) return [textRow(field.label, '—')];
  const { params } = field;
  const callees = pick(params, 'calleePath', 'callee', s.each);
  const amounts = pick(params, 'amountPath', 'amount', s.each);
  const spenders = pick(params, 'spenderPath', 'spender', s.each);
  const chainIds = pick(params, 'chainIdPath', 'chainId', s.each);
  const selectors = pick(params, 'selectorPath', 'selector', s.each);
  // The spec lets one callee or value stand for every call.
  const at = (list: string[], i: number) =>
    list.length === 1 ? list[0] : list[i];
  return [
    { kind: 'section', title: field.label },
    ...calls.map((data, i): DisplayNode => {
      const chainId = Number(at(chainIds, i) ?? s.ctx.chainId);
      const request = {
        chainId: Number.isSafeInteger(chainId) ? chainId : undefined,
        contract: at(callees, i),
        data: withSelector(data, at(selectors, i)),
        from: at(spenders, i),
        value: at(amounts, i),
        depth: s.depth + 1,
      };
      return {
        kind: 'item',
        title:
          calls.length > 1 ? `Call ${i + 1} of ${calls.length}` : undefined,
        nodes: [{ kind: 'call', request }],
      };
    }),
  ];
}

function addressNameRow(
  label: string,
  shown: Extract<FieldValue, { kind: 'address' }>,
  warnings: string[],
): DisplayNode {
  const token = shown.token ? { token: shown.token } : {};
  if (shown.name && !shown.sender) {
    return { kind: 'text', label, value: shown.name, ...token, warnings };
  }
  if (!shown.address) {
    return { kind: 'text', label, value: SENDER_TEXT, warnings };
  }
  return {
    kind: 'address',
    label,
    value: shown.address,
    ens: shown.ens,
    ...token,
    ...(shown.sender && { caption: SIGNER_CAPTION }),
    warnings,
  };
}

function fieldRows(field: Eip7730Field, s: Scope): DisplayNode[] {
  if (field.format === 'calldata') return innerCalls(field, s);
  const raw = field.value ?? s.ctx.resolvePath(field.path);
  // A constant comes from the descriptor, not the request.
  const miscased =
    field.value === undefined && s.miscasedAt(field.path)
      ? [MISCASED_ADDRESS_WARNING]
      : [];
  const shown = describeFieldValue(field, raw, s.format, s.ctx);
  if (shown.kind === 'address') {
    return [
      addressNameRow(field.label, shown, [...shown.warnings, ...miscased]),
    ];
  }
  const rows: DisplayNode[] = [
    {
      kind: 'text',
      label: field.label,
      value: shown.text,
      warnings: [...(shown.warnings ?? []), ...miscased],
    },
  ];
  if (shown.encryptedValue !== undefined) {
    rows.push(textRow(ENCRYPTED_VALUE_LABEL, shown.encryptedValue));
  }
  const unknown = shown.unknownTokenAddress;
  if (unknown && unknown !== s.shownContract?.toLowerCase()) {
    rows.push(addressRow(TOKEN_CONTRACT_LABEL, checksumEthAddress(unknown)));
  }
  return rows;
}

function shownRows(fields: Eip7730Field[], s: Scope): DisplayNode[] {
  return fields
    .filter(field => isFieldShown(field, s.ctx))
    .flatMap(field => fieldRows(field, s));
}

function arrayNodes(entries: Entry[], s: Scope): DisplayNode[] {
  const fields = entries.map(e => e.field);
  const indices = arrayIndices(entries[0].selector, s.ctx);
  // A slice of bytes is one value; an empty array shows its rows empty.
  if (!indices || indices.length === 0) return shownRows(fields, s);
  const bound = (n: number) =>
    entries.map(({ field, selector }) => bindField(field, selector, n, s.ctx));
  if (indices.length === 1 && !entries.some(e => e.field.separator)) {
    return fieldNodes(bound(0), s, false);
  }
  return indices.map(
    (index, n): DisplayNode => ({
      kind: 'item',
      title:
        separatorTitle(entries, index) ?? `Item ${n + 1} of ${indices.length}`,
      nodes: fieldNodes(bound(n), s, false),
    }),
  );
}

// Inside an element block a group's label would repeat, so only the outer list shows it.
function fieldNodes(
  fields: Eip7730Field[],
  s: Scope,
  groupLabels: boolean,
): DisplayNode[] {
  const nodes: DisplayNode[] = [];
  let labelled: number | undefined;
  for (const item of itemsOf(fields)) {
    const first = 'field' in item ? item.field : item.entries[0].field;
    const group = groupLabels ? first.group : undefined;
    if (group?.label !== undefined) {
      if (group.id !== labelled) {
        nodes.push({ kind: 'section', title: group.label });
      }
      labelled = group.id;
    }
    nodes.push(
      ...('field' in item
        ? shownRows([item.field], s)
        : arrayNodes(item.entries, s)),
    );
  }
  return nodes;
}

export function displayDescriptor(
  descriptor: MatchedDescriptor,
  place: CallPlace & { shownContract?: string },
): DescriptorDisplay {
  const { format, resolvePath, resolveEach, miscasedAt } = descriptor;
  const ctx = {
    chainId: place.chainId,
    contractAddress: place.contract,
    resolvePath,
    resolveEach,
  };
  const sentence = interpolateIntent(format, ctx);
  return {
    heading: sentence ?? format.intent,
    interpolated: sentence !== null,
    source: place.depth === 0,
    review: descriptorReview(format.reviewedBy),
    nodes: fieldNodes(
      format.fields,
      {
        format,
        ctx,
        each: resolveEach,
        miscasedAt,
        depth: place.depth,
        shownContract: place.shownContract,
      },
      true,
    ),
  };
}

/** The Domain section above names the verifying contract, so no row repeats it. */
export function displayMessage(
  descriptor: MatchedDescriptor,
  domain: {
    chainId: number | undefined;
    verifyingContract: string | undefined;
  },
): DescriptorDisplay {
  const display = displayDescriptor(descriptor, {
    chainId: domain.chainId,
    contract: domain.verifyingContract,
    depth: 0,
    shownContract: domain.verifyingContract,
  });
  return shownFields(descriptor.format, descriptor).length > 0
    ? {
        ...display,
        nodes: [{ kind: 'section', title: MESSAGE_SECTION }, ...display.nodes],
      }
    : display;
}

export function displayCallSection(
  description: CallDescription,
  place: CallPlace,
): DisplayNode[] {
  const { descriptor, decoded, view, contractRow } = description;
  if (descriptor) {
    const tokenCall = contractRow === 'token-contract';
    return [
      ...(tokenCall
        ? tokenContractRows(
            lookupToken(place.chainId, place.contract),
            place.contract,
          )
        : []),
      {
        kind: 'entry',
        display: displayDescriptor(descriptor, {
          ...place,
          shownContract: tokenCall ? place.contract : undefined,
        }),
      },
    ];
  }
  return view === 'decoded' && decoded
    ? displayDecodedCall(decoded, place.contract, place.chainId)
    : [];
}

export function displayInnerCall(
  request: CallRequest,
  description: CallDescription,
): DisplayNode[] {
  const nodes: DisplayNode[] = [];
  if (description.rejected) {
    nodes.push({ kind: 'warning', text: DESCRIPTOR_CHECK_FAILED_WARNING });
  }
  if (description.contractRow === 'contract') {
    nodes.push(
      addressRow(
        'Contract',
        request.contract ? checksumEthAddress(request.contract) : '—',
      ),
    );
  }
  if (description.view !== 'raw') {
    return [...nodes, ...displayCallSection(description, request)];
  }
  // A call with no data only moves value, so it has no function to name.
  if (description.selector) {
    nodes.push(textRow('Contract call', description.selector));
  }
  nodes.push(textRow('Data', request.data.length > 2 ? request.data : '—'));
  return nodes;
}
