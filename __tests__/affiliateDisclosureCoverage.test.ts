import fs from 'fs';
import path from 'path';
import ts from 'typescript';

import * as iosPurchaseLink from '../src/constants/purchaseLink';
import {
  ROOT,
  SRC,
  filesShipping,
  graphFor,
  shippedStrings,
  withoutPlatform,
} from './platformGraph.testUtils';

/**
 * Two rules, one per build, both asserted against the source tree rather than
 * against a render.
 *
 * Android: every surface that shows the affiliate link must show the
 * disclosure next to it. Five placements existed before anyone noticed the
 * link was a paid placement at all, so this asserts the rule rather than
 * trusting review to catch the sixth.
 *
 * iOS: the affiliate parameter and the Advertisement wording must not be in
 * the build at all. That is the inverse rule and it needs its own arm, because
 * the Android one is satisfied by a component that renders nothing —
 * AffiliateDisclosure.ios.tsx does exactly that, and would go on satisfying it
 * if a label came back. So the iOS arm reads the module graph the way Metro
 * resolves it for that platform and asserts the literals are absent.
 *
 * This is a source-level check and it can only ever be circumstantial about
 * the artifact. scripts/check-ios-bundle.js is the one that reads the bundle.
 *
 * Mirrors the shape of checkOfflineBundle.test.js: grep the source, fail on
 * the thing a human would not spot in a diff.
 */

// Touching the purchase link means importing one of these.
const AFFILIATE_MARKERS = [
  'KEYCARD_PURCHASE_URL',
  'BUY_KEYCARD_LABEL',
  'NO_CARD_EXIT_LABEL',
  'useBuyKeycard',
];

// Literals that must never reach an iOS build: the shop host, the referral
// code, and the word that makes a placement an identified advertisement.
const IOS_FORBIDDEN = ['get.keycard.tech', 'vuxxnf', 'Advertisement'];

// Files that touch the link but render no buy affordance of their own. Each
// entry needs a reason: an allowlist is how this guard stops working.
const ALLOWLIST: Record<string, string> = {
  [path.join('src', 'constants', 'purchaseLink.ts')]:
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

describe('affiliate disclosure coverage', () => {
  describe('the Android build, which carries the commission', () => {
    const offenders: string[] = [];

    for (const file of graphFor('android')) {
      const relative = path.relative(ROOT, file);
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

    it('still carries the affiliate link and the copy that labels it', () => {
      // The inverse of the iOS arm below: if this ever passes for the wrong
      // reason, someone has quietly taken the commission off Android.
      const purchase = fs.readFileSync(
        path.join(SRC, 'constants', 'purchaseLink.ts'),
        'utf8',
      );
      expect(purchase).toContain('get.keycard.tech');
      expect(purchase).toContain('vuxxnf');
      expect(purchase).toMatch(/Advertisement: affiliate link/);
    });
  });

  describe('the iOS build, which carries no commission', () => {
    const graph = graphFor('ios');

    it.each(IOS_FORBIDDEN)('ships no string containing %s', literal => {
      expect(filesShipping('ios', literal)).toEqual([]);
    });

    it('resolves the purchase link and the disclosure to their iOS twins', () => {
      // Guards the graph helper itself: if these stopped being twins the
      // assertions above would pass by reading the wrong files.
      const relative = graph.map(file => path.relative(ROOT, file));

      expect(relative).toContain(
        path.join('src', 'constants', 'purchaseLink.ios.ts'),
      );
      expect(relative).not.toContain(
        path.join('src', 'constants', 'purchaseLink.ts'),
      );
      expect(relative).toContain(
        path.join('src', 'components', 'AffiliateDisclosure.ios.tsx'),
      );
      expect(relative).not.toContain(
        path.join('src', 'components', 'AffiliateDisclosure.tsx'),
      );
    });

    it('points at the product site', () => {
      const ios = fs.readFileSync(
        path.join(SRC, 'constants', 'purchaseLink.ios.ts'),
        'utf8',
      );
      const url = /KEYCARD_PURCHASE_URL = '([^']*)'/.exec(ios)?.[1];

      expect(url).toBe('https://keycard.tech');
    });

    // Every label the iOS build renders, not just the button: the no-card
    // exit shows on two of the five surfaces and was the one that went on
    // asking "Don't have a Keycard?" after the rest had stopped.
    it.each(['BUY_KEYCARD_LABEL', 'NO_CARD_EXIT_LABEL'])(
      '%s names no verb and quotes no figure',
      name => {
        const label = (iosPurchaseLink as Record<string, unknown>)[name];

        expect(typeof label).toBe('string');
        expect(label).not.toMatch(/\b(buy|get|shop|order)\b/i);
        expect(label).not.toMatch(/[\d%$€£]/);
      },
    );

    // A dropped export is a runtime undefined, not a type error: tsc resolves
    // the base file for every consumer and never reads the twin.
    it('exports every name the iOS graph imports from it', () => {
      const imported = new Set<string>();
      for (const file of graph) {
        const source = fs.readFileSync(file, 'utf8');
        const re =
          /import\s*\{([^}]*)\}\s*from\s*'[^']*constants\/purchaseLink'/g;
        let match: RegExpExecArray | null;
        while ((match = re.exec(source))) {
          for (const name of match[1].split(',')) {
            const cleaned = name
              .trim()
              .split(/\s+as\s+/)[0]
              .trim();
            if (cleaned) {
              imported.add(cleaned);
            }
          }
        }
      }

      expect(imported.size).toBeGreaterThan(0);
      for (const name of imported) {
        expect(Object.keys(iosPurchaseLink)).toContain(name);
      }
    });
  });

  describe('the check itself', () => {
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
      expect(
        rendersDisclosure('const s = "AffiliateDisclosure";', 's.tsx'),
      ).toBe(false);
    });

    it('reads shipped strings and ignores comments', () => {
      // The comments explaining this rule necessarily quote the thing the
      // rule forbids. Flagging them would make the guard argue with its own
      // documentation, and comments do not reach the bundle anyway.
      expect(shippedStrings('// get.keycard.tech/vuxxnf', 'c.tsx')).toEqual([]);
      expect(shippedStrings('/* Advertisement: x */', 'c.tsx')).toEqual([]);
      expect(shippedStrings("const s = 'vuxxnf';", 's.tsx')).toEqual([
        'vuxxnf',
      ]);
      expect(shippedStrings('const s = `a vuxxnf b`;', 't.tsx')).toEqual([
        'a vuxxnf b',
      ]);
      // A constant's NAME is not its copy: naming it ships no wording.
      expect(
        shippedStrings('import { AFFILIATE_DISCLOSURE } from "x";', 'i.tsx'),
      ).toEqual(['x']);
    });

    it('shadows a plain file with its platform twin and drops the other platform', () => {
      expect(withoutPlatform(path.join('a', 'Foo.ios.tsx'))).toBe(
        path.join('a', 'Foo.tsx'),
      );
      expect(withoutPlatform(path.join('a', 'Foo.tsx'))).toBe(
        path.join('a', 'Foo.tsx'),
      );

      const ios = graphFor('ios').map(f => path.relative(ROOT, f));
      const android = graphFor('android').map(f => path.relative(ROOT, f));

      // Every twin belongs to exactly one of the two graphs.
      expect(ios).not.toContain(
        path.join('src', 'components', 'WelcomeActions.tsx'),
      );
      expect(android).not.toContain(
        path.join('src', 'components', 'WelcomeActions.ios.tsx'),
      );
      expect(android).toContain(
        path.join('src', 'components', 'WelcomeActions.tsx'),
      );
    });
  });
});
