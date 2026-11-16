import {
  cardLifeCycleName,
  isSecurityDomain,
  listsEveryDomain,
  managementPrivileges,
  registryEntries,
} from '../src/utils/gpRegistry';
import { fromHex, toHex } from '../src/utils/hex';

/** GET STATUS answers of the measured Developer card (JCOP4 P71, Keycard 4.0), 2026-11-16. */
const CARD_MANAGER =
  'e3264f08a0000001510000009f70010fc5039efe80c407a0000001515350cc08a000000151000000';
const APPLICATIONS =
  'e3274f09a000000804000101019f700107c503000000c407a0000008040001cc08a000000151000000' +
  'e3254f07d27600008501019f700107c503000000c407a0000008040001cc08a000000151000000' +
  'e3274f09a000000804000103019f700107c503000000c407a0000008040001cc08a000000151000000' +
  'e3274f09a000000804000104019f700107c503000000c407a0000008040001cc08a000000151000000';

const entry = (fields: string) => {
  const length = (fields.length / 2).toString(16).padStart(2, '0');
  return fromHex(`e3${length}${fields}`);
};

describe('registryEntries', () => {
  it("reads the card manager's own entry", () => {
    const [cardManager, ...rest] = registryEntries(fromHex(CARD_MANAGER))!;
    expect(rest).toEqual([]);
    expect(toHex(cardManager.aid)).toBe('a000000151000000');
    expect(cardManager.lifeCycle).toBe(0x0f);
    expect(toHex(cardManager.privileges)).toBe('9efe80');
  });

  it('reads every application in the order the card sent them', () => {
    const entries = registryEntries(fromHex(APPLICATIONS))!;
    expect(entries.map(e => toHex(e.aid))).toEqual([
      'a00000080400010101',
      'd2760000850101',
      'a00000080400010301',
      'a00000080400010401',
    ]);
    expect(entries.every(e => e.lifeCycle === 0x07)).toBe(true);
    expect(entries.every(e => toHex(e.privileges) === '000000')).toBe(true);
  });

  it('takes the older single privileges byte', () => {
    const [only] = registryEntries(entry('4f05a0000001519f700107c50180'))!;
    expect(toHex(only.privileges)).toBe('80');
  });

  it('reads an answer with no entry as an empty list', () => {
    expect(registryEntries(new Uint8Array(0))).toEqual([]);
  });

  it.each([
    ['another tag', 'e1054f03a00000'],
    ['an entry past the answer', 'e3204f05a000000151'],
    ['bytes after the last entry', `${CARD_MANAGER}00`],
    ['no AID', toHex(entry('9f70010fc503000000'))],
    ['an AID of 4 bytes', toHex(entry('4f04a00000019f70010fc503000000'))],
    [
      'an AID of 17 bytes',
      toHex(entry(`4f11${'a0'.repeat(17)}9f70010fc503000000`)),
    ],
    ['no life cycle', toHex(entry('4f05a000000151c503000000'))],
    [
      'a life cycle of 2 bytes',
      toHex(entry('4f05a0000001519f70020f00c503000000')),
    ],
    ['no privileges', toHex(entry('4f05a0000001519f70010f'))],
    ['privileges of 2 bytes', toHex(entry('4f05a0000001519f70010fc5020000'))],
    [
      'a second AID',
      toHex(entry('4f05a0000001514f05a0000001529f70010fc503000000')),
    ],
    ['a field past its entry', toHex(entry('4f05a0000001519f70'))],
    ['an AID in two entries', `${CARD_MANAGER}${CARD_MANAGER}`],
  ])('reads nothing from %s', (_, hex) => {
    expect(registryEntries(fromHex(hex))).toBeNull();
  });
});

describe('cardLifeCycleName', () => {
  it.each([
    [0x01, 'OP_READY'],
    [0x07, 'INITIALIZED'],
    [0x0f, 'SECURED'],
    [0x7f, 'CARD_LOCKED'],
    [0xff, 'TERMINATED'],
  ])('names %p as %s', (lifeCycle, name) => {
    expect(cardLifeCycleName(lifeCycle)).toBe(name);
  });

  it('names no other value', () => {
    expect(cardLifeCycleName(0x03)).toBeNull();
  });
});

describe('managementPrivileges', () => {
  it.each([
    ['000000', []],
    ['804000', ['Authorized Management']],
    ['a00000', ['Delegated Management']],
    ['801000', ['Global Delete']],
    ['9efe80', ['Authorized Management', 'Global Delete']],
    ['980a00', []],
  ])('reads %s as %p', (hex, names) => {
    expect(managementPrivileges(fromHex(hex))).toEqual(names);
  });

  it('cannot read the older single byte', () => {
    expect(managementPrivileges(fromHex('80'))).toBeNull();
  });
});

describe('listsEveryDomain', () => {
  it.each([
    ['9efe80', true],
    ['9efa80', false],
    ['80', false],
  ])('%s: %p', (hex, every) => {
    expect(listsEveryDomain(fromHex(hex))).toBe(every);
  });
});

describe('isSecurityDomain', () => {
  it.each([
    ['9efe80', true],
    ['800000', true],
    ['001000', false],
    ['00', false],
  ])('%s: %p', (hex, domain) => {
    expect(isSecurityDomain(fromHex(hex))).toBe(domain);
  });
});
