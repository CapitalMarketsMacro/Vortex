import {
  parseVortexPerspectiveThemeChoice,
  type VortexPerspectiveThemeChoice,
  VORTEX_PERSPECTIVE_THEME_STORAGE_KEY,
} from './perspective-theme-tokens';

export function readStoredPerspectiveTheme(): VortexPerspectiveThemeChoice {
  if (typeof localStorage === 'undefined') {
    return 'pro-dark';
  }
  try {
    const v = localStorage.getItem(VORTEX_PERSPECTIVE_THEME_STORAGE_KEY);
    return parseVortexPerspectiveThemeChoice(v) ?? 'pro-dark';
  } catch {
    /* ignore */
  }
  return 'pro-dark';
}

export function persistPerspectiveThemeChoice(choice: VortexPerspectiveThemeChoice): void {
  try {
    localStorage.setItem(VORTEX_PERSPECTIVE_THEME_STORAGE_KEY, choice);
  } catch {
    /* ignore */
  }
}
