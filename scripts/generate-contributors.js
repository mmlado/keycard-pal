#!/usr/bin/env node
// Merges every author in the git history into src/data/contributors.json.
// Run by scripts/bump-version.js, so the release ships the credits its own
// history earns. Bots are skipped. Safe to re-run: an entry already listed
// keeps the name it has, so a hand-corrected name survives.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '../src/data/contributors.json');

// GitHub's noreply addresses are login@ or id+login@users.noreply.github.com.
function githubLogin(email) {
  const match = /^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/.exec(email);
  return match ? match[1] : null;
}

const authors = execFileSync('git', ['log', '--all', '--format=%an%x00%ae'], {
  cwd: path.dirname(OUT),
})
  .toString()
  .split('\n')
  .filter(Boolean)
  .map(line => {
    const [name, email] = line.split('\0');
    return { name, email };
  })
  .filter(a => !a.name.includes('[bot]') && !a.email.includes('[bot]'));

const contributors = fs.existsSync(OUT)
  ? JSON.parse(fs.readFileSync(OUT, 'utf8'))
  : [];

const byGithub = new Map(
  contributors.filter(c => c.github).map(c => [c.github.toLowerCase(), c]),
);
const byName = new Map(contributors.map(c => [c.name.toLowerCase(), c]));

let added = 0;
for (const author of authors) {
  const login = githubLogin(author.email);
  if (login && byGithub.has(login.toLowerCase())) continue;
  if (!login && byName.has(author.name.toLowerCase())) continue;

  const entry = login
    ? { name: author.name, github: login }
    : { name: author.name };
  contributors.push(entry);
  if (login) byGithub.set(login.toLowerCase(), entry);
  byName.set(author.name.toLowerCase(), entry);
  added++;
}

fs.writeFileSync(OUT, JSON.stringify(contributors, null, 2) + '\n');
console.log(`contributors.json: ${contributors.length} total, ${added} new`);
