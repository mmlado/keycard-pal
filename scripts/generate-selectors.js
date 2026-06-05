#!/usr/bin/env node
/**
 * Compiles the committed Keycard Pal ABI snapshot into selector metadata for
 * offline contract call decoding.
 *
 * Source: scripts/abi.json, generated from scripts/abi-list.csv via the
 * Etherscan API v2 getabi endpoint.
 *
 * To update: run npm run generate:abi, then run this script and commit the JSON
 * diffs.
 */

const fs = require('fs');
const path = require('path');
const { toFunctionSelector, toFunctionSignature } = require('viem');

const SOURCE = path.join(__dirname, 'abi.json');
const OUT = path.join(__dirname, '..', 'src', 'data', 'selectors.json');

// Etherscan occasionally returns wrong parameter names for well-known functions.
// These corrections are applied after normalisation so they survive abi.json regeneration.
const ARG_NAME_CORRECTIONS = {
  // ERC-721/1155: Etherscan returns "to" for the operator param
  'setApprovalForAll(address,bool)': { 0: 'operator' },
};

function normalizeArg(arg, index) {
  const normalized = {
    name: arg.name || `arg${index}`,
    type: arg.type,
  };
  if (arg.components) {
    normalized.components = arg.components.map(normalizeArg);
  }
  return normalized;
}

function applyArgNameCorrections(signature, args) {
  const corrections = ARG_NAME_CORRECTIONS[signature];
  if (!corrections) return args;
  return args.map((arg, index) =>
    corrections[index] ? { ...arg, name: corrections[index] } : arg,
  );
}

function main() {
  const source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const selectors = {};

  for (const abi of source.abis) {
    for (const fn of abi) {
      if (fn.type !== 'function') continue;
      const entry = {
        type: 'function',
        name: fn.name,
        inputs: fn.inputs ?? [],
        outputs: fn.outputs ?? [],
        stateMutability: fn.stateMutability ?? 'nonpayable',
      };
      const signature = toFunctionSignature(entry);
      const selector = toFunctionSelector(entry);
      const item = {
        name: fn.name,
        signature,
        args: applyArgNameCorrections(signature, entry.inputs.map(normalizeArg)),
      };
      if (fn.name === 'setApprovalForAll') {
        item.highRisk = true;
        item.risk = 'Operator can move all NFTs from this collection';
      }
      if (!selectors[selector]) selectors[selector] = [];
      selectors[selector].push(item);
    }
  }

  const sortedSelectors = {};
  for (const selector of Object.keys(selectors).sort()) {
    sortedSelectors[selector] = selectors[selector].sort((a, b) =>
      a.signature.localeCompare(b.signature),
    );
  }

  const output = {
    source: 'scripts/abi.json',
    sourceList: source.source ?? 'scripts/abi-list.csv',
    upstreamSource: source.upstreamSource ?? 'Etherscan API v2 getabi',
    abiVersion: source.version,
    timestamp: source.timestamp,
    selectors: sortedSelectors,
  };

  fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n');
  console.log(
    `Wrote ${Object.keys(sortedSelectors).length} selectors to ${path.relative(
      process.cwd(),
      OUT,
    )}`,
  );
}

main();
