function isValidDialect(value: string): value is 'pg' | 'mysql' | 'sqlite' {
  return ['pg', 'mysql', 'sqlite'].some((dialect) => dialect === value);
}

export function getCliOptions() {
  const argNames = ['schema', 'out', 'dialect', 'relational'] as const;
  const argv = process.argv.slice(2);
  const options: { [K in (typeof argNames)[number]]?: string } = {};

  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i].replace('--', '') as (typeof argNames)[number];
    const value = argv[i + 1];
    options[name] = value;
  }

  const { schema, out, dialect, relational } = options;

  if (!schema) {
    throw new Error('No value for "--schema" was provided');
  }

  if (!dialect) {
    throw new Error('No value for "--dialect" was provided');
  }

  if (!isValidDialect(dialect)) {
    throw new Error(
      `"${dialect}" is not a valid value for "--dialect". Valid values are: "pg", "mysql" & "sqlite"`
    );
  }


  return {
    schema,
    dialect,
    out: out || './',
    relational: relational === 'true'
  };
}
