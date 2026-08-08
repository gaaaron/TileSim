import { useStore } from '../store/projectStore';
import { useT } from '../i18n/i18n';

/** A kijelölt doboz méret/pozíció popupja. */
export function BoxInspector() {
  const selectedBoxId = useStore((s) => s.selectedBoxId);
  const box = useStore((s) => s.project.boxes.find((b) => b.id === selectedBoxId));
  const updateBox = useStore((s) => s.updateBox);
  const removeBox = useStore((s) => s.removeBox);
  const selectBox = useStore((s) => s.selectBox);
  const t = useT();

  if (!box) return null;

  const num = (v: number) => (Number.isFinite(v) ? v : 0);

  return (
    <div className="popup box-inspector">
      <div className="popup-head">
        <strong>{box.name}</strong>
        <button className="icon" onClick={() => selectBox(null)}>
          ✕
        </button>
      </div>

      <div className="grid2">
        <label>{t('inspector.widthX')}</label>
        <input
          type="number"
          value={box.size.w}
          min={1}
          onChange={(e) => updateBox(box.id, { size: { ...box.size, w: num(+e.target.value) } })}
        />
        <label>{t('inspector.heightY')}</label>
        <input
          type="number"
          value={box.size.h}
          min={1}
          onChange={(e) => updateBox(box.id, { size: { ...box.size, h: num(+e.target.value) } })}
        />
        <label>{t('inspector.depthZ')}</label>
        <input
          type="number"
          value={box.size.d}
          min={1}
          onChange={(e) => updateBox(box.id, { size: { ...box.size, d: num(+e.target.value) } })}
        />

        <label>{t('inspector.posX')}</label>
        <input
          type="number"
          value={Math.round(box.pos.x)}
          onChange={(e) => updateBox(box.id, { pos: { ...box.pos, x: num(+e.target.value) } })}
        />
        <label>{t('inspector.posZ')}</label>
        <input
          type="number"
          value={Math.round(box.pos.z)}
          onChange={(e) => updateBox(box.id, { pos: { ...box.pos, z: num(+e.target.value) } })}
        />
        <label>{t('inspector.bottomY')}</label>
        <input
          type="number"
          value={Math.round(box.pos.y)}
          onChange={(e) => updateBox(box.id, { pos: { ...box.pos, y: num(+e.target.value) } })}
        />

        <label>{t('inspector.rotation')}</label>
        <input
          type="number"
          value={box.rotationY}
          step={5}
          onChange={(e) => updateBox(box.id, { rotationY: num(+e.target.value) })}
        />
      </div>

      <button className="danger" onClick={() => { removeBox(box.id); selectBox(null); }}>
        {t('inspector.deleteBox')}
      </button>
    </div>
  );
}
