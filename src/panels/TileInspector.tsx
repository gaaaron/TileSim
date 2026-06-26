import { useStore } from '../store/projectStore';

interface Props {
  tileId: string;
  onClose: () => void;
}

/** A kijelölt csempetípus szerkesztő popupja (név, méret, fuga). */
export function TileInspector({ tileId, onClose }: Props) {
  const tile = useStore((s) => s.project.tileTypes.find((t) => t.id === tileId));
  const updateTileType = useStore((s) => s.updateTileType);

  if (!tile) return null;
  const num = (v: number) => (Number.isFinite(v) ? v : 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal tile-inspector" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Csempe szerkesztése</strong>
          <button className="icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="tile-inspector-body">
          <div className="form-row">
            <label>Név</label>
            <input value={tile.name} onChange={(e) => updateTileType(tile.id, { name: e.target.value })} />
          </div>

          <div className="form-row">
            <label>Méret (cm)</label>
            <input
              type="number"
              min={1}
              style={{ width: 64 }}
              value={tile.widthCm}
              onChange={(e) => updateTileType(tile.id, { widthCm: Math.max(1, num(+e.target.value)) })}
            />
            <span>×</span>
            <input
              type="number"
              min={1}
              style={{ width: 64 }}
              value={tile.heightCm}
              onChange={(e) => updateTileType(tile.id, { heightCm: Math.max(1, num(+e.target.value)) })}
            />
          </div>

          <div className="form-row">
            <label>Fuga</label>
            <input
              type="number"
              min={0}
              step={0.5}
              style={{ width: 64 }}
              value={tile.groutMm}
              onChange={(e) => updateTileType(tile.id, { groutMm: num(+e.target.value) })}
            />
            <span className="muted">mm</span>
            <input
              type="color"
              value={tile.groutColor}
              onChange={(e) => updateTileType(tile.id, { groutColor: e.target.value })}
            />
          </div>

          {tile.images.length > 0 && (
            <div className="thumbs">
              {tile.images.map((img) => (
                <img key={img.id} src={img.url} alt={img.name} className="thumb" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
