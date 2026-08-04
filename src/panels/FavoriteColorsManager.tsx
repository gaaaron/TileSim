import { useStore } from '../store/projectStore';

/**
 * Kedvenc színek popup. A megnyitó színválasztó a `favoritePicker`-en át adja át a jelenlegi színt és a
 * kiválasztás alkalmazóját (`onPick`). Itt lehet: a jelenlegi színt kedvencként menteni, egy kedvencet
 * kiválasztani (a hívó mezőre alkalmazva), illetve a kedvenceket szerkeszteni (név/szín) és törölni.
 */
export function FavoriteColorsManager() {
  const favorites = useStore((s) => s.project.favoriteColors);
  const target = useStore((s) => s.favoritePicker);
  const addFavoriteColor = useStore((s) => s.addFavoriteColor);
  const updateFavoriteColor = useStore((s) => s.updateFavoriteColor);
  const removeFavoriteColor = useStore((s) => s.removeFavoriteColor);
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
            <div key={f.id} className="fav-row">
              <button
                type="button"
                className="swatch"
                style={{ background: f.color }}
                title={`Kiválasztás (alkalmazás): ${f.name}`}
                onClick={() => pick(f.color)}
              />
              <input
                className="fav-name"
                value={f.name}
                placeholder="Név"
                onChange={(e) => updateFavoriteColor(f.id, { name: e.target.value })}
              />
              <input
                type="color"
                value={f.color}
                title="A kedvenc szín módosítása"
                onChange={(e) => updateFavoriteColor(f.id, { color: e.target.value })}
              />
              <button className="icon danger" title="Törlés" onClick={() => removeFavoriteColor(f.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
