#!/usr/bin/env node
// Fetches contributors from the GitHub API and merges them into
// src/data/contributors.json. Skips bots. Safe to re-run.
//
// Requires GH_TOKEN and GITHUB_REPOSITORY env vars (both set automatically
// in GitHub Actions).

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '../src/data/contributors.json');
const repo = process.env.GITHUB_REPOSITORY;

if (!repo) {
  console.error('GITHUB_REPOSITORY not set — skipping GitHub contributor merge');
  process.exit(0);
}

const raw = execFileSync('gh', [
  'api',
  `repos/${repo}/contributors`,
  '--paginate',
]).toString();

const ghLogins = JSON.parse(raw)
  .filter(u => u.type === 'User')
  .map(u => u.login);

const existing = fs.existsSync(OUT)
  ? JSON.parse(fs.readFileSync(OUT, 'utf8'))
  : [];

const byGithub = new Map(
  existing.filter(e => e.github).map(e => [e.github.toLowerCase(), e]),
);

let added = 0;
for (const login of ghLogins) {
  if (!byGithub.has(login.toLowerCase())) {
    existing.push({ name: login, github: login });
    added++;
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(existing, null, 2) + '\n');
console.log(`contributors.json: ${existing.length} total, ${added} new from GitHub`);
