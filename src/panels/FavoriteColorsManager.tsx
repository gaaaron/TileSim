import { FavoriteColor } from '../model/types';
import { useStore } from '../store/projectStore';
import { useColorCommit } from '../ui/useColorCommit';

/** Egy kedvenc-sor: kiválasztás (swatch), név, szín (rAF-ritkított, egy undo-lépés), törlés. */
function FavoriteRow({ fav, onPick }: { fav: FavoriteColor; onPick: (c: string) => void }) {
  const updateFavoriteColor = useStore((s) => s.updateFavoriteColor);
  const removeFavoriteColor = useStore((s) => s.removeFavoriteColor);
  const { change, end } = useColorCommit((c) => updateFavoriteColor(fav.id, { color: c }));
  return (
    <div className="fav-row">
      <button
        type="button"
        className="swatch"
        style={{ background: fav.color }}
        title={`Kiválasztás (alkalmazás): ${fav.name}`}
        onClick={() => onPick(fav.color)}
      />
      <input
        className="fav-name"
        value={fav.name}
        placeholder="Név"
        onChange={(e) => updateFavoriteColor(fav.id, { name: e.target.value })}
      />
      <input
        type="color"
        value={fav.color}
        title="A kedvenc szín módosítása"
        onChange={(e) => change(e.target.value)}
        onBlur={end}
      />
      <button className="icon danger" title="Törlés" onClick={() => removeFavoriteColor(fav.id)}>
        ✕
      </button>
    </div>
  );
}

/**
 * Kedvenc színek popup. A megnyitó színválasztó a `favoritePicker`-en át adja át a jelenlegi színt és a
 * kiválasztás alkalmazóját (`onPick`). Itt lehet: a jelenlegi színt kedvencként menteni, egy kedvencet
 * kiválasztani (a hívó mezőre alkalmazva), illetve a kedvenceket szerkeszteni (név/szín) és törölni.
 */
export function FavoriteColorsManager() {
  const favorites = useStore((s) => s.project.favoriteColors);
  const target = useStore((s) => s.favoritePicker);
  const addFavoriteColor = useStore((s) => s.addFavoriteColor);
  const openFavoriteColors = useStore((s) => s.openFavoriteColors);

  const close = () => openFavoriteColors(null);
  const current = target?.color ?? '#cccccc';
  const alreadySaved = favorites.some((f) => f.color.toLowerCase() === current.toLowerCase());
  const pick = (color: string) => {
    target?.onPick(color);
    close();
  };

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal tile-inspector" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Kedvenc színek</strong>
          <button className="icon" onClick={close}>
            ✕
          </button>
        </div>

        <div className="tile-inspector-body">
          {/* jelenlegi szín + mentés */}
          <div className="fav-row">
            <span className="swatch-lg" style={{ background: current }} />
            <span className="muted small" style={{ flex: 1 }}>
              Jelenlegi szín: {current.toUpperCase()}
            </span>
            <button disabled={alreadySaved} onClick={() => addFavoriteColor(current)}>
              {alreadySaved ? 'Már mentve' : '★ Mentés'}
            </button>
          </div>

          <hr className="sep" />

          <h4>Mentett színek</h4>
          {favorites.length === 0 && (
            <p className="muted small">Még nincs mentett szín. A fenti „★ Mentés"-sel adhatod hozzá a jelenlegit.</p>
          )}
          {favorites.map((f) => (
            <FavoriteRow key={f.id} fav={f} onPick={pick} />
          ))}
        </div>
      </div>
    </div>
  );
}
