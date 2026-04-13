/*
 * Public API Surface of vortex-blotter-core
 *
 * Re-exports the framework-agnostic utilities from vortex-blotter's source.
 * React (and other non-Angular) consumers import from this package.
 */

export {
  bootstrapVortexBlotterPerspective,
  VORTEX_BLOTTER_DEFAULT_WASM_ASSETS_BASE,
} from '../../vortex-blotter/src/lib/perspective-bootstrap';

export {
  deleteLayoutFromStorage,
  isVortexBlotterSavedLayoutV1,
  listLayoutNames,
  loadLayoutFromStorage,
  readLayoutMap,
  sanitizeLayoutName,
  saveLayoutToStorage,
  VORTEX_BLOTTER_LAYOUTS_STORAGE_KEY,
} from '../../vortex-blotter/src/lib/layout-storage';
export type { VortexBlotterSavedLayoutV1 } from '../../vortex-blotter/src/lib/layout-storage';

export {
  applyPerspectiveLayoutToken,
  clonePerspectiveTokenForJson,
} from '../../vortex-blotter/src/lib/perspective-layout-token';

export {
  draftsToStyleRules,
  draftToStyleRule,
  buildConditionMatcher,
} from '../../vortex-blotter/src/lib/row-style-editor';
export type {
  VortexBlotterRowEditorDraft,
  VortexBlotterRowStyleConditionOp,
} from '../../vortex-blotter/src/lib/row-style-editor';

export {
  attachVortexBlotterRowStyles,
  findPerspectiveDatagrid,
  parseVortexBlotterNumericValue,
  resolveVortexBlotterFontSize,
  resolveVortexBlotterFontWeight,
} from '../../vortex-blotter/src/lib/perspective-row-styles';
export type {
  VortexBlotterRowFontSizePreset,
  VortexBlotterRowFontWeightPreset,
  VortexBlotterRowStyleRule,
} from '../../vortex-blotter/src/lib/perspective-row-styles';

export { attachVortexBlotterColumnHeaderLabels } from '../../vortex-blotter/src/lib/perspective-column-headers';

export {
  carbonThemePalette,
  neoQuantumThemePalette,
  parseVortexPerspectiveThemeChoice,
  PERSPECTIVE_VIEWER_THEME_ATTR,
  VORTEX_PERSPECTIVE_THEME_STORAGE_KEY,
} from '../../vortex-blotter/src/lib/perspective-theme-tokens';
export type {
  VortexPerspectiveThemeChoice,
} from '../../vortex-blotter/src/lib/perspective-theme-tokens';

export {
  buildVortexCustomPerspectiveThemesCss,
  injectVortexCustomPerspectiveThemesCss,
  REGISTERED_PERSPECTIVE_THEME_NAMES,
} from '../../vortex-blotter/src/lib/perspective-theme-css';

export {
  readStoredPerspectiveTheme,
  persistPerspectiveThemeChoice,
} from '../../vortex-blotter/src/lib/perspective-theme-storage';

export { parseTablesListResponse } from '../../vortex-blotter/src/lib/tables-list-parser';
