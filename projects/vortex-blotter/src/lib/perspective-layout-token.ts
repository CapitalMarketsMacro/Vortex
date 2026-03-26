import type { Table } from '@perspective-dev/client';

/**
 * Clones a `save()` token into a JSON-serializable plain object for `localStorage`.
 * Do not pass the result of `JSON.stringify(token)` to `restore()` — only plain objects.
 *
 * @see https://perspective-dev.github.io/guide/how_to/javascript/save_restore.html
 */
export function clonePerspectiveTokenForJson(token: unknown): unknown {
  if (token == null) {
    return null;
  }
  try {
    return JSON.parse(JSON.stringify(token)) as unknown;
  } catch {
    return token;
  }
}

/**
 * Normalizes a token read from storage for `restore()`.
 * - Plain objects are returned as-is (optionally clone first in caller).
 * - If a past bug stored `JSON.stringify(save())` as a string, parses it back to an object.
 * - Raw base64/msgpack strings from `save("string")` are not handled here.
 */
export function preparePerspectiveTokenForRestore(
  token: unknown,
): Record<string, unknown> | null {
  if (token == null) {
    return null;
  }
  if (typeof token === 'object' && !Array.isArray(token)) {
    return token as Record<string, unknown>;
  }
  if (typeof token === 'string') {
    const t = token.trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        const parsed = JSON.parse(token) as unknown;
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          !Array.isArray(parsed)
        ) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }
    return null;
  }
  return null;
}

type ViewerWithRestore = {
  restore?: (update: unknown) => Promise<unknown>;
  resize?: (force?: boolean | null) => Promise<unknown>;
};

/**
 * Applies a saved Perspective token to the viewer, rebinding `table` to the
 * **currently loaded** table name so restores work when the underlying table
 * id changes (e.g. demo `worker.table()` names).
 */
export async function applyPerspectiveLayoutToken(
  viewer: ViewerWithRestore,
  rawToken: unknown,
  currentTable: Table | null,
): Promise<boolean> {
  const prepared = preparePerspectiveTokenForRestore(rawToken);
  if (prepared == null) {
    return false;
  }

  const token = clonePerspectiveTokenForJson(prepared) as Record<
    string,
    unknown
  >;

  if (currentTable != null && typeof currentTable.get_name === 'function') {
    try {
      const name = await currentTable.get_name();
      token['table'] = name;
    } catch {
      /* keep token.table */
    }
  }

  if (typeof viewer.restore !== 'function') {
    return true;
  }

  try {
    await viewer.restore(token);
    if (typeof viewer.resize === 'function') {
      await viewer.resize(true);
    }
    return false;
  } catch {
    return true;
  }
}
