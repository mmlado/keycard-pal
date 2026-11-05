import path from 'path';

import * as purchaseLink from '../src/constants/purchaseLink';
import {
  filesShipping,
  shippedStrings,
  withoutPlatform,
} from './platformGraph.testUtils';

const { RETIRED_MARKERS } = require('../scripts/check-affiliate-markers');

describe('the retired affiliate link', () => {
  describe.each(['android', 'ios'] as const)('the %s build', platform => {
    it.each(RETIRED_MARKERS as string[])(
      'ships no string containing %s',
      marker => {
        expect(filesShipping(platform, marker)).toEqual([]);
      },
    );
  });

  it('points at the product site', () => {
    expect(purchaseLink.KEYCARD_PURCHASE_URL).toBe('https://keycard.tech');
  });

  it.each(['BUY_KEYCARD_LABEL', 'NO_CARD_EXIT_LABEL'])(
    '%s names no verb and quotes no figure',
    name => {
      const label = (purchaseLink as Record<string, unknown>)[name];

      expect(typeof label).toBe('string');
      expect(label).not.toMatch(/\b(buy|get|shop|order)\b/i);
      expect(label).not.toMatch(/[\d%$€£]/);
    },
  );

  describe('the graph helpers', () => {
    it('read shipped strings and ignore comments', () => {
      expect(shippedStrings('// get.keycard.tech/vuxxnf', 'c.tsx')).toEqual([]);
      expect(shippedStrings('/* Advertisement: x */', 'c.tsx')).toEqual([]);
      expect(shippedStrings("const s = 'vuxxnf';", 's.tsx')).toEqual([
        'vuxxnf',
      ]);
      expect(shippedStrings('const s = `a vuxxnf b`;', 't.tsx')).toEqual([
        'a vuxxnf b',
      ]);
      expect(
        shippedStrings('import { ADVERTISEMENT } from "x";', 'i.tsx'),
      ).toEqual(['x']);
    });

    it('shadow a plain file with its platform twin', () => {
      expect(withoutPlatform(path.join('a', 'Foo.ios.tsx'))).toBe(
        path.join('a', 'Foo.tsx'),
      );
      expect(withoutPlatform(path.join('a', 'Foo.tsx'))).toBe(
        path.join('a', 'Foo.tsx'),
      );
    });
  });
});
