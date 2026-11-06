const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  githubLogin,
  lookupLogin,
  main,
  mergeContributors,
} = require('../scripts/generate-contributors');

const author = (name, email, sha = 'abc') => ({ name, email, sha });

describe('githubLogin', () => {
  it('reads both noreply forms', () => {
    expect(githubLogin('mmlado@users.noreply.github.com')).toBe('mmlado');
    expect(githubLogin('10460806+mmlado@users.noreply.github.com')).toBe(
      'mmlado',
    );
  });

  it('names no login for a personal email', () => {
    expect(githubLogin('earthdiver1@gmail.com')).toBeNull();
  });
});

describe('lookupLogin', () => {
  const response = (status, body) => ({
    ok: status === 200,
    status,
    json: async () => body,
  });

  it('returns the account GitHub links to the commit', async () => {
    const fetchImpl = jest.fn(async () =>
      response(200, { author: { login: 'earthdiver' } }),
    );
    await expect(lookupLogin('8ceba13', { fetchImpl })).resolves.toBe(
      'earthdiver',
    );
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://api.github.com/repos/mmlado/keycard-pal/commits/8ceba13',
    );
  });

  it('sends a token only when one is given', async () => {
    const fetchImpl = jest.fn(async () => response(200, { author: null }));
    await lookupLogin('a', { fetchImpl, token: '' });
    await lookupLogin('a', { fetchImpl, token: 't' });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer t');
  });

  it('returns null for a commit no account owns', async () => {
    const fetchImpl = async () => response(200, { author: null });
    await expect(lookupLogin('a', { fetchImpl })).resolves.toBeNull();
  });

  it('throws on an HTTP error', async () => {
    const fetchImpl = async () => response(422, {});
    await expect(lookupLogin('a', { fetchImpl })).rejects.toThrow('HTTP 422');
  });
});

describe('mergeContributors', () => {
  it('links a name-only entry and keeps its name', async () => {
    const contributors = [{ name: 'earthdiver1' }];
    const result = await mergeContributors(
      contributors,
      [author('earthdiver1', 'earthdiver1@gmail.com')],
      async () => 'earthdiver',
    );
    expect(contributors).toEqual([
      { name: 'earthdiver1', github: 'earthdiver' },
    ]);
    expect(result).toEqual({ added: 0, linked: 1, merged: 0 });
  });

  it('adds a new author with the login GitHub names', async () => {
    const contributors = [];
    await mergeContributors(
      contributors,
      [author('YanzheL', 'lee.yanzhe@yanzhe.org')],
      async () => 'YanzheL',
    );
    expect(contributors).toEqual([{ name: 'YanzheL', github: 'YanzheL' }]);
  });

  it('adds a name-only entry when GitHub names no login', async () => {
    const contributors = [];
    await mergeContributors(
      contributors,
      [author('Someone', 'someone@example.com')],
      async () => null,
    );
    expect(contributors).toEqual([{ name: 'Someone' }]);
  });

  it('asks GitHub nothing for a noreply email or a linked name', async () => {
    const contributors = [{ name: 'Mladen Milankovic', github: 'mmlado' }];
    const resolveLogin = jest.fn();
    await mergeContributors(
      contributors,
      [
        author('mmlado', '10460806+mmlado@users.noreply.github.com'),
        author('Mladen Milankovic', 'developer@mmlado.com'),
        author('Alisher', 'xAlisher@users.noreply.github.com'),
      ],
      resolveLogin,
    );
    expect(resolveLogin).not.toHaveBeenCalled();
    expect(contributors).toEqual([
      { name: 'Mladen Milankovic', github: 'mmlado' },
      { name: 'Alisher', github: 'xAlisher' },
    ]);
  });

  it('adds no second entry for a login already listed under another name', async () => {
    const contributors = [{ name: 'Mladen Milankovic', github: 'mmlado' }];
    await mergeContributors(
      contributors,
      [author('mmlado', 'other@example.com')],
      async () => 'MMLADO',
    );
    expect(contributors).toEqual([
      { name: 'Mladen Milankovic', github: 'mmlado' },
    ]);
  });

  it('drops a name-only row whose login is already listed', async () => {
    const contributors = [
      { name: 'Jane', github: 'jane' },
      { name: 'Jane Doe' },
      { name: 'Other' },
    ];
    const result = await mergeContributors(
      contributors,
      [
        author('Jane Doe', 'jane@example.com'),
        author('Jane Doe', 'jane@work.example'),
      ],
      async () => 'jane',
    );
    expect(contributors).toEqual([
      { name: 'Jane', github: 'jane' },
      { name: 'Other' },
    ]);
    expect(result).toEqual({ added: 0, linked: 0, merged: 1 });
  });
});

describe('main', () => {
  let repo;
  let warn;

  const git = (args, env = {}) =>
    execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {
      cwd: repo,
      env: { ...process.env, ...env },
    })
      .toString()
      .trim();

  const commit = (name, email) => {
    git(['commit', '-q', '--allow-empty', '--no-verify', '-m', name], {
      GIT_AUTHOR_NAME: name,
      GIT_AUTHOR_EMAIL: email,
      GIT_COMMITTER_NAME: name,
      GIT_COMMITTER_EMAIL: email,
    });
    return git(['rev-parse', 'HEAD']);
  };

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'contributors-'));
    git(['init', '-q']);
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('writes every author, links what GitHub names and retries the rest', async () => {
    commit('Alice', 'alice@users.noreply.github.com');
    commit('Bob', 'bob@example.com');
    const carol = commit('Carol', 'carol@example.com');
    const bob = commit('Bob', 'bob@example.com');
    const dave = commit('Dave', 'dave@example.com');
    commit('helper[bot]', 'helper[bot]@users.noreply.github.com');

    const logins = { [bob]: 'bobgh', [carol]: null };
    const lookup = jest.fn(async sha => {
      if (sha === dave) throw new Error('HTTP 403');
      return logins[sha];
    });
    const out = path.join(repo, 'contributors.json');

    await main({ out, lookup });

    expect(JSON.parse(fs.readFileSync(out, 'utf8'))).toEqual([
      { name: 'Dave' },
      { name: 'Bob', github: 'bobgh' },
      { name: 'Carol' },
      { name: 'Alice', github: 'alice' },
    ]);
    expect(lookup.mock.calls.map(([sha]) => sha)).toEqual([dave, bob, carol]);
    expect(warn).toHaveBeenCalledWith(
      'GitHub lookup for Dave failed: HTTP 403',
    );
    expect(warn).toHaveBeenCalledWith("No GitHub account owns Carol's commits");

    lookup.mockClear();
    await main({ out, lookup });
    expect(lookup.mock.calls.map(([sha]) => sha)).toEqual([dave, carol]);
  });
});
