import fs from 'fs';
import path from 'path';
import ts from 'typescript';

/**
 * Every surface that shows the affiliate link must show the disclosure next
 * to it. Five placements existed before anyone noticed the link was a paid
 * placement at all, so this asserts the rule rather than trusting review to
 * catch the sixth.
 *
 * Mirrors the shape of checkOfflineBundle.test.js: grep the source, fail on
 * the thing a human would not spot in a diff.
 */

const SRC = path.join(__dirname, '..', 'src');

// Touching the affiliate link means importing one of these.
const AFFILIATE_MARKERS = [
  'KEYCARD_PURCHASE_URL',
  'BUY_KEYCARD_LABEL',
  'useBuyKeycard',
];

// Files that touch the link but render no buy affordance of their own. Each
// entry needs a reason: an allowlist is how this guard stops working.
const ALLOWLIST: Record<string, string> = {
  [path.join('src', 'constants', 'keycard.ts')]:
    'declares the URL and the copy, renders nothing',
  [path.join('src', 'hooks', 'useBuyKeycard.ts')]:
    'routes browser vs QR, renders nothing; passes the disclosure as the QR note',
  [path.join('src', 'components', 'AffiliateDisclosure.tsx')]:
    'is the disclosure',
  [path.join('src', 'components', 'NFCBottomSheet', 'index.tsx')]:
    'builds onBuyKeycard and hands it to NFCSheet and NFCError, both of which label it',
};

/**
 * True only if the file RENDERS <AffiliateDisclosure />. Importing it, or
 * naming it in a comment, does not count: a placement that imports the
 * component and forgets to render it is exactly the bug this guard exists
 * to catch, so the check has to look at JSX rather than at text.
 */
function rendersDisclosure(source: string, fileName: string): boolean {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) {
      return;
    }
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      if (node.tagName.getText(sourceFile) === 'AffiliateDisclosure') {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  return found;
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(full);
    }
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('affiliate disclosure coverage', () => {
  const offenders: string[] = [];

  for (const file of walk(SRC)) {
    const relative = path.relative(path.join(__dirname, '..'), file);
    if (relative in ALLOWLIST) {
      continue;
    }

    const source = fs.readFileSync(file, 'utf8');
    const touchesAffiliate = AFFILIATE_MARKERS.some(marker =>
      source.includes(marker),
    );
    if (touchesAffiliate && !rendersDisclosure(source, file)) {
      offenders.push(relative);
    }
  }

  it('every file that surfaces the affiliate link also renders a disclosure', () => {
    expect(offenders).toEqual([]);
  });

  it('does not accept an import without a render', () => {
    const importedButUnused = [
      "import AffiliateDisclosure from '@/components/AffiliateDisclosure';",
      'export function Buy() {',
      '  return <Text>{BUY_KEYCARD_LABEL}</Text>;',
      '}',
    ].join('\n');

    expect(rendersDisclosure(importedButUnused, 'Buy.tsx')).toBe(false);
    expect(
      rendersDisclosure('const x = <AffiliateDisclosure short />;', 'x.tsx'),
    ).toBe(true);
  });

  it('does not accept the name in a comment or a string', () => {
    expect(
      rendersDisclosure('// TODO: add AffiliateDisclosure here', 'c.tsx'),
    ).toBe(false);
    expect(rendersDisclosure('const s = "AffiliateDisclosure";', 's.tsx')).toBe(
      false,
    );
  });
});
