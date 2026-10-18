import { SelectNoParensContext } from "dt-sql-parser/dist/lib/postgresql/PostgreSqlParser";
import { PostgreSqlParserListener } from "dt-sql-parser/dist/lib/postgresql/PostgreSqlParserListener";
import { PostgreSQL } from "dt-sql-parser/dist/parser/postgresql";

/** Normalize unquoted PostgreSQL identifiers while preserving the case of quoted identifiers. */
function identifier(text: string): string {
  return text.startsWith('"')
    ? text.slice(1, -1).replace(/""/g, '"')
    : text.toLowerCase();
}

/** Syntax validation is separate from the single-query/read-only policy. */
export function cleanAndValidateSql(
  value: string,
  allowedTables: ReadonlySet<string> | null = null,
): { sql: string; tables: string[] } {
  const sql = value
    .replace(/^```(?:sql)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const parser = new PostgreSQL();
  const errors = parser.validate(sql);

  if (errors.length)
    throw new Error(`Invalid PostgreSQL: ${errors[0].message}`);

  if (parser.splitSQLByStatement(sql)?.length !== 1) {
    throw new Error("Only a single read-only SQL query is allowed.");
  }
  const tables = new Set<string>();
  const reject = () => {
    throw new Error("Only read-only SELECT queries are allowed.");
  };

  const listener = new PostgreSqlParserListener();

  listener.enterStmt = (ctx) => {
    if (!ctx.selectStmt()) reject();
  };

  listener.enterPreParableStmt = (ctx) => {
    if (!ctx.selectStmt()) reject();
  };

  listener.enterIntoClause = reject;
  listener.enterForLockingClause = reject;
  listener.enterTableName = (ctx) => {
    const name = (ctx.getText().match(/"(?:[^"]|"")*"|[^.]+/g) ?? [])
      .map(identifier)
      .join(".");

    // CTE references are local to their enclosing SELECT, including nested queries.
    for (let ancestor = ctx.parent; ancestor; ancestor = ancestor.parent) {
      if (ancestor instanceof SelectNoParensContext) {
        const clause = ancestor.withClause();
        if (
          clause
            ?.commonTableExpr()
            .some((cte) => identifier(cte.colId().getText()) === name)
        )
          return;
      }
    }

    if (allowedTables && !allowedTables.has(name)) {
      throw new Error(
        "The query must use tables from the connected database schema.",
      );
    }
    tables.add(name);
  };
  parser.listen(listener, parser.parse(sql));

  if (!tables.size)
    throw new Error(
      "The query must use tables from the connected database schema.",
    );

  return { sql, tables: [...tables] };
}
