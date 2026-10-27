export function enteredWords(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0);
}

export function invalidWordError(
  text: string,
  wordCount: number,
  wordList: readonly string[],
  wordListName: string,
): string | null {
  const words = enteredWords(text);
  // A word still being typed is not judged until a space or the last word ends it.
  const hasTrailing = text.endsWith(' ') || text.endsWith('\n');
  const completeWords =
    hasTrailing || words.length >= wordCount ? words : words.slice(0, -1);
  const invalid = completeWords.find(
    word => !wordList.includes(word.toLowerCase()),
  );
  return invalid ? `"${invalid}" is not a valid ${wordListName} word` : null;
}
