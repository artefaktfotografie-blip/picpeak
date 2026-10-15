// artefakt fork: gallery visitors switch between three backgrounds –
// aubergine (house colour), white and black. The choice is stored in the
// visitor's browser and laid over the event theme by ThemeContext.
import type { ThemeConfig } from '../types/theme.types';

export type ArtefaktPalette = 'aubergine' | 'weiss' | 'schwarz';

export const ARTEFAKT_PALETTES: Record<ArtefaktPalette, {
  label: string;
  swatch: string;
  colors: Partial<ThemeConfig>;
}> = {
  aubergine: {
    label: 'Aubergine',
    swatch: '#4B2C45',
    colors: {
      colorMode: 'dark',
      backgroundColor: '#2E1B2B',
      surfaceColor: '#3A2536',
      elevatedColor: '#462D41',
      surfaceBorderColor: '#5A3A53',
      textColor: '#F6F2EC',
      mutedTextColor: '#CDBFC8',
      primaryColor: '#C4A26A',
      accentColor: '#C4A26A',
      accentDarkColor: '#C4A26A',
    },
  },
  weiss: {
    label: 'Weiss',
    swatch: '#FFFFFF',
    colors: {
      colorMode: 'light',
      backgroundColor: '#FFFFFF',
      surfaceColor: '#FFFFFF',
      elevatedColor: '#F6F2EC',
      surfaceBorderColor: '#E2D8CB',
      textColor: '#2E1B2B',
      mutedTextColor: '#6E6A5E',
      primaryColor: '#4B2C45',
      accentColor: '#4B2C45',
      accentDarkColor: '#4B2C45',
    },
  },
  schwarz: {
    label: 'Schwarz',
    swatch: '#0F0F0F',
    colors: {
      colorMode: 'dark',
      backgroundColor: '#0F0F0F',
      surfaceColor: '#1A1A1A',
      elevatedColor: '#242424',
      surfaceBorderColor: '#2E2E2E',
      textColor: '#F2F2F2',
      mutedTextColor: '#A3A3A3',
      primaryColor: '#C4A26A',
      accentColor: '#C4A26A',
      accentDarkColor: '#C4A26A',
    },
  },
};

const STORAGE_KEY = 'artefakt.galleryPalette';
const EVENT = 'artefakt:palette';

export function isGalleryPath(): boolean {
  return typeof window !== 'undefined' && window.location.pathname.includes('/gallery/');
}

/** The visitor's stored choice, or null to use the event's own theme. */
export function getStoredPalette(): ArtefaktPalette | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && v in ARTEFAKT_PALETTES ? (v as ArtefaktPalette) : null;
  } catch {
    return null;
  }
}

export function setStoredPalette(palette: ArtefaktPalette) {
  try {
    localStorage.setItem(STORAGE_KEY, palette);
  } catch {
    // Storage blocked: the switch still applies for this page view.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: palette }));
}

export function onPaletteChange(cb: (p: ArtefaktPalette) => void) {
  const handler = (e: Event) => cb((e as CustomEvent<ArtefaktPalette>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/** Lay the visitor's palette over a theme (gallery pages only). */
export function applyViewerPalette(theme: ThemeConfig, palette: ArtefaktPalette | null): ThemeConfig {
  if (!palette || !isGalleryPath()) return theme;
  return { ...theme, ...ARTEFAKT_PALETTES[palette].colors };
}
