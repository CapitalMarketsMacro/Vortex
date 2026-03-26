import type { Table } from '@perspective-dev/client';

/**
 * Semantic font sizes (Perspective datagrid body cells default to ~12px).
 * Matching is case-insensitive; hyphens and spaces are normalized (e.g. `extra-large`, `extra large`).
 */
export type VortexBlotterRowFontSizePreset =
  | 'smaller'
  | 'small'
  | 'regular'
  | 'large'
  | 'extraLarge'
  | 'extra-large'
  | 'extra large'
  | 'xtraLarge'
  | 'xtra-large'
  | 'xtra large'
  | 'xtraLarger'
  | 'xtra-larger'
  | 'xtra larger';

/**
 * Semantic font weights. Matching is case-insensitive; hyphens/spaces normalized.
 */
export type VortexBlotterRowFontWeightPreset =
  | 'thin'
  | 'extraLight'
  | 'extra-light'
  | 'extra light'
  | 'light'
  | 'regular'
  | 'medium'
  | 'semiBold'
  | 'semi-bold'
  | 'semi bold'
  | 'bold'
  | 'extraBold'
  | 'extra-bold'
  | 'extra bold'
  | 'black'
  | 'heavy';

/**
 * When a cell in `column` matches `match`, the entire row gets the optional
 * foreground (`color`), `backgroundColor`, `fontSize`, and/or `fontWeight`.
 * If several rules match the same row, the one with the **highest** {@link order}
 * wins; ties use the **later** rule in the `rules` array.
 */
export interface VortexBlotterRowStyleRule {
  column: string;
  /**
   * Precedence when multiple rules match the same row. Higher numbers override lower.
   * Defaults to `0` when omitted.
   */
  order?: number;
  /**
   * Called with the **condition column’s** cell value. This is usually the
   * **display-formatted** value the grid shows (e.g. `"1,234.56"` from `Intl`), not
   * necessarily a raw `number`. For numeric thresholds use
   * {@link parseVortexBlotterNumericValue}.
   */
  match: (value: unknown) => boolean;
  backgroundColor?: string;
  color?: string;
  /** Semantic size preset (see {@link VortexBlotterRowFontSizePreset}). */
  fontSize?: VortexBlotterRowFontSizePreset;
  /** Semantic weight preset (see {@link VortexBlotterRowFontWeightPreset}). */
  fontWeight?: VortexBlotterRowFontWeightPreset;
}

function normalizePresetKey(s: string): string {
  return s.trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
}

const FONT_SIZE_CSS: Record<string, string> = {
  smaller: '10px',
  small: '11px',
  regular: '12px',
  normal: '12px',
  large: '14px',
  extralarge: '16px',
  'extra large': '16px',
  xtralarge: '16px',
  'xtra large': '16px',
  xtralarger: '18px',
  'xtra larger': '18px',
  'extra larger': '18px',
};

const FONT_WEIGHT_CSS: Record<string, string> = {
  thin: '100',
  extralight: '200',
  'extra light': '200',
  light: '300',
  regular: '400',
  normal: '400',
  medium: '500',
  semibold: '600',
  'semi bold': '600',
  bold: '700',
  extrabold: '800',
  'extra bold': '800',
  black: '900',
  heavy: '800',
};

/** Resolves a font-size preset to a CSS `font-size` value, or undefined if unknown. */
export function resolveVortexBlotterFontSize(
  preset: VortexBlotterRowFontSizePreset | undefined,
): string | undefined {
  if (preset == null) {
    return undefined;
  }
  const k = normalizePresetKey(String(preset));
  return FONT_SIZE_CSS[k] ?? FONT_SIZE_CSS[k.replace(/\s/g, '')];
}

/** Resolves a font-weight preset to a CSS `font-weight` value, or undefined if unknown. */
export function resolveVortexBlotterFontWeight(
  preset: VortexBlotterRowFontWeightPreset | undefined,
): string | undefined {
  if (preset == null) {
    return undefined;
  }
  const k = normalizePresetKey(String(preset));
  return FONT_WEIGHT_CSS[k] ?? FONT_WEIGHT_CSS[k.replace(/\s/g, '')];
}

/**
 * Parses a cell value for numeric comparisons inside {@link VortexBlotterRowStyleRule.match}.
 * Handles raw numbers and **formatted strings** (thousands separators, spaces, NBSP;
 * both `1,234.56` and `1.234,56`-style decimals).
 *
 * @returns A finite number, or `null` if the value is not numeric.
 */
export function parseVortexBlotterNumericValue(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value !== 'string') {
    return null;
  }

  let s = value.trim().replace(/\s/g, '').replace(/\u00a0/g, '');
  if (s === '' || s === '-') {
    return null;
  }

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    s =
      s.lastIndexOf(',') > s.lastIndexOf('.')
        ? s.replace(/\./g, '').replace(',', '.')
        : s.replace(/,/g, '');
  } else if (hasComma && !hasDot) {
    const parts = s.split(',');
    const last = parts[parts.length - 1] ?? '';
    if (
      parts.length > 1 &&
      last.length <= 2 &&
      /^\d+$/.test(last) &&
      parts.slice(0, -1).every((p) => /^\d+$/.test(p))
    ) {
      s = parts.slice(0, -1).join('') + '.' + last;
    } else {
      s = s.replace(/,/g, '');
    }
  } else {
    s = s.replace(/,/g, '');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
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

/** Marks cells we styled so we can clear overrides on the next paint. */
const VORTEX_ROW_STYLE_ATTR = 'data-vortex-blotter-row-style';

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

function columnNameForCell(meta: unknown, columnNames: string[]): string | undefined {
  const leaf = leafColumnName(meta);
  if (leaf != null) {
    return leaf;
  }
  const body = asBodyMeta(meta);
  if (!body) {
    return undefined;
  }
  const n = columnNames[body.x];
  return n !== undefined ? String(n) : undefined;
}

function clearVortexCellOverrides(table: HTMLTableElement): void {
  for (const el of table.querySelectorAll(`[${VORTEX_ROW_STYLE_ATTR}]`)) {
    stripVortexOverrides(el as HTMLElement);
  }
}

function stripVortexOverrides(cell: HTMLElement): void {
  cell.removeAttribute(VORTEX_ROW_STYLE_ATTR);
  cell.classList.remove('vortex-blotter-row-override');
  cell.style.removeProperty('background-color');
  cell.style.removeProperty('background');
  cell.style.removeProperty('background-image');
  cell.style.removeProperty('color');
  cell.style.removeProperty('font-size');
  cell.style.removeProperty('font-weight');
  cell.style.removeProperty('animation');
  const bar = cell.querySelector(':scope > div');
  if (bar instanceof HTMLElement) {
    bar.style.removeProperty('display');
  }
}

/**
 * Perspective applies float/integer heatmaps per `td` (gradient, pulse, bar, etc.).
 * Inherited `tr` styles lose to those cell inline styles, so we set each body cell
 * with `!important` after the datagrid’s own style listener runs (we register second).
 */
function applyRulesToTable(
  rt: RegularTableLike,
  rules: VortexBlotterRowStyleRule[],
  columnNames: string[],
): void {
  const table = rt.querySelectorAll('table')[0] as HTMLTableElement | undefined;
  if (!table) {
    return;
  }

  for (const tr of table.querySelectorAll('tbody tr')) {
    (tr as HTMLElement).style.backgroundColor = '';
    (tr as HTMLElement).style.color = '';
  }

  const rowStyle = new Map<
    number,
    {
      backgroundColor?: string;
      color?: string;
      fontSize?: string;
      fontWeight?: string;
    }
  >();

  if (rules.length > 0) {
    const rowValues = new Map<number, Map<string, unknown>>();
    for (const el of table.querySelectorAll('td, th')) {
      const raw = rt.getMeta(el as HTMLElement);
      const body = asBodyMeta(raw);
      if (!body) {
        continue;
      }
      const colName = columnNameForCell(raw, columnNames);
      if (colName === undefined) {
        continue;
      }
      let byCol = rowValues.get(body.y);
      if (!byCol) {
        byCol = new Map();
        rowValues.set(body.y, byCol);
      }
      byCol.set(colName, body.value);
    }

    for (const [y, colMap] of rowValues) {
      let bestOrder = -Infinity;
      let bestIndex = -1;
      let bestRule: VortexBlotterRowStyleRule | undefined;
      for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex++) {
        const rule = rules[ruleIndex]!;
        const val = colMap.get(rule.column);
        if (val === undefined) {
          continue;
        }
        if (!rule.match(val)) {
          continue;
        }
        const ord = rule.order ?? 0;
        if (ord > bestOrder || (ord === bestOrder && ruleIndex > bestIndex)) {
          bestOrder = ord;
          bestIndex = ruleIndex;
          bestRule = rule;
        }
      }
      if (bestRule !== undefined) {
        rowStyle.set(y, {
          backgroundColor: bestRule.backgroundColor,
          color: bestRule.color,
          fontSize: resolveVortexBlotterFontSize(bestRule.fontSize),
          fontWeight: resolveVortexBlotterFontWeight(bestRule.fontWeight),
        });
      }
    }
  }

  const styledYs = new Set(rowStyle.keys());

  for (const el of table.querySelectorAll(`[${VORTEX_ROW_STYLE_ATTR}]`)) {
    const cell = el as HTMLElement;
    const raw = rt.getMeta(cell);
    const body = asBodyMeta(raw);
    const y = body?.y;
    if (y === undefined || !styledYs.has(y)) {
      stripVortexOverrides(cell);
    }
  }

  if (rules.length === 0 || rowStyle.size === 0) {
    return;
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
    const cell = el as HTMLElement;
    cell.setAttribute(VORTEX_ROW_STYLE_ATTR, '');
    cell.classList.add('vortex-blotter-row-override');

    if (s.backgroundColor) {
      cell.style.setProperty('background-image', 'none', 'important');
      cell.style.setProperty('animation', 'none', 'important');
      cell.style.setProperty('background-color', s.backgroundColor, 'important');
    }
    if (s.color) {
      cell.style.setProperty('color', s.color, 'important');
    }
    if (s.fontSize) {
      cell.style.setProperty('font-size', s.fontSize, 'important');
    }
    if (s.fontWeight) {
      cell.style.setProperty('font-weight', s.fontWeight, 'important');
    }

    const bar = cell.querySelector(':scope > div');
    if (bar instanceof HTMLElement && cell.classList.contains('psp-color-mode-bar')) {
      bar.style.setProperty('display', 'none', 'important');
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
    const columnNames = Array.isArray(columns)
      ? columns.map((c) => String(c))
      : [];

    const tryAttach = (): boolean => {
      const grid = findPerspectiveDatagrid(viewer);
      const rt = grid?.regular_table as RegularTableLike | undefined;
      if (!rt?.addStyleListener || !rt.getMeta) {
        return false;
      }

      const listener = (): void => {
        queueMicrotask(() => {
          applyRulesToTable(rt, rules, columnNames);
        });
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
      clearVortexCellOverrides(tbl);
      for (const tr of tbl.querySelectorAll('tbody tr')) {
        (tr as HTMLElement).style.backgroundColor = '';
        (tr as HTMLElement).style.color = '';
      }
    }
  };
}
