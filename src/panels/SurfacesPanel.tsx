import { useStore } from '../store/projectStore';
import { useT } from '../i18n/i18n';

/** „Oldalak" csoport: minden felület egy sorban — láthatóság-checkbox + sorra kattintva szerkesztő. */
export function SurfacesPanel() {
  const surfaces = useStore((s) => s.surfaces)();
  const openSurfaceEditor = useStore((s) => s.openSurfaceEditor);
  const toggleSurfaceHidden = useStore((s) => s.toggleSurfaceHidden);
  const editingSurfaceId = useStore((s) => s.editingSurfaceId);
  const t = useT();

  if (surfaces.length === 0) {
    return <p className="muted small">{t('surfaces.empty')}</p>;
  }

  return (
    <div className="surface-rows">
      {surfaces.map((s) => (
        <div key={s.id} className={'surface-row' + (s.id === editingSurfaceId ? ' active' : '')}>
          <input
            type="checkbox"
            checked={!s.hidden}
            title={t('surfaces.visibility')}
            onChange={() => toggleSurfaceHidden(s.id)}
          />
          <button
            className={'link' + (s.hidden ? ' dim' : '')}
            onClick={() => openSurfaceEditor(s.id)}
            title={t('surfaces.editSurface')}
          >
            {s.label}
          </button>
        </div>
      ))}
    </div>
  );
}
