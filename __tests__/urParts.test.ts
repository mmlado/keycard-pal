import { UR, UREncoder } from '@ngraveio/bc-ur';

import { isMultiPartUr, UR_FRAGMENT_CAPACITY } from '../src/utils/urParts';

const urOf = (bytes: number) =>
  UREncoder.encodeSinglePart(new UR(Buffer.alloc(bytes, 1), 'bytes'));

describe('isMultiPartUr', () => {
  it('is false for a payload that fits one part', () => {
    expect(isMultiPartUr(urOf(UR_FRAGMENT_CAPACITY - 10))).toBe(false);
  });

  it('is true for a payload over one part', () => {
    expect(isMultiPartUr(urOf(UR_FRAGMENT_CAPACITY * 2))).toBe(true);
  });

  it('is false for text that is not a UR', () => {
    expect(isMultiPartUr('not a ur')).toBe(false);
  });
});
