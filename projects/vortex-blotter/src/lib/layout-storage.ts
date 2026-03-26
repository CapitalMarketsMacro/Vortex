import type { VortexBlotterRowEditorDraft } from './row-style-editor';
import type { VortexPerspectiveThemeChoice } from './perspective-theme-tokens';

/** `localStorage` key for named layouts (sort, filters, row-style editor, column headers). */
export const VORTEX_BLOTTER_LAYOUTS_STORAGE_KEY = 'vortex-blotter.layouts.v1';

export interface VortexBlotterSavedLayoutV1 {
  version: 1;
  /**
   * Plain JSON object from `<perspective-viewer>.save()` (after cloning for storage).
   * `restore()` must receive an object — not `JSON.stringify(token)`; see Perspective docs.
   */
  perspective: unknown;
  /** Row style editor drafts (matches “Apply” state). */
  rowStyleEditorRows: VortexBlotterRowEditorDraft[];
  /** Column header editor rows (schema key → display text). */
  columnHeaderRows: { columnKey: string; displayName: string }[];
  /** Perspective UI theme (grid + chrome); omitted in layouts saved before this field existed. */
  perspectiveTheme?: VortexPerspectiveThemeChoice;
}

export function isVortexBlotterSavedLayoutV1(
  value: unknown,
): value is VortexBlotterSavedLayoutV1 {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const v = value as Record<string, unknown>;
  if (v['version'] !== 1) {
    return false;
  }
  if (!Array.isArray(v['rowStyleEditorRows'])) {
    return false;
  }
  if (!Array.isArray(v['columnHeaderRows'])) {
    return false;
  }
  return true;
}

function readRawMap(): Record<string, unknown> {
  if (typeof localStorage === 'undefined') {
    return {};
  }
  try {
    const raw = localStorage.getItem(VORTEX_BLOTTER_LAYOUTS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeRawMap(map: Record<string, unknown>): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(VORTEX_BLOTTER_LAYOUTS_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      throw new Error('Storage full — remove an old layout or free browser space.');
    }
    throw e;
  }
}

/** Returns all valid saved layouts (invalid entries are dropped). */
export function readLayoutMap(): Record<string, VortexBlotterSavedLayoutV1> {
  const raw = readRawMap();
  const out: Record<string, VortexBlotterSavedLayoutV1> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (isVortexBlotterSavedLayoutV1(value)) {
      out[name] = value;
    }
  }
  return out;
}

export function listLayoutNames(): string[] {
  return Object.keys(readLayoutMap()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

export function saveLayoutToStorage(
  name: string,
  layout: VortexBlotterSavedLayoutV1,
): void {
  const key = sanitizeLayoutName(name);
  if (!key) {
    throw new Error('Enter a layout name.');
  }
  const map = readRawMap();
  map[key] = layout;
  writeRawMap(map);
}

export function deleteLayoutFromStorage(name: string): void {
  const key = sanitizeLayoutName(name);
  if (!key) {
    return;
  }
  const map = readRawMap();
  delete map[key];
  writeRawMap(map);
}

export function loadLayoutFromStorage(
  name: string,
): VortexBlotterSavedLayoutV1 | undefined {
  const key = sanitizeLayoutName(name);
  if (!key) {
    return undefined;
  }
  const map = readLayoutMap();
  return map[key];
}

/** Trims and caps length; does not allow empty names. */
export function sanitizeLayoutName(name: string): string {
  const t = name.trim().slice(0, 128);
  return t;
}
