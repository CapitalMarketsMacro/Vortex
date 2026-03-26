import {
  carbonThemePalette,
  neoQuantumThemePalette,
  type PerspectiveThemePalette,
} from './perspective-theme-tokens';

const STYLE_ID = 'vortex-blotter-perspective-custom-themes';

/**
 * Maps design tokens to Perspective viewer CSS custom properties (dark grid chrome).
 * Based on the same variable set used by built-in themes (see perspective-themes.css).
 */
function paletteToPerspectiveViewerRules(t: PerspectiveThemePalette): string {
  const bg = t.backgroundPrimary ?? t.background2;
  return `
  --button--font-size: 16px;
  --config-button--padding: 15px 8px 6px 8px;
  --column-drop-label--font-size: 8px;
  --column-drop-container--padding: 0px;
  --column-selector--width: 20px;
  --column-selector--font-size: 16px;
  --column_type--width: 25px;
  --select--padding: 0px;
  --top-panel-row--display: inline-flex;
  --button--min-width: 33px;
  color: ${t.textDefault};
  background-color: ${bg};
  --icon--color: ${t.textDefault};
  --inactive--color: ${t.textInactive};
  --inactive--border-color: ${t.borderNeutral};
  --root--background: ${bg};
  --active--color: ${t.brandPrimary};
  --error--color: ${t.statusCritical};
  --plugin--background: ${t.background2};
  --overflow-hint-icon--color: ${t.textInactive};
  --select--background-color: ${t.inputBackground};
  --column-drop-container--background: none;
  --warning--background: ${t.statusWarning};
  --warning--color: ${t.textDefault};
  --modal-target--background: ${t.contentBackground3};
  --active--background: color-mix(in srgb, ${t.brandPrimary} 35%, transparent);
  --expression--operator-color: ${t.textHelp};
  --expression--function-color: ${t.brandPrimaryHover};
  --expression--error-color: ${t.statusCritical};
  --code-editor-symbol--color: ${t.textDefault};
  --code-editor-literal--color: ${t.brandPrimary};
  --code-editor-operator--color: ${t.statusSuccess};
  --code-editor-comment--color: ${t.textInactive};
  --code-editor-column--color: ${t.brandPrimaryHover};
  --rt-pos-cell--color: ${t.statusSuccess};
  --rt-neg-cell--color: ${t.statusCritical};
  --d3fc-legend--text: ${t.textHelp};
  --d3fc-treedata--labels: ${t.textDefault};
  --d3fc-treedata--hover-highlight: ${t.textDefault};
  --d3fc-tooltip--color: ${t.textDefault};
  --d3fc-axis-ticks--color: ${t.textHelp};
  --d3fc-axis--lines: ${t.borderNeutral};
  --d3fc-gridline--color: ${t.contentBackground4};
  --d3fc-tooltip--background: ${t.background3};
  --d3fc-tooltip--border-color: ${t.borderNeutral};
  --d3fc-legend--background: var(--plugin--background);
  --d3fc-series: ${t.brandPrimary};
  --d3fc-series-1: ${t.brandPrimary};
  --d3fc-series-2: ${t.statusWarning};
  --d3fc-series-3: ${t.statusSuccess};
  --d3fc-series-4: ${t.statusCritical};
  --d3fc-series-5: ${t.brandSecondary};
  --d3fc-series-6: ${t.brandPrimaryActive};
  --d3fc-series-7: ${t.textInactive};
  --d3fc-series-8: ${t.textHelp};
  --d3fc-series-9: ${t.brandPrimaryHover};
  --d3fc-series-10: ${t.statusActive};
  --map-element-background: ${t.background2};
  --map-category-1: ${t.brandPrimary};
  --map-category-2: ${t.statusWarning};
  --map-category-3: ${t.statusSuccess};
  --map-category-4: ${t.statusCritical};
  --map-category-5: ${t.textHelp};
  --map-category-6: ${t.brandPrimaryHover};
  --map-category-7: ${t.textInactive};
  --map-category-8: ${t.borderNeutral};
  --map-category-9: ${t.contentBackground5};
  --map-category-10: ${t.statusActive};
`.trim();
}

function buildThemeBlock(
  themeAttrName: string,
  displayName: string,
  t: PerspectiveThemePalette,
): string {
  const rules = paletteToPerspectiveViewerRules(t);
  return `
perspective-viewer[theme="${themeAttrName}"] {
  --theme-name: "${displayName}";
  ${rules}
}
perspective-copy-menu[theme="${themeAttrName}"],
perspective-export-menu[theme="${themeAttrName}"],
perspective-dropdown[theme="${themeAttrName}"],
perspective-date-column-style[theme="${themeAttrName}"],
perspective-datetime-column-style[theme="${themeAttrName}"],
perspective-number-column-style[theme="${themeAttrName}"],
perspective-string-column-style[theme="${themeAttrName}"] {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  color: ${t.textDefault};
  background-color: ${t.background2};
  border: 1px solid ${t.borderNeutral};
  border-radius: 0 0 2px 2px;
}
`.trim();
}

export function buildVortexCustomPerspectiveThemesCss(): string {
  return [
    buildThemeBlock('Carbon', 'Carbon', carbonThemePalette.dark),
    buildThemeBlock('Neo Quantum', 'Neo Quantum', neoQuantumThemePalette.dark),
  ].join('\n\n');
}

export function injectVortexCustomPerspectiveThemesCss(): void {
  if (typeof document === 'undefined') {
    return;
  }
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = buildVortexCustomPerspectiveThemesCss();
}

export const REGISTERED_PERSPECTIVE_THEME_NAMES = [
  'Pro Dark',
  'Carbon',
  'Neo Quantum',
] as const;
