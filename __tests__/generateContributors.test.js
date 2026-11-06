const {
  githubLogin,
  lookupLogin,
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
    expect(result).toEqual({ added: 0, linked: 1 });
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
});
