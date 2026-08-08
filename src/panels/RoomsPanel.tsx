import { useState } from 'react';
import { useStore } from '../store/projectStore';
import { RoomEditor } from './RoomEditor';
import { useT } from '../i18n/i18n';

/** Szobák: pontos méretű téglalap-szoba gyors létrehozása + lista/törlés. */
export function RoomsPanel() {
  const rooms = useStore((s) => s.project.rooms);
  const roomHidden = useStore((s) => s.project.roomHidden);
  const addRoom = useStore((s) => s.addRoom);
  const removeRoom = useStore((s) => s.removeRoom);
  const toggleRoomHidden = useStore((s) => s.toggleRoomHidden);

  const [w, setW] = useState(400);
  const [l, setL] = useState(300);
  const [h, setH] = useState(270);
  const [editRoomId, setEditRoomId] = useState<string | null>(null);
  const t = useT();

  const addRect = () => {
    // origó-illesztett téglalap (cm), az XZ síkon
    addRoom([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: l }, { x: 0, y: l }], h);
  };

  return (
    <div className="panel">
      <div className="form-row">
        <label className="muted">{t('rooms.rect')}</label>
      </div>
      <div className="form-row">
        <input type="number" value={w} min={1} style={{ width: 60 }} onChange={(e) => setW(+e.target.value)} />
        <span>×</span>
        <input type="number" value={l} min={1} style={{ width: 60 }} onChange={(e) => setL(+e.target.value)} />
        <span className="muted">×</span>
        <input type="number" value={h} min={1} style={{ width: 56 }} onChange={(e) => setH(+e.target.value)} />
        <span className="muted">{t('rooms.heightAbbr')}</span>
      </div>
      <button className="primary" onClick={addRect}>
        {t('rooms.addRect')}
      </button>
      <p className="muted small">{t('rooms.customHint')}</p>

      <div className="room-list">
        {rooms.map((r) => (
          <div key={r.id} className="room-item" onDoubleClick={() => setEditRoomId(r.id)} title={t('rooms.dblEdit')}>
            <input
              type="checkbox"
              checked={!roomHidden?.[r.id]}
              title={t('rooms.visibility')}
              onChange={() => toggleRoomHidden(r.id)}
            />
            <button className="link" onClick={() => setEditRoomId(r.id)}>
              {r.name}
            </button>
            <span className="muted small">{r.heightCm} cm</span>
            <button className="icon danger" onClick={() => removeRoom(r.id)}>
              ✕
            </button>
          </div>
        ))}
        {rooms.length === 0 && <p className="muted small">{t('rooms.empty')}</p>}
      </div>

      {editRoomId && <RoomEditor roomId={editRoomId} onClose={() => setEditRoomId(null)} />}
    </div>
  );
}
