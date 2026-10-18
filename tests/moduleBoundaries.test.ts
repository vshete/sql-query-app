import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { builtinModules } from "node:module";
import { test } from "node:test";
import ts from "typescript";

const root = path.resolve("src");
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(directory, entry.name);
    return entry.isDirectory() ? files(name) : /\.tsx?$/.test(name) ? [name] : [];
  });
}
const sources = files(root);
const sourceSet = new Set(sources);
const nodeModules = new Set(builtinModules.map((name) => name.replace(/^node:/, "")));

// Traverse local imports, including dynamic imports and re-exports. A shared helper
// must not become a back door from the browser into server code.
test("browser entry points and shared modules cannot reach server code or Node dependencies", () => {
  const visited = new Set<string>();
  function visit(filename: string, chain: string[]) {
    if (visited.has(filename)) return;
    visited.add(filename);
    const source = ts.createSourceFile(filename, readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true);
    function check(specifier: string) {
      const trace = [...chain, path.relative(root, filename), specifier].join(" → ");
      assert.ok(!specifier.startsWith("node:") && !nodeModules.has(specifier) &&
        !/^(pg|sequelize|ws|langchain|@langchain\/|@modelcontextprotocol\/)/.test(specifier), trace);
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return;
      const base = specifier.startsWith("@/")
        ? path.join(root, specifier.slice(2))
        : path.resolve(path.dirname(filename), specifier);
      assert.ok(!base.startsWith(path.join(root, "lib/server") + path.sep), trace);
      assert.ok(!base.includes(`${path.sep}tests${path.sep}`), trace);
      const target = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find((name) => sourceSet.has(name));
      if (target) visit(target, [...chain, path.relative(root, filename)]);
    }
    function walk(node: ts.Node) {
      if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly && ts.isStringLiteral(node.moduleSpecifier)) check(node.moduleSpecifier.text);
      if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) check(node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === "require") && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) check(node.arguments[0].text);
      ts.forEachChild(node, walk);
    }
    walk(source);
  }
  for (const filename of sources) {
    const relative = path.relative(root, filename);
    if (/^(components|hooks|lib\/(client|shared)|types)\//.test(relative)) visit(filename, []);
  }
});
