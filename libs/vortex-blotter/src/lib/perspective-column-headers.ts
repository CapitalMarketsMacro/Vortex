import type { Table } from '@perspective-dev/client';

import { findPerspectiveDatagrid } from './perspective-row-styles';

const HEADER_ATTR = 'data-vortex-blotter-header-key';

type RegularTableLike = {
  addStyleListener: (
    fn: (ev: { detail: RegularTableLike }) => void | Promise<void>,
  ) => () => void;
  getMeta: (el: Element) => unknown;
  querySelectorAll: (sel: string) => NodeListOf<Element>;
};

interface RtColumnHeaderMeta {
  type: 'column_header';
  column_header?: unknown[];
}

function asColumnHeaderMeta(meta: unknown): RtColumnHeaderMeta | undefined {
  if (
    meta !== null &&
    typeof meta === 'object' &&
    (meta as RtColumnHeaderMeta).type === 'column_header'
  ) {
    return meta as RtColumnHeaderMeta;
  }
  return undefined;
}

function columnKeyFromHeaderMeta(meta: RtColumnHeaderMeta): string | undefined {
  const ch = meta.column_header;
  if (!Array.isArray(ch) || ch.length === 0) {
    return undefined;
  }
  return String(ch[ch.length - 1]);
}

function setHeaderCellDisplayText(th: HTMLElement, text: string): void {
  const span =
    th.querySelector('span.rt-group-name') ??
    th.querySelector('span.rt-group-leaf');
  if (span) {
    span.textContent = text;
  } else {
    th.textContent = text;
  }
}

function applyColumnHeaderLabels(
  rt: RegularTableLike,
  labels: Readonly<Record<string, string>>,
): void {
  const table = rt.querySelectorAll('table')[0] as HTMLTableElement | undefined;
  if (!table) {
    return;
  }

  for (const th of table.querySelectorAll('thead th')) {
    const el = th as HTMLElement;
    if (el.classList.contains('psp-header-corner')) {
      continue;
    }
    const raw = rt.getMeta(el);
    const meta = asColumnHeaderMeta(raw);
    if (!meta) {
      continue;
    }

    const key = columnKeyFromHeaderMeta(meta);
    if (key === undefined) {
      continue;
    }

    const custom = labels[key]?.trim();
    if (custom) {
      el.setAttribute(HEADER_ATTR, key);
      setHeaderCellDisplayText(el, custom);
      continue;
    }

    if (el.hasAttribute(HEADER_ATTR)) {
      el.removeAttribute(HEADER_ATTR);
      setHeaderCellDisplayText(el, key);
    }
  }
}

/**
 * Replaces Perspective datagrid **column header** text with user-friendly labels.
 * Keys are **schema** column names (as returned by `Table.columns()`); row-style rules
 * and filters still use those same names.
 *
 * Runs after the datagrid’s own style pass (same pattern as row styles).
 */
export function attachVortexBlotterColumnHeaderLabels(
  viewer: HTMLElement,
  table: Table,
  labels: Readonly<Record<string, string>>,
): () => Promise<void> {
  let cancelled = false;
  let unsubscribe: (() => void) | null = null;

  const run = async (): Promise<void> => {
    await customElements.whenDefined('perspective-viewer-datagrid');
    if (cancelled) {
      return;
    }

    const tryAttach = (): boolean => {
      const grid = findPerspectiveDatagrid(viewer);
      const rt = grid?.regular_table as RegularTableLike | undefined;
      if (!rt?.addStyleListener || !rt.getMeta) {
        return false;
      }

      const listener = (): void => {
        queueMicrotask(() => {
          applyColumnHeaderLabels(rt, labels);
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
    if (tbl && rt) {
      applyColumnHeaderLabels(rt, {});
    }
  };
}
