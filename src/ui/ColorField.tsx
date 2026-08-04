import { useStore } from '../store/projectStore';

interface Props {
  value: string;
  onChange: (color: string) => void;
  title?: string;
}

/**
 * Kompakt színválasztó: natív color input + EGYETLEN ikon, ami a kedvenc-színek popupot nyitja meg
 * (ott lehet a jelenlegi színt menteni, illetve egy kedvencet kiválasztani – erre a mezőre alkalmazva).
 */
export function ColorField({ value, onChange, title }: Props) {
  const openFavoriteColors = useStore((s) => s.openFavoriteColors);
  return (
    <span className="color-field" title={title}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      <button
        type="button"
        className="icon small"
        title="Kedvenc színek (mentés / kiválasztás)"
        onClick={() => openFavoriteColors({ color: value, onPick: onChange })}
      >
        ★
      </button>
    </span>
  );
}
