import type { Table } from '@perspective-dev/client';

/**
 * When a cell in `column` matches `match`, the entire row gets the optional
 * foreground (`color`) and/or `backgroundColor`. Earlier rules win for a given row.
 */
export interface VortexBlotterRowStyleRule {
  column: string;
  match: (value: unknown) => boolean;
  backgroundColor?: string;
  color?: string;
}

/** regular-table body cell metadata (subset used for row styling). */
interface RtBodyMeta {
  type: 'body';
  x: number;
  y: number;
  value: unknown;
  /** Column path segments; leaf usually matches the source column name (flat tables). */
  column_header?: unknown[];
}

type RegularTableLike = {
  addStyleListener: (
    fn: (ev: { detail: RegularTableLike }) => void | Promise<void>,
  ) => () => void;
  getMeta: (el: Element) => unknown;
  querySelectorAll: (sel: string) => NodeListOf<Element>;
};

type DatagridEl = HTMLElement & { regular_table?: RegularTableLike };

function findPerspectiveDatagrid(viewer: HTMLElement): DatagridEl | null {
  const direct =
    viewer.shadowRoot?.querySelector('perspective-viewer-datagrid') ??
    viewer.querySelector('perspective-viewer-datagrid');
  if (direct) {
    return direct as DatagridEl;
  }
  const stack: (ShadowRoot | DocumentFragment | HTMLElement)[] = [viewer];
  while (stack.length) {
    const root = stack.pop()!;
    const found = root.querySelector?.('perspective-viewer-datagrid');
    if (found) {
      return found as DatagridEl;
    }
    root.querySelectorAll?.('*').forEach((el) => {
      if (el.shadowRoot) {
        stack.push(el.shadowRoot);
      }
    });
  }
  return null;
}

function asBodyMeta(meta: unknown): RtBodyMeta | undefined {
  if (
    meta !== null &&
    typeof meta === 'object' &&
    (meta as RtBodyMeta).type === 'body'
  ) {
    return meta as RtBodyMeta;
  }
  return undefined;
}

function leafColumnName(meta: unknown): string | undefined {
  const body = asBodyMeta(meta);
  if (!body) {
    return undefined;
  }
  const ch = body.column_header;
  if (Array.isArray(ch) && ch.length > 0) {
    return String(ch[ch.length - 1]);
  }
  return undefined;
}

function buildColumnIndexMap(columns: unknown): Map<string, number> {
  const map = new Map<string, number>();
  if (!Array.isArray(columns)) {
    return map;
  }
  columns.forEach((c, i) => map.set(String(c), i));
  return map;
}

function columnMatches(
  meta: unknown,
  column: string,
  nameToX: Map<string, number>,
): boolean {
  if (leafColumnName(meta) === column) {
    return true;
  }
  const body = asBodyMeta(meta);
  if (!body) {
    return false;
  }
  const xi = nameToX.get(column);
  return xi !== undefined && body.x === xi;
}

function applyRulesToTable(
  rt: RegularTableLike,
  rules: VortexBlotterRowStyleRule[],
  nameToX: Map<string, number>,
): void {
  const table = rt.querySelectorAll('table')[0] as HTMLTableElement | undefined;
  if (!table) {
    return;
  }

  for (const tr of table.querySelectorAll('tbody tr')) {
    (tr as HTMLElement).style.backgroundColor = '';
    (tr as HTMLElement).style.color = '';
  }

  if (rules.length === 0) {
    return;
  }

  const rowStyle = new Map<number, { backgroundColor?: string; color?: string }>();

  for (const el of table.querySelectorAll('td, th')) {
    const raw = rt.getMeta(el as HTMLElement);
    const body = asBodyMeta(raw);
    if (!body) {
      continue;
    }
    for (const rule of rules) {
      if (!columnMatches(raw, rule.column, nameToX)) {
        continue;
      }
      if (!rule.match(body.value)) {
        continue;
      }
      if (!rowStyle.has(body.y)) {
        rowStyle.set(body.y, {
          backgroundColor: rule.backgroundColor,
          color: rule.color,
        });
        break;
      }
    }
  }

  for (const el of table.querySelectorAll('td, th')) {
    const raw = rt.getMeta(el as HTMLElement);
    const body = asBodyMeta(raw);
    if (!body) {
      continue;
    }
    const s = rowStyle.get(body.y);
    if (!s) {
      continue;
    }
    const tr = (el as HTMLElement).closest('tr');
    if (!tr) {
      continue;
    }
    if (s.backgroundColor) {
      tr.style.backgroundColor = s.backgroundColor;
    }
    if (s.color) {
      tr.style.color = s.color;
    }
  }
}

/**
 * Attaches regular-table style listeners so row background/foreground follow
 * {@link VortexBlotterRowStyleRule}s. Call after `viewer.load(table)` resolves.
 *
 * @returns cleanup function (removes listeners; clears row inline styles)
 */
export function attachVortexBlotterRowStyles(
  viewer: HTMLElement,
  table: Table,
  rules: VortexBlotterRowStyleRule[],
): () => Promise<void> {
  let cancelled = false;
  let unsubscribe: (() => void) | null = null;

  const run = async (): Promise<void> => {
    await customElements.whenDefined('perspective-viewer-datagrid');
    if (cancelled) {
      return;
    }
    const columns = await table.columns();
    const nameToX = buildColumnIndexMap(columns);

    const tryAttach = (): boolean => {
      const grid = findPerspectiveDatagrid(viewer);
      const rt = grid?.regular_table as RegularTableLike | undefined;
      if (!rt?.addStyleListener || !rt.getMeta) {
        return false;
      }

      const listener = (): void => {
        applyRulesToTable(rt, rules, nameToX);
      };

      unsubscribe?.();
      unsubscribe = rt.addStyleListener(listener);
      listener();
      return true;
    };

    if (tryAttach()) {
      return;
    }

    const start = performance.now();
    const maxMs = 8000;
    while (!cancelled && performance.now() - start < maxMs) {
      await new Promise((r) => requestAnimationFrame(r));
      if (tryAttach()) {
        return;
      }
    }
  };

  void run();

  return async () => {
    cancelled = true;
    unsubscribe?.();
    unsubscribe = null;
    const grid = findPerspectiveDatagrid(viewer);
    const rt = grid?.regular_table as RegularTableLike | undefined;
    const tbl = rt?.querySelectorAll('table')[0] as HTMLTableElement | undefined;
    if (tbl) {
      for (const tr of tbl.querySelectorAll('tbody tr')) {
        (tr as HTMLElement).style.backgroundColor = '';
        (tr as HTMLElement).style.color = '';
      }
    }
  };
}
