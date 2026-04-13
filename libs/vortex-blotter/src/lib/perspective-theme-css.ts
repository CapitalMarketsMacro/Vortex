import {
  carbonThemePalette,
  neoQuantumThemePalette,
  type PerspectiveThemePalette,
} from './perspective-theme-tokens';

const STYLE_ID = 'vortex-blotter-perspective-custom-themes';

/**
 * Maps design tokens to Perspective viewer CSS custom properties (dark grid chrome).
 * Variable names follow Perspective 4.4+ `--psp-{module}--…` theme API
 * (@see https://github.com/perspective-dev/perspective/pull/3146).
 */
function paletteToPerspectiveViewerRules(t: PerspectiveThemePalette): string {
  const bg = t.backgroundPrimary ?? t.background2;
  return `
  --psp-button--font-size: 16px;
  --psp-config-button--padding: 15px 8px 6px 8px;
  --psp-column-selector--font-size: 16px;
  --psp-column-type--width: 25px;
  --psp-select--padding: 0px;
  --psp-top-panel-row--display: inline-flex;
  --psp-button--min-width: 33px;
  color: ${t.textDefault};
  background-color: ${bg};
  --psp--color: ${t.textDefault};
  --psp-inactive--color: ${t.textInactive};
  --psp-inactive--border-color: ${t.borderNeutral};
  --psp-active--color: ${t.brandPrimary};
  --psp-error--color: ${t.statusCritical};
  --psp--background-color: ${t.background2};
  --psp-icon-overflow-hint--color: ${t.textInactive};
  --psp-select--background-color: ${t.inputBackground};
  --psp-warning--background: ${t.statusWarning};
  --psp-warning--color: ${t.textDefault};
  --psp-active--background: color-mix(in srgb, ${t.brandPrimary} 35%, transparent);
  --psp-expression--operator--color: ${t.textHelp};
  --psp-expression--function--color: ${t.brandPrimaryHover};
  --psp-expression--error--color: ${t.statusCritical};
  --psp-code-editor--symbol--color: ${t.textDefault};
  --psp-code-editor--literal--color: ${t.brandPrimary};
  --psp-code-editor--operator--color: ${t.statusSuccess};
  --psp-code-editor--comment--color: ${t.textInactive};
  --psp-code-editor--column--color: ${t.brandPrimaryHover};
  --psp-datagrid--pos-cell--color: ${t.statusSuccess};
  --psp-datagrid--neg-cell--color: ${t.statusCritical};
  --psp-d3fc--legend--color: ${t.textHelp};
  --psp-d3fc--treemap--labels: ${t.textDefault};
  --psp-d3fc--treemap--hover-highlight: ${t.textDefault};
  --psp-d3fc--tooltip--color: ${t.textDefault};
  --psp-d3fc--axis-ticks--color: ${t.textHelp};
  --psp-d3fc--axis-lines--color: ${t.borderNeutral};
  --psp-d3fc--gridline--color: ${t.contentBackground4};
  --psp-d3fc--tooltip--background: ${t.background3};
  --psp-d3fc--tooltip--border-color: ${t.borderNeutral};
  --psp-d3fc--legend--background: var(--psp--background-color);
  --psp-d3fc--series--color: ${t.brandPrimary};
  --psp-d3fc--series-1--color: ${t.brandPrimary};
  --psp-d3fc--series-2--color: ${t.statusWarning};
  --psp-d3fc--series-3--color: ${t.statusSuccess};
  --psp-d3fc--series-4--color: ${t.statusCritical};
  --psp-d3fc--series-5--color: ${t.brandSecondary};
  --psp-d3fc--series-6--color: ${t.brandPrimaryActive};
  --psp-d3fc--series-7--color: ${t.textInactive};
  --psp-d3fc--series-8--color: ${t.textHelp};
  --psp-d3fc--series-9--color: ${t.brandPrimaryHover};
  --psp-d3fc--series-10--color: ${t.statusActive};
  --psp-openlayers--element--background: ${t.background2};
  --psp-openlayers--category-1--color: ${t.brandPrimary};
  --psp-openlayers--category-2--color: ${t.statusWarning};
  --psp-openlayers--category-3--color: ${t.statusSuccess};
  --psp-openlayers--category-4--color: ${t.statusCritical};
  --psp-openlayers--category-5--color: ${t.textHelp};
  --psp-openlayers--category-6--color: ${t.brandPrimaryHover};
  --psp-openlayers--category-7--color: ${t.textInactive};
  --psp-openlayers--category-8--color: ${t.borderNeutral};
  --psp-openlayers--category-9--color: ${t.contentBackground5};
  --psp-openlayers--category-10--color: ${t.statusActive};
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
  --psp-theme-name: "${displayName}";
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
