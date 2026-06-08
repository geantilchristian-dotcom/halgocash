---
name: DB push workaround
description: drizzle-kit push is interactive in this project; use executeSql() for schema changes
---

drizzle-kit push prompts interactively when it detects schema conflicts (promptNamedWithSchemasConflict).
Running it with `--force` fails (unrecognized flag).

**Why:** The drizzle-kit version in use does not support a non-interactive flag, and the sandbox blocks stdin.

**How to apply:** Use `executeSql({ sqlQuery: "CREATE TABLE IF NOT EXISTS ..." })` via the code_execution tool to apply schema changes directly. Always use `IF NOT EXISTS` to make it idempotent.
