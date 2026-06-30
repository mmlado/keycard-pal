import { unzipSync, strFromU8 } from 'fflate';
import { toFunctionSelector } from 'viem';

export type Eip7730FieldFormat =
  | 'raw'
  | 'tokenAmount'
  | 'date'
  | 'enum'
  | 'addressName'
  | 'calldata';

export type Eip7730Field = {
  path: string;
  label: string;
  format: Eip7730FieldFormat;
  params?: Record<string, unknown>;
};

export type Eip7730TokenMetadata = {
  decimals?: number;
  ticker?: string;
};

export type Eip7730DisplayFormat = {
  intent?: string;
  fields: Eip7730Field[];
  metadata?: {
    enums?: Record<string, Record<string, string>>;
    tokens?: Record<string, Eip7730TokenMetadata>;
    owner?: string;
  };
};

export type Eip7730Index = {
  version: number;
  generatedAt: string;
  contracts: Record<string, Record<string, Eip7730DisplayFormat>>;
  eip712: Record<string, Record<string, Eip7730DisplayFormat>>;
};

export const EIP7730_INDEX_VERSION = 1;

const SELECTOR_RE = /^0x[0-9a-f]{8}$/i;

function normaliseSelector(key: string): string | null {
  if (SELECTOR_RE.test(key)) return key.toLowerCase();
  try {
    return toFunctionSelector(key).toLowerCase();
  } catch {
    return null;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractFields(rawFields: unknown): Eip7730Field[] {
  if (!Array.isArray(rawFields)) return [];
  const out: Eip7730Field[] = [];
  for (const item of rawFields) {
    if (!isPlainObject(item)) continue;
    if (typeof item.path !== 'string') continue;
    if (typeof item.format !== 'string') continue;
    const label = typeof item.label === 'string' ? item.label : item.path;
    const params = isPlainObject(item.params)
      ? (item.params as Record<string, unknown>)
      : undefined;
    out.push({
      path: item.path,
      label,
      format: item.format as Eip7730FieldFormat,
      params,
    });
  }
  return out;
}

function extractMetadata(
  rawMeta: unknown,
): Eip7730DisplayFormat['metadata'] | undefined {
  if (!isPlainObject(rawMeta)) return undefined;
  const result: Eip7730DisplayFormat['metadata'] = {};
  if (isPlainObject(rawMeta.enums)) {
    const enums: Record<string, Record<string, string>> = {};
    for (const [k, v] of Object.entries(rawMeta.enums)) {
      if (!isPlainObject(v)) continue;
      const mapped: Record<string, string> = {};
      for (const [k2, v2] of Object.entries(v)) {
        if (typeof v2 === 'string') mapped[String(k2)] = v2;
      }
      enums[k] = mapped;
    }
    if (Object.keys(enums).length > 0) result.enums = enums;
  }
  if (isPlainObject(rawMeta.token)) {
    const t = rawMeta.token as Record<string, unknown>;
    const decimals = typeof t.decimals === 'number' ? t.decimals : undefined;
    const ticker = typeof t.ticker === 'string' ? t.ticker : undefined;
    if (decimals !== undefined || ticker !== undefined) {
      result.tokens = {};
      const addr =
        typeof t.address === 'string' ? t.address.toLowerCase() : '*';
      result.tokens[addr] = { decimals, ticker };
    }
  }
  if (isPlainObject(rawMeta.info)) {
    const info = rawMeta.info as Record<string, unknown>;
    if (typeof info.legalName === 'string') result.owner = info.legalName;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function extractDisplayFormat(
  rawFormat: unknown,
  metadata: Eip7730DisplayFormat['metadata'] | undefined,
): Eip7730DisplayFormat | null {
  if (!isPlainObject(rawFormat)) return null;
  const fields = extractFields(rawFormat.fields);
  if (fields.length === 0 && typeof rawFormat.intent !== 'string') return null;
  const out: Eip7730DisplayFormat = { fields };
  if (typeof rawFormat.intent === 'string') out.intent = rawFormat.intent;
  if (metadata) out.metadata = metadata;
  return out;
}

type Deployment = { chainId: number; address: string };

function extractDeployments(rawDeployments: unknown): Deployment[] {
  if (!Array.isArray(rawDeployments)) return [];
  const out: Deployment[] = [];
  for (const d of rawDeployments) {
    if (!isPlainObject(d)) continue;
    const chainId =
      typeof d.chainId === 'number' ? d.chainId : Number(d.chainId);
    const address = typeof d.address === 'string' ? d.address : null;
    if (!Number.isFinite(chainId) || !address) continue;
    out.push({ chainId, address: address.toLowerCase() });
  }
  return out;
}

function insertEntry(
  bucket: Record<string, Record<string, Eip7730DisplayFormat>>,
  deployment: Deployment,
  key: string,
  value: Eip7730DisplayFormat,
): void {
  const indexKey = `${deployment.chainId}:${deployment.address}`;
  if (!bucket[indexKey]) bucket[indexKey] = {};
  bucket[indexKey][key] = value;
}

function processDescriptor(
  raw: unknown,
  contracts: Record<string, Record<string, Eip7730DisplayFormat>>,
  eip712: Record<string, Record<string, Eip7730DisplayFormat>>,
): void {
  if (!isPlainObject(raw)) return;
  const context = isPlainObject(raw.context) ? raw.context : null;
  const display = isPlainObject(raw.display) ? raw.display : null;
  if (!context || !display) return;
  const formats = isPlainObject(display.formats) ? display.formats : null;
  if (!formats) return;

  const metadata = extractMetadata(raw.metadata);

  const contractCtx = isPlainObject(context.contract) ? context.contract : null;
  const eip712Ctx = isPlainObject(context.eip712) ? context.eip712 : null;

  if (contractCtx) {
    const deployments = extractDeployments(contractCtx.deployments);
    if (deployments.length === 0) return;
    for (const [rawKey, rawFormat] of Object.entries(formats)) {
      const selector = normaliseSelector(rawKey);
      if (!selector) continue;
      const format = extractDisplayFormat(rawFormat, metadata);
      if (!format) continue;
      for (const d of deployments) {
        insertEntry(contracts, d, selector, format);
      }
    }
    return;
  }

  if (eip712Ctx) {
    const deployments = extractDeployments(eip712Ctx.deployments);
    if (deployments.length === 0) return;
    for (const [primaryType, rawFormat] of Object.entries(formats)) {
      const format = extractDisplayFormat(rawFormat, metadata);
      if (!format) continue;
      for (const d of deployments) {
        insertEntry(eip712, d, primaryType, format);
      }
    }
  }
}

export function buildIndexFromDescriptors(
  descriptors: unknown[],
): Eip7730Index {
  const contracts: Record<string, Record<string, Eip7730DisplayFormat>> = {};
  const eip712: Record<string, Record<string, Eip7730DisplayFormat>> = {};
  for (const raw of descriptors) {
    processDescriptor(raw, contracts, eip712);
  }
  return {
    version: EIP7730_INDEX_VERSION,
    generatedAt: new Date().toISOString(),
    contracts,
    eip712,
  };
}

export function processLedgerRegistryZip(zipBytes: Uint8Array): Eip7730Index {
  const entries = unzipSync(zipBytes);
  const descriptors: unknown[] = [];
  for (const [name, bytes] of Object.entries(entries)) {
    if (!name.toLowerCase().endsWith('.json')) continue;
    let text: string;
    try {
      text = strFromU8(bytes);
    } catch {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      continue;
    }
    descriptors.push(parsed);
  }
  return buildIndexFromDescriptors(descriptors);
}
