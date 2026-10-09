import fs from 'fs';
import path from 'path';
import ts from 'typescript';

// The files and strings a platform would actually bundle, worked out the way
// Metro resolves them. Shared by the guards that assert what must not ship.

export const ROOT = path.join(__dirname, '..');
export const SRC = path.join(ROOT, 'src');

/** Strips one platform extension: Foo.ios.tsx -> Foo.tsx, Foo.tsx -> Foo.tsx. */
export function withoutPlatform(file: string): string {
  return file.replace(/\.(ios|android|native)(\.tsx?)$/, '$2');
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

/**
 * The files Metro would bundle for a platform: a `.ios` twin replaces its
 * plain sibling, and the twins of other platforms are left out.
 */
export function graphFor(platform: 'ios' | 'android'): string[] {
  const all = walk(SRC);
  const twins = new Set(
    all.filter(f => f.includes(`.${platform}.`)).map(f => withoutPlatform(f)),
  );

  return all.filter(file => {
    const isOwnTwin = file.includes(`.${platform}.`);
    const isOtherTwin = /\.(ios|android)\.tsx?$/.test(file) && !isOwnTwin;
    if (isOtherTwin) {
      return false;
    }
    return isOwnTwin || !twins.has(file);
  });
}

/**
 * Every string a file would ship: string and template literals and JSX text.
 * Comments are left out, so the comments explaining a rule do not trip it.
 */
export function shippedStrings(source: string, fileName: string): string[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const strings: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      strings.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  return strings;
}

/** Files in the platform's graph carrying `literal` in a shipped string. */
export function filesShipping(
  platform: 'ios' | 'android',
  literal: string,
): string[] {
  return graphFor(platform)
    .filter(file =>
      shippedStrings(fs.readFileSync(file, 'utf8'), file).some(text =>
        text.includes(literal),
      ),
    )
    .map(file => path.relative(ROOT, file));
}
