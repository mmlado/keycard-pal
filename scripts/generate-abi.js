#!/usr/bin/env node
/**
 * Fetches verified contract ABIs from Etherscan using scripts/abi-list.csv and
 * writes a committed snapshot to scripts/abi.json.
 *
 * Source list: scripts/abi-list.csv, copied from keycard-tech/eth-abi-repo and
 * maintained by Keycard Pal.
 * API: Etherscan API v2 getabi endpoint.
 *
 * Required env: ETHERSCAN_API_KEY. You can set it in the shell or in a root
 * .env file.
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const API_URL = 'https://api.etherscan.io/v2/api';
const LIST = path.join(__dirname, 'abi-list.csv');
const OUT = path.join(__dirname, 'abi.json');
const REQUESTS_PER_SECOND = 3;
const REQUEST_DELAY_MS = Math.ceil(1000 / REQUESTS_PER_SECOND);
const ENV_FILE = path.join(__dirname, '..', '.env');

function loadDotEnv() {
  if (!fs.existsSync(ENV_FILE)) return;

  for (const rawLine of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

function readAbiList() {
  return fs
    .readFileSync(LIST, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const [name, chainId, contractAddress, description = ''] =
        parseCsvLine(line);
      if (!name || !chainId || !contractAddress) {
        throw new Error(`Invalid ABI list row: ${line}`);
      }
      return { name, chainId, contractAddress, description };
    });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, res => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return getJson(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()));
          } catch (err) {
            reject(err);
          }
        });
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

async function fetchAbi(entry, apiKey) {
  const url = new URL(API_URL);
  url.searchParams.set('chainid', entry.chainId);
  url.searchParams.set('module', 'contract');
  url.searchParams.set('action', 'getabi');
  url.searchParams.set('address', entry.contractAddress);
  url.searchParams.set('apikey', apiKey);

  const response = await getJson(url);
  if (response.status !== '1') {
    throw new Error(
      `${entry.name}: ${response.message ?? 'Etherscan error'}: ${
        response.result ?? 'no result'
      }`,
    );
  }
  return JSON.parse(response.result);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  loadDotEnv();
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    throw new Error('ETHERSCAN_API_KEY is required to fetch ABIs');
  }

  const entries = readAbiList();
  const abis = [];
  const metadata = [];

  for (const entry of entries) {
    console.log(
      `Fetching ${entry.name} (${entry.chainId}:${entry.contractAddress})...`,
    );
    const abi = await fetchAbi(entry, apiKey);
    abis.push(abi);
    metadata.push(entry);
    await delay(REQUEST_DELAY_MS);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const snapshot = {
    version: new Date(timestamp * 1000)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, ''),
    timestamp,
    source: 'scripts/abi-list.csv',
    upstreamSource: 'Etherscan API v2 getabi',
    entries: metadata,
    abis,
  };

  fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(
    `Wrote ${abis.length} ABIs to ${path.relative(process.cwd(), OUT)}`,
  );
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
