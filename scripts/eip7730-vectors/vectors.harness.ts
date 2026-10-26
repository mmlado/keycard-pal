// Every v2 test vector of the clear-signing registry, through the app's own lookup,
// decoding and display. scripts/check-eip7730-vectors.js runs it and reads the report.
import fs from 'fs';
import path from 'path';
import { parseTransaction } from 'viem';

import { describeCall } from '../../src/utils/callDescription';
import { parseEip712RawTypedData } from '../../src/utils/eip712';
import {
  displayCallSection,
  displayInnerCall,
  displayMessage,
  type DescriptorDisplay,
  type DisplayNode,
} from '../../src/utils/eip7730/display';
import type { Eip7730DisplayFormat } from '../../src/utils/eip7730/zip';
import { classifyEthPayload } from '../../src/utils/ethPayload';
import { describeMessage } from '../../src/utils/messageDescription';

const REGISTRY = process.env.VECTORS_DIR ?? '';
const OUT = process.env.VECTORS_REPORT ?? '';

// Built from the zip the vectors came with, so the index and the vectors are one commit.
jest.mock('../../src/data/eip7730.json', () => {
  const { processRegistryZip } = jest.requireActual(
    '../../src/utils/eip7730/zip',
  );
  const zip = require('fs').readFileSync(process.env.VECTORS_ZIP);
  return processRegistryZip(new Uint8Array(zip));
});

// Each vector brings its own token data, as the schema intends; the app's list stays out.
const mockTokens: {
  current: Record<string, { symbol: string; decimals: number }>;
} = { current: {} };
jest.mock('../../src/utils/tokenMetadata', () => ({
  ...jest.requireActual('../../src/utils/tokenMetadata'),
  lookupToken: (_chainId: number | undefined, address: string | undefined) => {
    const own = address ? mockTokens.current[address.toLowerCase()] : undefined;
    return own ? { symbol: own.symbol, decimals: own.decimals } : null;
  },
}));

type Expected = {
  intent: string;
  interpolatedIntent?: string;
  owner?: string;
  fields: { label: string; value: string | Expected }[];
};
type Vector = {
  description: string;
  rawTx?: string;
  data?: any;
  from?: string;
  expected: Expected;
};
type Shown = {
  rows: [string, string][];
  tickers: string[];
  warnings: string[];
};
type Prepared =
  | {
      format: Eip7730DisplayFormat;
      display: DescriptorDisplay;
      nodes: DisplayNode[];
    }
  | { why: string };

function testFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...testFiles(p));
    else if (p.includes(`${path.sep}testsv2${path.sep}`) && p.endsWith('.json'))
      out.push(p);
  }
  return out;
}

function flatten(fields: Expected['fields']): [string, string][] {
  return fields.flatMap(({ label, value }) =>
    typeof value === 'string'
      ? [[label, value] as [string, string]]
      : flatten(value.fields ?? []),
  );
}

// Inner calls are described the way the review describes them; the bundled index never waits.
function walk(nodes: DisplayNode[], shown: Shown): void {
  for (const node of nodes) {
    switch (node.kind) {
      case 'text':
      case 'address':
        shown.rows.push([node.label, node.value]);
        if (node.token) shown.tickers.push(node.token.symbol);
        shown.warnings.push(...node.warnings.map(w => `${node.label}: ${w}`));
        break;
      case 'warning':
        shown.warnings.push(node.text);
        break;
      case 'token':
        shown.tickers.push(node.token.symbol);
        break;
      case 'item':
        walk(node.nodes, shown);
        break;
      case 'group':
        walk(node.rows, shown);
        break;
      case 'entry':
        walk(node.display.nodes, shown);
        break;
      case 'call': {
        const description = describeCall(node.request);
        if (description instanceof Promise)
          throw new Error('unexpected promise');
        walk(displayInnerCall(node.request, description), shown);
        break;
      }
    }
  }
}

function prepare(vector: Vector): Prepared {
  if (vector.rawTx) {
    let tx;
    try {
      tx = parseTransaction(vector.rawTx as `0x${string}`);
    } catch {
      return { why: 'rawTx did not parse' };
    }
    const to = tx.to ?? undefined;
    const chainId = tx.chainId ?? 1;
    // The review's own answer for the transaction, so the harness cannot drift from it.
    const described = describeCall({
      chainId,
      contract: to,
      data: tx.data ?? '0x',
      from: vector.from,
      value: (tx.value ?? 0n).toString(),
      depth: 0,
    });
    if (described instanceof Promise) throw new Error('unexpected promise');
    if (!described.descriptor)
      return {
        why: described.rejected
          ? 'entry rejected (mustMatch or lengths)'
          : 'no entry for the call, or its signature did not decode',
      };
    const nodes = displayCallSection(described, {
      chainId,
      contract: to,
      depth: 0,
    });
    const entry = nodes.find(
      (node): node is Extract<DisplayNode, { kind: 'entry' }> =>
        node.kind === 'entry',
    );
    if (!entry) throw new Error('a matched call shows no entry');
    return {
      format: described.descriptor.format,
      display: entry.display,
      nodes,
    };
  }
  const signData = Buffer.from(JSON.stringify(vector.data), 'utf8').toString(
    'hex',
  );
  // A message the review refuses to sign is no pass, however it would render.
  const payload = classifyEthPayload(signData, 2);
  if (payload.kind === 'invalid') return { why: `refused: ${payload.reason}` };
  // The review's own answer for the message, so the harness cannot drift from it.
  const described = describeMessage(
    parseEip712RawTypedData(signData),
    vector.from,
  );
  if (described instanceof Promise) throw new Error('unexpected promise');
  const { descriptor, rejected, chainId, verifyingContract } = described;
  if (!descriptor)
    return {
      why: rejected
        ? 'entry rejected (mustMatch or lengths)'
        : chainId === undefined || !verifyingContract
        ? 'domain lacks chain or contract'
        : 'no entry for the message',
    };
  const display = displayMessage(descriptor, described);
  return {
    format: descriptor.format,
    display,
    nodes: [{ kind: 'entry', display }],
  };
}

test('registry test vectors', () => {
  const files = testFiles(REGISTRY);
  const results: any[] = [];
  for (const file of files) {
    const suite = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const vector of (suite.tests ?? []) as Vector[]) {
      mockTokens.current = Object.fromEntries(
        Object.entries(suite.dataProvider?.tokens ?? {}).map(([k, v]: any) => [
          k.toLowerCase(),
          v,
        ]),
      );
      const base = {
        id: `${path.relative(REGISTRY, file)}#${vector.description}`,
        file: path.relative(REGISTRY, file),
        description: vector.description,
        kind: vector.rawTx ? 'calldata' : 'eip712',
        providers: Object.keys(suite.dataProvider ?? {}),
      };
      const shown: Shown = {
        rows: [],
        tickers: [],
        warnings: [],
      };
      let prepared: Prepared;
      try {
        prepared = prepare(vector);
        if ('nodes' in prepared) walk(prepared.nodes, shown);
      } catch (e) {
        results.push({ ...base, status: 'error', why: String(e) });
        continue;
      }
      if (!('nodes' in prepared)) {
        const refused = prepared.why.startsWith('refused');
        results.push({
          ...base,
          status: refused ? 'refused' : 'unmatched',
          why: prepared.why,
        });
        continue;
      }
      const { format, display } = prepared;
      const expected = flatten(vector.expected.fields ?? []);
      const pool = [...shown.rows];
      const missing: [string, string][] = [];
      for (const pair of expected) {
        const at = pool.findIndex(([l, v]) => l === pair[0] && v === pair[1]);
        if (at >= 0) pool.splice(at, 1);
        else missing.push(pair);
      }
      const sentence = display.interpolated ? display.heading : null;
      const intentOk = (format.intent ?? '') === vector.expected.intent;
      const sentenceOk =
        vector.expected.interpolatedIntent === undefined ||
        sentence === vector.expected.interpolatedIntent;
      const fieldsOk = missing.length === 0;
      results.push({
        ...base,
        status: intentOk && sentenceOk && fieldsOk ? 'pass' : 'diff',
        intent: intentOk
          ? undefined
          : { expected: vector.expected.intent, got: format.intent },
        sentence: sentenceOk
          ? undefined
          : { expected: vector.expected.interpolatedIntent, got: sentence },
        owner: vector.expected.owner,
        missing,
        // What the app showed that the vector did not name: candidates for the missing pairs.
        extra: pool,
        tickers: shown.tickers,
        warnings: shown.warnings,
      });
    }
  }
  const count = (s: string) => results.filter(r => r.status === s).length;
  const summary = {
    files: files.length,
    tests: results.length,
    pass: count('pass'),
    diff: count('diff'),
    unmatched: count('unmatched'),
    refused: count('refused'),
    error: count('error'),
  };
  fs.writeFileSync(OUT, JSON.stringify({ summary, results }, null, 1));
  console.log(JSON.stringify(summary));
});
