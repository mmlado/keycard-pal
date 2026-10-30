import fs from 'fs';
import path from 'path';

import theme from '../src/theme';

import { SRC, sourceFiles } from './platformGraph.testUtils';

describe('the monospace font', () => {
  it("is iOS's system monospaced design on iOS", () => {
    expect(theme.monospace).toBe('ui-monospace');
  });

  // iOS has no family called monospace, so a style naming it renders in San Francisco.
  it('is named only in the theme', () => {
    const naming = sourceFiles()
      .filter(file => file !== path.join(SRC, 'theme.ts'))
      .filter(file =>
        /['"](ui-)?monospace['"]/.test(fs.readFileSync(file, 'utf8')),
      )
      .map(file => path.relative(SRC, file));
    expect(naming).toEqual([]);
  });
});
