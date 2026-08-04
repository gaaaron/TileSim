import { useStore } from '../store/projectStore';

/** A kijelölt 3D objektum méret/pozíció popupja (mint a dobozé). */
export function ObjectInspector() {
  const selectedObjectId = useStore((s) => s.selectedObjectId);
  const obj = useStore((s) => s.project.objects.find((o) => o.id === selectedObjectId));
  const updateObject = useStore((s) => s.updateObject);
  const removeObject = useStore((s) => s.removeObject);
  const selectObject = useStore((s) => s.selectObject);

  if (!obj) return null;
  const num = (v: number) => (Number.isFinite(v) ? v : 0);

  return (
    <div className="popup box-inspector">
      <div className="popup-head">
        <strong>{obj.name}</strong>
        <button className="icon" onClick={() => selectObject(null)}>
          ✕
        </button>
      </div>

      <div className="grid2">
        <label>Szélesség (X)</label>
        <input
          type="number"
          value={Math.round(obj.size.w)}
          min={1}
          onChange={(e) => updateObject(obj.id, { size: { ...obj.size, w: Math.max(1, num(+e.target.value)) } })}
        />
        <label>Magasság (Y)</label>
        <input
          type="number"
          value={Math.round(obj.size.h)}
          min={1}
          onChange={(e) => updateObject(obj.id, { size: { ...obj.size, h: Math.max(1, num(+e.target.value)) } })}
        />
        <label>Mélység (Z)</label>
        <input
          type="number"
          value={Math.round(obj.size.d)}
          min={1}
          onChange={(e) => updateObject(obj.id, { size: { ...obj.size, d: Math.max(1, num(+e.target.value)) } })}
        />

        <label>Pozíció X</label>
        <input
          type="number"
          value={Math.round(obj.pos.x)}
          onChange={(e) => updateObject(obj.id, { pos: { ...obj.pos, x: num(+e.target.value) } })}
        />
        <label>Pozíció Z</label>
        <input
          type="number"
          value={Math.round(obj.pos.z)}
          onChange={(e) => updateObject(obj.id, { pos: { ...obj.pos, z: num(+e.target.value) } })}
        />
        <label>Alja magasság (Y)</label>
        <input
          type="number"
          value={Math.round(obj.pos.y)}
          onChange={(e) => updateObject(obj.id, { pos: { ...obj.pos, y: num(+e.target.value) } })}
        />

        <label>Forgatás (°)</label>
        <input
          type="number"
          value={obj.rotationY}
          step={5}
          onChange={(e) => updateObject(obj.id, { rotationY: num(+e.target.value) })}
        />
      </div>

      <button className="danger" onClick={() => { removeObject(obj.id); selectObject(null); }}>
        Objektum törlése
      </button>
    </div>
  );
}
