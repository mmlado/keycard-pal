#!/usr/bin/env node
/**
 * Downloads the Ledger clear-signing EIP-7730 registry and writes a merged
 * descriptor index to src/data/eip7730.json.
 *
 * Source: https://github.com/LedgerHQ/clear-signing-erc7730-registry
 *
 * To update: npm run generate:eip7730, then commit the JSON diff.
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const { unzipSync, strFromU8 } = require('fflate');
const { toFunctionSelector } = require('viem');

const ZIP_URL =
  process.env.EIP7730_REGISTRY_URL ||
  'https://github.com/LedgerHQ/clear-signing-erc7730-registry/archive/refs/heads/master.zip';
const OUT = path.join(__dirname, '..', 'src', 'data', 'eip7730.json');
const EIP7730_INDEX_VERSION = 1;

function get(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 10) return reject(new Error('Too many redirects'));
    https
      .get(url, res => {
        if (
          (res.statusCode === 301 ||
            res.statusCode === 302 ||
            res.statusCode === 307 ||
            res.statusCode === 308) &&
          res.headers.location
        ) {
          return get(res.headers.location, redirects + 1)
            .then(resolve)
            .catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

const SELECTOR_RE = /^0x[0-9a-f]{8}$/i;
function normaliseSelector(key) {
  if (SELECTOR_RE.test(key)) return key.toLowerCase();
  try {
    return toFunctionSelector(key).toLowerCase();
  } catch {
    return null;
  }
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractFields(rawFields) {
  if (!Array.isArray(rawFields)) return [];
  const out = [];
  for (const item of rawFields) {
    if (!isPlainObject(item)) continue;
    if (typeof item.path !== 'string') continue;
    if (typeof item.format !== 'string') continue;
    const label = typeof item.label === 'string' ? item.label : item.path;
    const params = isPlainObject(item.params) ? item.params : undefined;
    out.push({ path: item.path, label, format: item.format, params });
  }
  return out;
}

function extractMetadata(rawMeta) {
  if (!isPlainObject(rawMeta)) return undefined;
  const result = {};
  if (isPlainObject(rawMeta.enums)) {
    const enums = {};
    for (const [k, v] of Object.entries(rawMeta.enums)) {
      if (!isPlainObject(v)) continue;
      const mapped = {};
      for (const [k2, v2] of Object.entries(v)) {
        if (typeof v2 === 'string') mapped[String(k2)] = v2;
      }
      enums[k] = mapped;
    }
    if (Object.keys(enums).length > 0) result.enums = enums;
  }
  if (isPlainObject(rawMeta.token)) {
    const t = rawMeta.token;
    const decimals = typeof t.decimals === 'number' ? t.decimals : undefined;
    const ticker = typeof t.ticker === 'string' ? t.ticker : undefined;
    if (decimals !== undefined || ticker !== undefined) {
      result.tokens = {};
      const addr = typeof t.address === 'string' ? t.address.toLowerCase() : '*';
      result.tokens[addr] = {};
      if (decimals !== undefined) result.tokens[addr].decimals = decimals;
      if (ticker !== undefined) result.tokens[addr].ticker = ticker;
    }
  }
  if (isPlainObject(rawMeta.info) && typeof rawMeta.info.legalName === 'string') {
    result.owner = rawMeta.info.legalName;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function extractDisplayFormat(rawFormat, metadata) {
  if (!isPlainObject(rawFormat)) return null;
  const fields = extractFields(rawFormat.fields);
  if (fields.length === 0 && typeof rawFormat.intent !== 'string') return null;
  const out = { fields };
  if (typeof rawFormat.intent === 'string') out.intent = rawFormat.intent;
  if (metadata) out.metadata = metadata;
  return out;
}

function extractDeployments(rawDeployments) {
  if (!Array.isArray(rawDeployments)) return [];
  const out = [];
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

function insertEntry(bucket, deployment, key, value) {
  const indexKey = `${deployment.chainId}:${deployment.address}`;
  if (!bucket[indexKey]) bucket[indexKey] = {};
  bucket[indexKey][key] = value;
}

function processDescriptor(raw, contracts, eip712) {
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

async function main() {
  console.log(`Fetching ${ZIP_URL}...`);
  const buf = await get(ZIP_URL);
  console.log(`Downloaded ${buf.length} bytes. Unzipping...`);

  const entries = unzipSync(new Uint8Array(buf));
  const contracts = {};
  const eip712 = {};
  let processed = 0;
  let skipped = 0;

  for (const [name, bytes] of Object.entries(entries)) {
    if (!name.toLowerCase().endsWith('.json')) continue;
    let parsed;
    try {
      parsed = JSON.parse(strFromU8(bytes));
    } catch {
      skipped += 1;
      continue;
    }
    processDescriptor(parsed, contracts, eip712);
    processed += 1;
  }

  const index = {
    version: EIP7730_INDEX_VERSION,
    generatedAt: new Date().toISOString(),
    contracts,
    eip712,
  };

  const contractCount = Object.values(contracts).reduce(
    (sum, m) => sum + Object.keys(m).length,
    0,
  );
  const eip712Count = Object.values(eip712).reduce(
    (sum, m) => sum + Object.keys(m).length,
    0,
  );

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(index, null, 2) + '\n');

  console.log(
    `Processed ${processed} files, skipped ${skipped} unparseable. ` +
      `Index has ${contractCount} calldata entries across ${Object.keys(contracts).length} contracts ` +
      `and ${eip712Count} EIP-712 entries across ${Object.keys(eip712).length} verifying contracts.`,
  );
  console.log(`Wrote ${OUT}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
