// Every v2 test vector of the clear-signing registry, through the app's own lookup,
// decoding and rendering. scripts/check-eip7730-vectors.js runs it and reads the report.
import { render } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { parseTransaction } from 'viem';

import Eip7730CallSection from '../../src/components/SignRequestDetail/eth/DataTabPanel/DecodedCallSection/Eip7730CallSection';
import { describeCall } from '../../src/utils/callDescription';
import { eip712DomainChainId, encodeEip712Type } from '../../src/utils/eip712';
import {
  interpolateIntent,
  type Eip7730FieldContext,
} from '../../src/utils/eip7730/format';
import { lookupEip712 } from '../../src/utils/eip7730/lookup';
import { classifyEthPayload } from '../../src/utils/ethPayload';
import { buildEip712Resolvers } from '../../src/utils/eip7730/paths';
import { fitsRequest } from '../../src/utils/eip7730/visibility';
import type { Eip7730DisplayFormat } from '../../src/utils/eip7730/zip';

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

jest.mock('../../src/theme', () => ({
  __esModule: true,
  default: {
    colors: new Proxy({}, { get: () => '#888' }),
  },
}));

jest.mock('react-native-paper', () => {
  const { Text, View } = require('react-native');
  return {
    Text: ({ children, ...props }: any) => <Text {...props}>{children}</Text>,
    Icon: () => <View />,
  };
});

// Every row the review shows comes out as `F|label|value`.
jest.mock('../../src/components/InfoRow', () => {
  const { Text } = require('react-native');
  return ({ label, value, name }: any) => (
    <>
      {name}
      <Text>{`F|${label}|${value}`}</Text>
    </>
  );
});
jest.mock('../../src/components/ens/AddressInfoRow.online', () => {
  const { Text } = require('react-native');
  return ({ label, value, name }: any) => (
    <>
      {name}
      <Text>{`F|${label}|${value}`}</Text>
    </>
  );
});
jest.mock(
  '../../src/components/SignRequestDetail/eth/DataTabPanel/DecodedCallSection/TokenSymbolRow',
  () => {
    const { Text } = require('react-native');
    return ({ token }: any) => <Text>{`T|${token.symbol}`}</Text>;
  },
);

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

function rows(tree: any): string[] {
  const out: string[] = [];
  const walk = (node: any) => {
    if (node == null) return;
    if (typeof node === 'string') {
      if (node.startsWith('F|') || node.startsWith('T|')) out.push(node);
      return;
    }
    if (Array.isArray(node)) return node.forEach(walk);
    walk(node.children);
  };
  walk(tree);
  return out;
}

function prepare(vector: Vector): {
  format: Eip7730DisplayFormat | null;
  ctx: Eip7730FieldContext | null;
  why?: string;
} {
  if (vector.rawTx) {
    let tx;
    try {
      tx = parseTransaction(vector.rawTx as `0x${string}`);
    } catch {
      return { format: null, ctx: null, why: 'rawTx did not parse' };
    }
    const to = tx.to ?? undefined;
    const chainId = tx.chainId ?? 1;
    // The review's own answer for the transaction, the lookup and fitsRequest included.
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
        format: null,
        ctx: null,
        why: described.rejected
          ? 'entry rejected (mustMatch or lengths)'
          : 'no entry for the call, or its signature did not decode',
      };
    const { format, resolvePath, resolveEach } = described.descriptor;
    return {
      format,
      ctx: { chainId, contractAddress: to, resolvePath, resolveEach, depth: 0 },
    };
  }
  const typed = vector.data;
  // A message the review refuses to sign is no pass, however it would render.
  const payload = classifyEthPayload(
    Buffer.from(JSON.stringify(typed), 'utf8').toString('hex'),
    2,
  );
  if (payload.kind === 'invalid') {
    return { format: null, ctx: null, why: `refused: ${payload.reason}` };
  }
  const chainId = eip712DomainChainId(typed.domain);
  const verifying = typed.domain?.verifyingContract;
  const encoded = encodeEip712Type(typed.primaryType, typed.types);
  if (chainId === undefined || !verifying || !encoded)
    return { format: null, ctx: null, why: 'domain lacks chain or contract' };
  const found = lookupEip712(chainId, verifying, encoded, typed.domain);
  if (found instanceof Promise) throw new Error('unexpected promise');
  if (!found)
    return { format: null, ctx: null, why: 'no entry for the message' };
  const container = { from: vector.from, to: verifying, value: '0', chainId };
  const ctx = {
    chainId,
    contractAddress: verifying,
    ...buildEip712Resolvers(typed, container),
    depth: 0,
    shownContract: verifying,
  };
  if (!fitsRequest(found, ctx))
    return {
      format: null,
      ctx: null,
      why: 'entry rejected (mustMatch or lengths)',
    };
  return { format: found, ctx };
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
      let prepared;
      try {
        prepared = prepare(vector);
      } catch (e) {
        results.push({ ...base, status: 'error', why: String(e) });
        continue;
      }
      const { format, ctx, why } = prepared;
      if (!format || !ctx) {
        const refused = why?.startsWith('refused');
        results.push({
          ...base,
          status: refused ? 'refused' : 'unmatched',
          why,
        });
        continue;
      }
      let rendered: string[] = [];
      try {
        const view = render(
          <Eip7730CallSection
            format={format}
            resolvePath={ctx.resolvePath}
            resolveEach={ctx.resolveEach}
            contractAddress={ctx.contractAddress}
            chainId={ctx.chainId}
            shownContract={(ctx as any).shownContract}
          />,
        );
        rendered = rows(view.toJSON());
        view.unmount();
      } catch (e) {
        results.push({ ...base, status: 'error', why: `render: ${String(e)}` });
        continue;
      }
      const shown = rendered
        .filter(r => r.startsWith('F|'))
        .map(r => {
          const [, label, ...rest] = r.split('|');
          return [label, rest.join('|')] as [string, string];
        });
      const expected = flatten(vector.expected.fields ?? []);
      const pool = [...shown];
      const missing: [string, string][] = [];
      for (const pair of expected) {
        const at = pool.findIndex(([l, v]) => l === pair[0] && v === pair[1]);
        if (at >= 0) pool.splice(at, 1);
        else missing.push(pair);
      }
      const sentence = interpolateIntent(format, ctx);
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
        tickers: rendered.filter(r => r.startsWith('T|')),
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
