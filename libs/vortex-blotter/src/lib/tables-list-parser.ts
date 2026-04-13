/** Normalize JSON from GET /api/tables (and similar) into table name strings. */
export function parseTablesListResponse(data: unknown): string[] {
  const pushString = (out: Set<string>, s: string): void => {
    const t = s.trim();
    if (t.length > 0) {
      out.add(t);
    }
  };

  const collect = (node: unknown, out: Set<string>): void => {
    if (node === null || node === undefined) {
      return;
    }
    if (typeof node === 'string') {
      pushString(out, node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        collect(item, out);
      }
      return;
    }
    if (typeof node === 'object') {
      const o = node as Record<string, unknown>;
      if (typeof o['name'] === 'string') {
        pushString(out, o['name']);
      }
      if (typeof o['table'] === 'string') {
        pushString(out, o['table']);
      }
      if (typeof o['id'] === 'string') {
        pushString(out, o['id']);
      }
      for (const key of ['tables', 'data', 'names', 'results', 'items'] as const) {
        if (key in o) {
          collect(o[key], out);
        }
      }
    }
  };

  const out = new Set<string>();
  collect(data, out);
  return [...out].sort((a, b) => a.localeCompare(b));
}
