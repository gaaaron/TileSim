import { useRef, useState } from 'react';
import { useStore } from '../store/projectStore';

/** 3D objektumok: GLB feltöltés, modellből példány elhelyezése, elhelyezett objektumok listája. */
export function ObjectsPanel() {
  const models = useStore((s) => s.project.models);
  const objects = useStore((s) => s.project.objects);
  const rooms = useStore((s) => s.project.rooms);
  const addModelAsset = useStore((s) => s.addModelAsset);
  const addObject = useStore((s) => s.addObject);
  const removeObject = useStore((s) => s.removeObject);
  const selectObject = useStore((s) => s.selectObject);
  const selectedObjectId = useStore((s) => s.selectedObjectId);

  const fileInput = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="panel">
      <input
        ref={fileInput}
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          try {
            await addModelAsset(file);
          } catch (err) {
            alert('A modell betöltése sikertelen: ' + (err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <button className="primary" disabled={busy} onClick={() => fileInput.current?.click()}>
        {busy ? 'Betöltés…' : '+ Modell feltöltése (GLB/glTF)'}
      </button>

      {models.length > 0 && (
        <div className="model-list">
          {models.map((m) => (
            <div key={m.id} className="model-item">
              <span className="link">{m.name}</span>
              <span className="muted small">
                {m.naturalSize.w}×{m.naturalSize.h}×{m.naturalSize.d} cm
              </span>
              <button disabled={rooms.length === 0} title="Elhelyezés a szobában" onClick={() => addObject(m.id)}>
                + Elhelyez
              </button>
            </div>
          ))}
        </div>
      )}

      {objects.length > 0 && (
        <>
          <h4>Elhelyezett</h4>
          <div className="object-list">
            {objects.map((o) => (
              <div key={o.id} className={'object-item' + (o.id === selectedObjectId ? ' active' : '')}>
                <button className="link" onClick={() => selectObject(o.id)}>
                  {o.name}
                </button>
                <button className="icon danger" onClick={() => removeObject(o.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="muted small">Húzással mozgathatók az alaprajzon; méret/forgatás a popupban.</p>
    </div>
  );
}
