/**
 * Design tokens for custom Perspective viewer themes (dark variants used for the grid).
 */
export interface PerspectiveThemePalette {
  backgroundPrimary?: string;
  background1: string;
  background2: string;
  background3: string;
  background4: string;
  background5: string;
  background6: string;
  brandSecondary: string;
  brandSecondaryActive: string;
  brandSecondaryHover: string;
  brandSecondaryFocused: string;
  brandSecondaryText: string;
  inputBackground: string;
  inputColor: string;
  inputPlaceholder: string;
  inputDisabled: string;
  inputFocused: string;
  inputBorder: string;
  textDefault: string;
  textHelp: string;
  textInactive: string;
  brandPrimary: string;
  brandPrimaryActive: string;
  brandPrimaryHover: string;
  brandPrimaryFocused: string;
  brandPrimaryText: string;
  statusSuccess: string;
  statusWarning: string;
  statusCritical: string;
  statusActive: string;
  contentBackground1: string;
  contentBackground2: string;
  contentBackground3: string;
  contentBackground4: string;
  contentBackground5: string;
  borderNeutral: string;
}

export const carbonThemePalette: { light: PerspectiveThemePalette; dark: PerspectiveThemePalette } =
  {
    light: {
      backgroundPrimary: '#F1F3F4',
      background1: '#FAFAFA',
      background2: '#F1F3F4',
      background3: '#E8EAED',
      background4: '#DADCE0',
      background5: '#BDC1C6',
      background6: '#9AA0A6',
      brandSecondary: '#BDC1C6',
      brandSecondaryActive: '#B3B7BC',
      brandSecondaryHover: '#C7CBD0',
      brandSecondaryFocused: '#202124',
      brandSecondaryText: '#202124',
      inputBackground: '#DADCE0',
      inputColor: '#202124',
      inputPlaceholder: '#5F6368',
      inputDisabled: '#80868B',
      inputFocused: '#9AA0A6',
      inputBorder: '#80868B',
      textDefault: '#202124',
      textHelp: '#3C4043',
      textInactive: '#80868B',
      brandPrimary: '#0D9488',
      brandPrimaryActive: '#0B7C72',
      brandPrimaryHover: '#14B8A6',
      brandPrimaryFocused: '#FFFFFF',
      brandPrimaryText: '#FFFFFF',
      statusSuccess: '#0D9488',
      statusWarning: '#F59E0B',
      statusCritical: '#DC2626',
      statusActive: '#0D9488',
      contentBackground1: '#FAFAFA',
      contentBackground2: '#F1F3F4',
      contentBackground3: '#E8EAED',
      contentBackground4: '#DADCE0',
      contentBackground5: '#BDC1C6',
      borderNeutral: '#9AA0A6',
    },
    dark: {
      backgroundPrimary: '#262626',
      background1: '#161616',
      background2: '#262626',
      background3: '#343434',
      background4: '#3F3F3F',
      background5: '#525252',
      background6: '#6F6F6F',
      brandSecondary: '#525252',
      brandSecondaryActive: '#3F3F3F',
      brandSecondaryHover: '#6F6F6F',
      brandSecondaryFocused: '#FFFFFF',
      brandSecondaryText: '#F4F4F4',
      inputBackground: '#3F3F3F',
      inputColor: '#F4F4F4',
      inputPlaceholder: '#C6C6C6',
      inputDisabled: '#8D8D8D',
      inputFocused: '#14B8A6',
      inputBorder: '#8D8D8D',
      textDefault: '#F4F4F4',
      textHelp: '#E0E0E0',
      textInactive: '#A8A8A8',
      brandPrimary: '#14B8A6',
      brandPrimaryActive: '#0D9488',
      brandPrimaryHover: '#2DD4BF',
      brandPrimaryFocused: '#161616',
      brandPrimaryText: '#161616',
      statusSuccess: '#10B981',
      statusWarning: '#FBBF24',
      statusCritical: '#EF4444',
      statusActive: '#14B8A6',
      contentBackground1: '#161616',
      contentBackground2: '#262626',
      contentBackground3: '#343434',
      contentBackground4: '#3F3F3F',
      contentBackground5: '#525252',
      borderNeutral: '#8D8D8D',
    },
  };

export const neoQuantumThemePalette: {
  light: PerspectiveThemePalette;
  dark: PerspectiveThemePalette;
} = {
  light: {
    background1: '#FFFFFF',
    background2: '#F6F7F9',
    background3: '#EDEEF2',
    background4: '#E1E3E8',
    background5: '#D0D3D9',
    background6: '#A9AEB8',
    brandSecondary: '#D0D3D9',
    brandSecondaryActive: '#C3C6CE',
    brandSecondaryHover: '#E1E3E8',
    brandSecondaryFocused: '#09090B',
    brandSecondaryText: '#09090B',
    inputBackground: '#EDEEF2',
    inputColor: '#09090B',
    inputPlaceholder: '#71717A',
    inputDisabled: '#A1A1AA',
    inputFocused: '#0055FF',
    inputBorder: '#D0D3D9',
    textDefault: '#09090B',
    textHelp: '#52525B',
    textInactive: '#A1A1AA',
    brandPrimary: '#0055FF',
    brandPrimaryActive: '#0044CC',
    brandPrimaryHover: '#3377FF',
    brandPrimaryFocused: '#FFFFFF',
    brandPrimaryText: '#FFFFFF',
    statusSuccess: '#006B2C',
    statusWarning: '#A36A00',
    statusCritical: '#B30029',
    statusActive: '#0055FF',
    contentBackground1: '#FFFFFF',
    contentBackground2: '#F6F7F9',
    contentBackground3: '#EDEEF2',
    contentBackground4: '#E1E3E8',
    contentBackground5: '#D0D3D9',
    borderNeutral: '#A9AEB8',
  },
  dark: {
    background1: '#000000',
    background2: '#0A0A0C',
    background3: '#121215',
    background4: '#1C1C21',
    background5: '#27272F',
    background6: '#3F3F4A',
    brandSecondary: '#27272F',
    brandSecondaryActive: '#1C1C21',
    brandSecondaryHover: '#3F3F4A',
    brandSecondaryFocused: '#FFFFFF',
    brandSecondaryText: '#FFFFFF',
    inputBackground: '#121215',
    inputColor: '#FFFFFF',
    inputPlaceholder: '#71717A',
    inputDisabled: '#3F3F4A',
    inputFocused: '#00E5FF',
    inputBorder: '#27272F',
    textDefault: '#FFFFFF',
    textHelp: '#A1A1AA',
    textInactive: '#52525B',
    brandPrimary: '#00E5FF',
    brandPrimaryActive: '#00B8CC',
    brandPrimaryHover: '#33EEFF',
    brandPrimaryFocused: '#000000',
    brandPrimaryText: '#000000',
    statusSuccess: '#00FF66',
    statusWarning: '#FFD600',
    statusCritical: '#FF0055',
    statusActive: '#00E5FF',
    contentBackground1: '#000000',
    contentBackground2: '#0A0A0C',
    contentBackground3: '#121215',
    contentBackground4: '#1C1C21',
    contentBackground5: '#27272F',
    borderNeutral: '#3F3F4A',
  },
};

export type VortexPerspectiveThemeChoice = 'pro-dark' | 'carbon' | 'neo-quantum';

/** `theme` attribute values for `<perspective-viewer>`. */
export const PERSPECTIVE_VIEWER_THEME_ATTR: Record<VortexPerspectiveThemeChoice, string> = {
  'pro-dark': 'Pro Dark',
  carbon: 'Carbon',
  'neo-quantum': 'Neo Quantum',
};

export const VORTEX_PERSPECTIVE_THEME_STORAGE_KEY = 'vortex-blotter.perspective-theme.v1';

/** Returns a valid theme id, or `undefined` if `raw` is not recognized. */
export function parseVortexPerspectiveThemeChoice(
  raw: unknown,
): VortexPerspectiveThemeChoice | undefined {
  if (raw === 'pro-dark' || raw === 'carbon' || raw === 'neo-quantum') {
    return raw;
  }
  return undefined;
}
