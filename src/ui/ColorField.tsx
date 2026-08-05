import { useStore } from '../store/projectStore';
import { useColorCommit } from './useColorCommit';

interface Props {
  value: string;
  onChange: (color: string) => void;
  title?: string;
}

/**
 * Kompakt színválasztó: natív color input + EGYETLEN ikon, ami a kedvenc-színek popupot nyitja meg
 * (ott lehet a jelenlegi színt menteni, illetve egy kedvencet kiválasztani – erre a mezőre alkalmazva).
 * A folyamatos színválasztás egyetlen undo-lépés, rAF-fel ritkítva (lásd useColorCommit).
 */
export function ColorField({ value, onChange, title }: Props) {
  const openFavoriteColors = useStore((s) => s.openFavoriteColors);
  const { change, end } = useColorCommit(onChange);
  return (
    <span className="color-field" title={title}>
      <input
        type="color"
        value={value}
        onChange={(e) => change(e.target.value)}
        onBlur={end}
      />
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
