const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.resolve(__dirname, '../scripts/check-offline-bundle.js');

function writeFixture(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-bundle-'));
  const filePath = path.join(dir, 'index.android.bundle');
  fs.writeFileSync(filePath, content);
  return filePath;
}

function run(...args) {
  return spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
}

describe('check-offline-bundle', () => {
  it('passes on a fixture without forbidden markers', () => {
    const filePath = writeFixture('var x=1;console.log("hello");');
    try {
      const result = run('--bundle', filePath);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('passed');
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    }
  });

  it('fails on a fixture containing the default RPC URL', () => {
    const filePath = writeFixture('var url="ethereum-rpc.publicnode.com";');
    try {
      const result = run('--bundle', filePath);
      expect(result.status).not.toBe(0);
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    }
  });

  it('fails on a fixture containing EnsSettingsSection', () => {
    const filePath = writeFixture('navigate("EnsSettingsSection");');
    try {
      const result = run('--bundle', filePath);
      expect(result.status).not.toBe(0);
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    }
  });

  it('fails on a fixture containing loadEnsRpcUrl', () => {
    const filePath = writeFixture('loadEnsRpcUrl().then(console.log);');
    try {
      const result = run('--bundle', filePath);
      expect(result.status).not.toBe(0);
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    }
  });

  it('fails on a fixture containing ENS privacy disclosure', () => {
    const filePath = writeFixture('"ENS lookups send reviewed Ethereum addresses"');
    try {
      const result = run('--bundle', filePath);
      expect(result.status).not.toBe(0);
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    }
  });

  it('fails on a fixture containing ENS RPC URL label', () => {
    const filePath = writeFixture('"ENS RPC URL"');
    try {
      const result = run('--bundle', filePath);
      expect(result.status).not.toBe(0);
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    }
  });

  it('fails when --bundle argument is missing', () => {
    const result = run();
    expect(result.status).not.toBe(0);
  });

  it('fails when bundle file does not exist', () => {
    const result = run('--bundle', '/tmp/nonexistent-bundle-12345');
    expect(result.status).not.toBe(0);
  });
});
