import { useRef, useState } from 'react';
import { useStore } from '../store/projectStore';
import { TileInspector } from './TileInspector';
import { ColorField } from '../ui/ColorField';
import { useT } from '../i18n/i18n';

/** Csempetípusok kezelése: létrehozás, képfeltöltés, fuga, törlés. */
export function TileLibraryPanel() {
  const tileTypes = useStore((s) => s.project.tileTypes);
  const addTileType = useStore((s) => s.addTileType);
  const updateTileType = useStore((s) => s.updateTileType);
  const removeTileType = useStore((s) => s.removeTileType);
  const addImagesToTile = useStore((s) => s.addImagesToTile);
  const t = useT();

  const [name, setName] = useState(t('tilelib.defaultName'));
  const [w, setW] = useState(40);
  const [h, setH] = useState(60);
  const [editId, setEditId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  return (
    <div className="panel">
      <div className="form-row">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('tilelib.namePlaceholder')} />
      </div>
      <div className="form-row">
        <label>{t('tilelib.size')}</label>
        <input type="number" value={w} min={1} onChange={(e) => setW(+e.target.value)} style={{ width: 60 }} />
        <span>×</span>
        <input type="number" value={h} min={1} onChange={(e) => setH(+e.target.value)} style={{ width: 60 }} />
      </div>
      <button className="primary" onClick={() => addTileType(name, w, h)}>
        {t('tilelib.addType')}
      </button>

      <div className="tile-list">
        {tileTypes.map((tt) => {
          const bf = Math.max(0, 1 + (tt.brightness ?? 0));
          const brightFilter = bf !== 1 ? `brightness(${bf})` : undefined;
          return (
          <div key={tt.id} className="tile-card">
            <div className="tile-card-head">
              <button className="tile-edit-btn" onClick={() => setEditId(tt.id)} title={t('tilelib.edit')}>
                <strong>{tt.name}</strong>
                <span className="muted">
                  {tt.widthCm}×{tt.heightCm} cm
                </span>
                <span className="edit-hint">✎</span>
              </button>
              <button className="icon danger" onClick={() => removeTileType(tt.id)} title={t('tilelib.delete')}>
                ✕
              </button>
            </div>

            <div className="thumbs">
              {tt.images.map((img) => (
                <img key={img.id} src={img.url} alt={img.name} className="thumb" style={{ filter: brightFilter }} />
              ))}
              {tt.images.length === 0 && (
                <span
                  className="thumb"
                  style={{ background: tt.color ?? '#c9c4b8', filter: brightFilter }}
                  title={t('tilelib.plainColor')}
                />
              )}
            </div>

            <div className="form-row">
              <label className="muted">{t('tilelib.grout')}</label>
              <input
                type="number"
                value={tt.groutMm}
                min={0}
                step={0.5}
                style={{ width: 56 }}
                onChange={(e) => updateTileType(tt.id, { groutMm: +e.target.value })}
              />
              <span className="muted">{t('tile.mm')}</span>
              <ColorField value={tt.groutColor} onChange={(c) => updateTileType(tt.id, { groutColor: c })} />
            </div>

            <input
              ref={(el) => (fileInputs.current[tt.id] = el)}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) addImagesToTile(tt.id, files);
                e.target.value = '';
              }}
            />
            <button onClick={() => fileInputs.current[tt.id]?.click()}>{t('tilelib.uploadImage')}</button>
          </div>
          );
        })}
      </div>

      {editId && <TileInspector tileId={editId} onClose={() => setEditId(null)} />}
    </div>
  );
}
