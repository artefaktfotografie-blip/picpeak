// artefakt fork: three round swatches in the gallery header to switch the
// background between aubergine, white and black.
import React, { useEffect, useState } from 'react';
import {
  ARTEFAKT_PALETTES,
  getStoredPalette,
  onPaletteChange,
  setStoredPalette,
  type ArtefaktPalette,
} from '../../utils/artefaktPalette';

const ORDER: ArtefaktPalette[] = ['aubergine', 'weiss', 'schwarz'];

export const GalleryPaletteSwitcher: React.FC = () => {
  const [active, setActive] = useState<ArtefaktPalette>(() => getStoredPalette() || 'aubergine');
  useEffect(() => onPaletteChange(setActive), []);

  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-1.5 py-1"
      style={{ border: '1px solid var(--color-surface-border)' }}
      role="radiogroup"
      aria-label="Hintergrundfarbe"
    >
      {ORDER.map((key) => {
        const p = ARTEFAKT_PALETTES[key];
        const selected = active === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={p.label}
            title={p.label}
            onClick={() => setStoredPalette(key)}
            className="w-5 h-5 rounded-full transition-transform"
            style={{
              backgroundColor: p.swatch,
              boxShadow: selected
                ? '0 0 0 2px var(--color-background), 0 0 0 3.5px var(--color-accent)'
                : 'inset 0 0 0 1px rgba(128,128,128,0.45)',
              transform: selected ? 'scale(1.05)' : undefined,
            }}
          />
        );
      })}
    </div>
  );
};
