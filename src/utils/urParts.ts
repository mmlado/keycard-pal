import { URDecoder, UREncoder } from '@ngraveio/bc-ur';

export const UR_FRAGMENT_CAPACITY = 200;

export function isMultiPartUr(urString: string): boolean {
  try {
    const decoder = new URDecoder();
    decoder.receivePart(urString);
    if (!decoder.isSuccess()) {
      return false;
    }
    return (
      new UREncoder(decoder.resultUR(), UR_FRAGMENT_CAPACITY).fragmentsLength >
      1
    );
  } catch {
    return false;
  }
}
