SELECT
  n.nspname AS schema,
  c.relname AS name,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'name', a.attname,
          'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
          'nullable', NOT a.attnotnull,
          'default', pg_catalog.pg_get_expr(d.adbin, d.adrelid)
        ) ORDER BY a.attnum
      )
      FROM pg_catalog.pg_attribute a
      LEFT JOIN pg_catalog.pg_attrdef d
        ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = c.oid
        AND a.attnum > 0
        AND NOT a.attisdropped
    ),
    '[]'::json
  ) AS columns,
  COALESCE(
    (
      SELECT json_agg(
        pg_catalog.pg_get_constraintdef(k.oid, true) ORDER BY k.conname
      )
      FROM pg_catalog.pg_constraint k
      WHERE k.conrelid = c.oid
    ),
    '[]'::json
  ) AS constraints
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND n.nspname NOT LIKE 'pg_%'
  AND n.nspname <> 'information_schema'
  AND has_schema_privilege(n.oid, 'USAGE')
  AND has_table_privilege(c.oid, 'SELECT')
ORDER BY n.nspname, c.relname;
