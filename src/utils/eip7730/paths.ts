import type { DecodedCall, DecodedCallArg } from '@/utils/txParser';

function pickFromArgs(args: DecodedCallArg[], name: string): string | null {
  const match = args.find(a => a.name === name);
  return match ? match.value : null;
}

export function buildCalldataPathResolver(
  call: DecodedCall,
): (path: string) => string | null {
  return (path: string) => {
    if (!path) return null;
    const cleaned = path.replace(/^@\./, '').replace(/^#\./, '');
    const head = cleaned.split('.')[0];
    if (call.kind === 'erc20-transfer') {
      if (head === 'to' || head === '_to') return call.to;
      if (head === 'amount' || head === '_value' || head === 'value')
        return call.amount.toString();
      return null;
    }
    if (call.kind === 'erc20-transferFrom') {
      if (head === 'from' || head === '_from') return call.from;
      if (head === 'to' || head === '_to') return call.to;
      if (head === 'amount' || head === '_value' || head === 'value')
        return call.amount.toString();
      return null;
    }
    if (call.kind === 'erc20-approve') {
      if (head === 'spender' || head === '_spender') return call.spender;
      if (head === 'amount' || head === '_value' || head === 'value')
        return call.amount.toString();
      return null;
    }
    if (call.kind === 'contract-call') {
      return pickFromArgs(call.args, head);
    }
    return null;
  };
}

function indexOfClosingBracket(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length; i += 1) {
    const c = s[i];
    if (c === '[') depth += 1;
    else if (c === ']') {
      if (depth === 0) return i;
      depth -= 1;
    }
  }
  return -1;
}

export function resolveEip712FieldValue(
  path: string,
  message: unknown,
): string | null {
  if (!path) return null;
  const cleaned = path.replace(/^@\./, '').replace(/^#\./, '');
  let current: unknown = message;
  let i = 0;
  while (i < cleaned.length && current !== null && current !== undefined) {
    if (cleaned[i] === '.') {
      i += 1;
      continue;
    }
    if (cleaned[i] === '[') {
      const end = indexOfClosingBracket(cleaned, i + 1);
      if (end === -1) return null;
      const inner = cleaned.slice(i + 1, end);
      if (inner === ']' || inner === '' || inner === '*') {
        if (Array.isArray(current) && current.length > 0) current = current[0];
        else return null;
      } else {
        const idx = Number(inner);
        if (!Number.isFinite(idx)) return null;
        if (Array.isArray(current)) current = current[idx];
        else return null;
      }
      i = end + 1;
      continue;
    }
    let j = i;
    while (j < cleaned.length && cleaned[j] !== '.' && cleaned[j] !== '[')
      j += 1;
    const key = cleaned.slice(i, j);
    if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[key];
    } else {
      return null;
    }
    i = j;
  }
  if (current === null || current === undefined) return null;
  if (typeof current === 'object') return JSON.stringify(current);
  return String(current);
}
