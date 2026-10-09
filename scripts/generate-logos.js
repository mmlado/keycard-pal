#!/usr/bin/env node
/**
 * Downloads ERC-20 token logos from the URLs in src/data/tokens.json, shrinks
 * each to fit MAX_SIDE px in its own format, and saves them as individual files
 * under android/app/src/offline/assets/token-logos/.
 *
 * Also writes src/data/token-logos-index.json as { "chainId:address": "ext" }
 * so tokenMetadata.ts can construct asset:/ URIs at runtime.
 *
 * - Skips IPFS and data URIs.
 * - Skips SVG (React Native Image cannot render SVG via file:// URI).
 * - Skips entries already present in the generated index (idempotent).
 * - Fetch errors are silently skipped; those tokens fall back to remote URL.
 *
 * The output is a function of the downloaded bytes alone, so a second run over
 * the same inputs writes the same files. A change to MAX_SIDE or the encoder
 * settings needs a --clean run.
 *
 * Run: node scripts/generate-logos.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const TOKENS_FILE = path.join(__dirname, '..', 'src', 'data', 'tokens.json');
const INDEX_FILE = path.join(
  __dirname,
  '..',
  'src',
  'data',
  'token-logos-index.json',
);
const ASSETS_DIR = path.join(
  __dirname,
  '..',
  'android',
  'app',
  'src',
  'offline',
  'assets',
  'token-logos',
);
const CONCURRENCY = 20;
const TIMEOUT_MS = 10_000;
// A 32 dp icon on an xxxhdpi screen; the row draws 20 dp today.
const MAX_SIDE = 128;

const MIME_TO_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const FORMAT_TO_EXT = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
  gif: 'gif',
};

// Fit within MAX_SIDE without enlarging, keep the format, strip metadata.
async function shrink(data) {
  const image = sharp(data, { animated: false });
  const { format } = await image.metadata();
  const ext = FORMAT_TO_EXT[format];
  if (!ext) throw new Error(`unsupported format: ${format}`);
  const resized = image.resize({
    width: MAX_SIDE,
    height: MAX_SIDE,
    fit: 'inside',
    withoutEnlargement: true,
  });
  const encoded =
    ext === 'png'
      ? resized.png({ palette: true, compressionLevel: 9 })
      : ext === 'jpg'
      ? resized.jpeg({ quality: 80, mozjpeg: true })
      : ext === 'webp'
      ? resized.webp({ quality: 80 })
      : resized.gif();
  return { ext, data: await encoded.toBuffer() };
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: TIMEOUT_MS }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location;
        if (!location) {
          res.resume();
          return reject(new Error('redirect without location'));
        }
        return fetchBuffer(new URL(location, url).toString())
          .then(resolve)
          .catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const contentType = res.headers['content-type'] ?? '';
      const mime = contentType.split(';')[0].trim();
      if (!MIME_TO_EXT[mime]) {
        res.resume();
        return reject(new Error(`unsupported mime: ${mime}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.on('error', reject);
  });
}

async function runWithConcurrency(tasks, limit) {
  let i = 0;
  async function next() {
    if (i >= tasks.length) return;
    const task = tasks[i++];
    await task();
    await next();
  }
  await Promise.all(Array.from({ length: limit }, next));
}

async function main() {
  const clean = process.argv.includes('--clean');
  if (clean) {
    fs.rmSync(ASSETS_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8')).tokens;
  const index =
    !clean && fs.existsSync(INDEX_FILE)
      ? JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))
      : {};

  const candidates = tokens.filter(t => {
    if (!t.logoURI) return false;
    if (t.logoURI.startsWith('ipfs://') || t.logoURI.startsWith('data:'))
      return false;
    const key = `${t.chainId}:${t.address}`;
    if (index[key]) return false;
    return true;
  });

  console.log(
    `${Object.keys(index).length} already cached, ${
      candidates.length
    } to fetch`,
  );

  let ok = 0;
  let fail = 0;

  const tasks = candidates.map(t => async () => {
    const key = `${t.chainId}:${t.address}`;
    try {
      const { ext, data } = await shrink(await fetchBuffer(t.logoURI));
      const filename = `${t.chainId}-${t.address}.${ext}`;
      fs.writeFileSync(path.join(ASSETS_DIR, filename), data);
      index[key] = ext;
      ok++;
    } catch {
      fail++;
    }
  });

  await runWithConcurrency(tasks, CONCURRENCY);

  const sortedIndex = Object.fromEntries(
    Object.entries(index).sort(([a], [b]) => a.localeCompare(b)),
  );
  fs.writeFileSync(INDEX_FILE, JSON.stringify(sortedIndex, null, 2) + '\n');
  console.log(
    `Done - fetched ${ok}, skipped/failed ${fail}, total ${
      Object.keys(index).length
    }`,
  );
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
