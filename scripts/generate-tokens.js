#!/usr/bin/env node
/**
 * Fetches the Uniswap Labs Default token list from a pinned npm package version
 * and writes a trimmed snapshot to src/data/tokens.json.
 *
 * Pin: @uniswap/default-token-list@20.0.0
 * Source: https://unpkg.com/@uniswap/default-token-list@20.0.0/build/uniswap-default.tokenlist.json
 *
 * To update: bump PINNED_VERSION, run this script, commit the diff.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const PINNED_VERSION = '20.0.0';
const URL = `https://unpkg.com/@uniswap/default-token-list@${PINNED_VERSION}/build/uniswap-default.tokenlist.json`;
const OUT = path.join(__dirname, '..', 'src', 'data', 'tokens.json');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return get(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString()));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log(`Fetching Uniswap default token list v${PINNED_VERSION}...`);
  const list = JSON.parse(await get(URL));

  const trimmed = {
    name: list.name,
    version: list.version,
    timestamp: list.timestamp,
    // Other chains' addresses (Solana's base58 mints) break when lowercased.
    tokens: list.tokens
      .filter(t => /^0x[0-9a-fA-F]{40}$/.test(t.address))
      .map(t => {
        const entry = {
          chainId: t.chainId,
          address: t.address.toLowerCase(),
          symbol: t.symbol,
          decimals: t.decimals,
        };
        if (t.logoURI) entry.logoURI = t.logoURI;
        return entry;
      }),
  };

  fs.writeFileSync(OUT, JSON.stringify(trimmed, null, 2) + '\n');
  console.log(`Wrote ${trimmed.tokens.length} tokens to ${path.relative(process.cwd(), OUT)}`);
  console.log(`Version: ${trimmed.version.major}.${trimmed.version.minor}.${trimmed.version.patch}`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
