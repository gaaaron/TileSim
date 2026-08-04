import { useRef, useState } from 'react';
import { useStore } from '../store/projectStore';
import { TileInspector } from './TileInspector';
import { ColorField } from '../ui/ColorField';

/** Csempetípusok kezelése: létrehozás, képfeltöltés, fuga, törlés. */
export function TileLibraryPanel() {
  const tileTypes = useStore((s) => s.project.tileTypes);
  const addTileType = useStore((s) => s.addTileType);
  const updateTileType = useStore((s) => s.updateTileType);
  const removeTileType = useStore((s) => s.removeTileType);
  const addImagesToTile = useStore((s) => s.addImagesToTile);

  const [name, setName] = useState('Terrakotta');
  const [w, setW] = useState(40);
  const [h, setH] = useState(60);
  const [editId, setEditId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  return (
    <div className="panel">
      <div className="form-row">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Név" />
      </div>
      <div className="form-row">
        <label>Méret (cm)</label>
        <input type="number" value={w} min={1} onChange={(e) => setW(+e.target.value)} style={{ width: 60 }} />
        <span>×</span>
        <input type="number" value={h} min={1} onChange={(e) => setH(+e.target.value)} style={{ width: 60 }} />
      </div>
      <button className="primary" onClick={() => addTileType(name, w, h)}>
        + Csempetípus
      </button>

      <div className="tile-list">
        {tileTypes.map((t) => (
          <div key={t.id} className="tile-card">
            <div className="tile-card-head">
              <button className="tile-edit-btn" onClick={() => setEditId(t.id)} title="Szerkesztés">
                <strong>{t.name}</strong>
                <span className="muted">
                  {t.widthCm}×{t.heightCm} cm
                </span>
                <span className="edit-hint">✎</span>
              </button>
              <button className="icon danger" onClick={() => removeTileType(t.id)} title="Törlés">
                ✕
              </button>
            </div>

            <div className="thumbs">
              {t.images.map((img) => (
                <img key={img.id} src={img.url} alt={img.name} className="thumb" />
              ))}
              {t.images.length === 0 && (
                <span className="thumb" style={{ background: t.color ?? '#c9c4b8' }} title="Sima szín" />
              )}
            </div>

            <div className="form-row">
              <label className="muted">Fuga</label>
              <input
                type="number"
                value={t.groutMm}
                min={0}
                step={0.5}
                style={{ width: 56 }}
                onChange={(e) => updateTileType(t.id, { groutMm: +e.target.value })}
              />
              <span className="muted">mm</span>
              <ColorField value={t.groutColor} onChange={(c) => updateTileType(t.id, { groutColor: c })} />
            </div>

            <input
              ref={(el) => (fileInputs.current[t.id] = el)}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) addImagesToTile(t.id, files);
                e.target.value = '';
              }}
            />
            <button onClick={() => fileInputs.current[t.id]?.click()}>+ Kép feltöltése</button>
          </div>
        ))}
      </div>

      {editId && <TileInspector tileId={editId} onClose={() => setEditId(null)} />}
    </div>
  );
}
