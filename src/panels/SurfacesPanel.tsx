import { useStore } from '../store/projectStore';

/** „Oldalak" csoport: minden felület egy sorban — láthatóság-checkbox + sorra kattintva szerkesztő. */
export function SurfacesPanel() {
  const surfaces = useStore((s) => s.surfaces)();
  const openSurfaceEditor = useStore((s) => s.openSurfaceEditor);
  const toggleSurfaceHidden = useStore((s) => s.toggleSurfaceHidden);
  const editingSurfaceId = useStore((s) => s.editingSurfaceId);

  if (surfaces.length === 0) {
    return <p className="muted small">Még nincs oldal. Hozz létre szobát vagy dobozt.</p>;
  }

  return (
    <div className="surface-rows">
      {surfaces.map((s) => (
        <div key={s.id} className={'surface-row' + (s.id === editingSurfaceId ? ' active' : '')}>
          <input
            type="checkbox"
            checked={!s.hidden}
            title="Láthatóság"
            onChange={() => toggleSurfaceHidden(s.id)}
          />
          <button
            className={'link' + (s.hidden ? ' dim' : '')}
            onClick={() => openSurfaceEditor(s.id)}
            title="Oldal szerkesztése"
          >
            {s.label}
          </button>
        </div>
      ))}
    </div>
  );
}
