import { readFileSync } from 'fs';
import { join } from 'path';

import { APP_VERSION } from '../src/constants/app';

// APP_VERSION is a literal so package.json stays out of the bundle (#318).
describe('APP_VERSION', () => {
  const root = join(__dirname, '..');

  it('equals the package.json version', () => {
    const { version } = JSON.parse(
      readFileSync(join(root, 'package.json'), 'utf8'),
    );
    expect(APP_VERSION).toBe(version);
  });

  it('is written in the form scripts/bump-version.js replaces', () => {
    const source = readFileSync(join(root, 'src/constants/app.ts'), 'utf8');
    expect(source).toMatch(/APP_VERSION = '\d+\.\d+\.\d+'/);
  });
});
