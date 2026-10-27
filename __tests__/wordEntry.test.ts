import { enteredWords, invalidWordError } from '../src/utils/wordEntry';

const WORDS = ['abandon', 'ability', 'able', 'about'];

describe('enteredWords', () => {
  it('splits on any run of whitespace and drops empty words', () => {
    expect(enteredWords('  abandon\n ability   able ')).toEqual([
      'abandon',
      'ability',
      'able',
    ]);
  });

  it('is empty for blank text', () => {
    expect(enteredWords(' \n ')).toEqual([]);
  });
});

describe('invalidWordError', () => {
  it('waits for the word being typed', () => {
    expect(invalidWordError('abandon abil', 3, WORDS, 'BIP39')).toBeNull();
  });

  it('judges a word once a space or a newline ends it', () => {
    expect(invalidWordError('abandon abil ', 3, WORDS, 'BIP39')).toBe(
      '"abil" is not a valid BIP39 word',
    );
    expect(invalidWordError('abandon abil\n', 3, WORDS, 'BIP39')).toBe(
      '"abil" is not a valid BIP39 word',
    );
  });

  it('judges the last word once the phrase is full', () => {
    expect(invalidWordError('abandon able abil', 3, WORDS, 'BIP39')).toBe(
      '"abil" is not a valid BIP39 word',
    );
  });

  it('ignores case and names the first invalid word', () => {
    expect(
      invalidWordError('ABANDON nope wrong about', 4, WORDS, 'SLIP39'),
    ).toBe('"nope" is not a valid SLIP39 word');
  });

  it('passes a phrase of valid words', () => {
    expect(invalidWordError('abandon ability able', 3, WORDS, 'BIP39')).toBe(
      null,
    );
  });
});
