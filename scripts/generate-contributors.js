#!/usr/bin/env node
// Merges every author in the git history into src/data/contributors.json.
// Run by scripts/bump-version.js. Bots are skipped. An entry already listed
// keeps its name, so a hand-corrected one survives.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '../src/data/contributors.json');
const REPO = 'mmlado/keycard-pal';
const LOOKUP_TIMEOUT_MS = 10_000;

// GitHub's noreply addresses are login@ or id+login@users.noreply.github.com.
function githubLogin(email) {
  const match = /^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/.exec(email);
  return match ? match[1] : null;
}

function readAuthors(cwd) {
  const seen = new Set();
  return execFileSync('git', ['log', '--all', '--format=%an%x00%ae%x00%H'], {
    cwd,
  })
    .toString()
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [name, email, sha] = line.split('\0');
      return { name, email, sha };
    })
    .filter(a => !a.name.includes('[bot]') && !a.email.includes('[bot]'))
    .filter(a => {
      const id = `${a.name}\0${a.email}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

// A personal email names no login, but GitHub knows which account owns it.
async function lookupLogin(
  sha,
  { fetchImpl = fetch, token = process.env.GITHUB_TOKEN } = {},
) {
  const res = await fetchImpl(
    `https://api.github.com/repos/${REPO}/commits/${sha}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'keycard-pal-generate-contributors',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const commit = await res.json();
  return commit.author?.login ?? null;
}

async function mergeContributors(contributors, authors, resolveLogin) {
  const key = s => s.toLowerCase();
  const byGithub = new Map(
    contributors.filter(c => c.github).map(c => [key(c.github), c]),
  );
  const byName = new Map(contributors.map(c => [key(c.name), c]));

  let added = 0;
  let linked = 0;
  for (const author of authors) {
    const noreply = githubLogin(author.email);
    if (noreply && byGithub.has(key(noreply))) continue;
    const named = byName.get(key(author.name));
    if (!noreply && named?.github) continue;

    const login = noreply ?? (await resolveLogin(author));
    if (login && byGithub.has(key(login))) continue;

    if (named && !named.github) {
      if (login) {
        named.github = login;
        byGithub.set(key(login), named);
        linked++;
      }
      continue;
    }

    const entry = login
      ? { name: author.name, github: login }
      : { name: author.name };
    contributors.push(entry);
    if (login) byGithub.set(key(login), entry);
    byName.set(key(author.name), entry);
    added++;
  }
  return { added, linked };
}

async function main() {
  const authors = readAuthors(path.dirname(OUT));
  const contributors = fs.existsSync(OUT)
    ? JSON.parse(fs.readFileSync(OUT, 'utf8'))
    : [];

  const { added, linked } = await mergeContributors(
    contributors,
    authors,
    async author => {
      try {
        const login = await lookupLogin(author.sha);
        if (!login) {
          console.warn(`No GitHub account owns ${author.name}'s commits`);
        }
        return login;
      } catch (err) {
        console.warn(`GitHub lookup for ${author.name} failed: ${err.message}`);
        return null;
      }
    },
  );

  fs.writeFileSync(OUT, JSON.stringify(contributors, null, 2) + '\n');
  console.log(
    `contributors.json: ${contributors.length} total, ${added} new, ${linked} linked`,
  );
}

module.exports = { githubLogin, lookupLogin, mergeContributors };

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
