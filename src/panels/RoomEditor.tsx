import { useEffect, useState } from 'react';
import { boundingBox } from '../model/geometry';
import { useStore } from '../store/projectStore';

interface Props {
  roomId: string;
  onClose: () => void;
}

/** Szoba szerkesztő popup: név, X-Y pozíció (eltolás), és csoportos fal-alapszín. */
export function RoomEditor({ roomId, onClose }: Props) {
  const room = useStore((s) => s.project.rooms.find((r) => r.id === roomId));
  const surfaceBaseColor = useStore((s) => s.project.surfaceBaseColor);
  const updateRoom = useStore((s) => s.updateRoom);
  const setRoomSurfacesBaseColor = useStore((s) => s.setRoomSurfacesBaseColor);

  const [xText, setXText] = useState('');
  const [yText, setYText] = useState('');
  const [hText, setHText] = useState('');

  useEffect(() => {
    if (room) {
      const bb = boundingBox(room.floorPolygon);
      setXText(String(Math.round(bb.minX)));
      setYText(String(Math.round(bb.minY)));
      setHText(String(Math.round(room.heightCm)));
    }
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!room) return null;

  // A magasság módosítása. Az alterületek a felület (u,v) terében a padlótól méretezettek (v=0 = padló),
  // ezért magasságváltozáskor a szoba aljához képest ugyanott maradnak – nincs teendő velük.
  const applyHeight = () => {
    const h = Math.max(1, Math.round(+hText) || room.heightCm);
    updateRoom(roomId, { heightCm: h });
    setHText(String(h));
  };

  // a csoport alapszín aktuális értéke: a falak/padló beállított színe, vagy alapértelmezett
  const groupColor = surfaceBaseColor?.[`${roomId}:wall:0`] ?? surfaceBaseColor?.[`${roomId}:floor`] ?? '#e7e3da';

  const applyPosition = () => {
    const bb = boundingBox(room.floorPolygon);
    const dx = (xText === '' ? bb.minX : Math.round(+xText)) - bb.minX;
    const dy = (yText === '' ? bb.minY : Math.round(+yText)) - bb.minY;
    updateRoom(roomId, { floorPolygon: room.floorPolygon.map((p) => ({ x: p.x + dx, y: p.y + dy })) });
    const nb = boundingBox(room.floorPolygon.map((p) => ({ x: p.x + dx, y: p.y + dy })));
    setXText(String(Math.round(nb.minX)));
    setYText(String(Math.round(nb.minY)));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal tile-inspector" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Szoba szerkesztése</strong>
          <button className="icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="tile-inspector-body">
          <div className="form-row">
            <label>Név</label>
            <input value={room.name} onChange={(e) => updateRoom(roomId, { name: e.target.value })} />
          </div>

          <div className="form-row">
            <label>Pozíció (cm)</label>
            <span className="muted">X</span>
            <input
              type="number"
              style={{ width: 64 }}
              value={xText}
              onChange={(e) => setXText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyPosition()}
            />
            <span className="muted">Y</span>
            <input
              type="number"
              style={{ width: 64 }}
              value={yText}
              onChange={(e) => setYText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyPosition()}
            />
            <button onClick={applyPosition}>Áthelyez</button>
          </div>

          <div className="form-row">
            <label>Magasság (cm)</label>
            <input
              type="number"
              min={1}
              style={{ width: 64 }}
              value={hText}
              onChange={(e) => setHText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyHeight()}
              onBlur={applyHeight}
            />
            <span className="muted small">az alterületek a padlóhoz rögzítve maradnak</span>
          </div>

          <div className="form-row">
            <label>Falak alapszíne</label>
            <input
              type="color"
              value={groupColor}
              onChange={(e) => setRoomSurfacesBaseColor(roomId, e.target.value)}
            />
            <span className="muted small">az összes oldalra (padló + falak)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
