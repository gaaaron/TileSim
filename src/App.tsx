import { useEffect, useRef } from 'react';
import { useStore } from './store/projectStore';
import { PlanView } from './views/PlanView';
import { View3D } from './views/View3D';
import { SurfaceEditor } from './views/SurfaceEditor';
import { TileLibraryPanel } from './panels/TileLibraryPanel';
import { RoomsPanel } from './panels/RoomsPanel';
import { SurfacesPanel } from './panels/SurfacesPanel';
import { MaterialPanel } from './panels/MaterialPanel';
import { ObjectsPanel } from './panels/ObjectsPanel';
import { BoxInspector } from './panels/BoxInspector';
import { ObjectInspector } from './panels/ObjectInspector';
import { FavoriteColorsManager } from './panels/FavoriteColorsManager';
import { CollapsibleGroup } from './ui/CollapsibleGroup';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { useT, useLangStore } from './i18n/i18n';

export default function App() {
  const init = useStore((s) => s.init);
  const loaded = useStore((s) => s.loaded);
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const planTool = useStore((s) => s.planTool);
  const draftRoom = useStore((s) => s.draftRoom);
  const startDraftRoom = useStore((s) => s.startDraftRoom);
  const cancelDraftRoom = useStore((s) => s.cancelDraftRoom);
  const commitDraftRoom = useStore((s) => s.commitDraftRoom);
  const height = useStore((s) => s.draftHeightCm);
  const setHeight = useStore((s) => s.setDraftHeight);
  const addBox = useStore((s) => s.addBox);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const exportProject = useStore((s) => s.exportProject);
  const importProject = useStore((s) => s.importProject);
  const editingSurfaceId = useStore((s) => s.editingSurfaceId);
  const favoritePicker = useStore((s) => s.favoritePicker);
  const rooms = useStore((s) => s.project.rooms);
  const importInput = useRef<HTMLInputElement | null>(null);
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    document.title = t('app.title');
    document.documentElement.lang = lang;
  }, [t, lang]);

  if (!loaded) return <div className="loading">{t('app.loading')}</div>;

  const finishRoom = () => commitDraftRoom();

  return (
    <div className="app">
      <header className="toolbar">
        <div className="tabs">
          <button className={viewMode === 'plan' ? 'active' : ''} onClick={() => setViewMode('plan')}>
            {t('app.tab.plan')}
          </button>
          <button className={viewMode === '3d' ? 'active' : ''} onClick={() => setViewMode('3d')}>
            {t('app.tab.3d')}
          </button>
        </div>

        <div className="spacer" />

        {viewMode === 'plan' && planTool !== 'draw-room' && (
          <button onClick={startDraftRoom}>{t('app.drawRoom')}</button>
        )}
        {planTool === 'draw-room' && (
          <div className="draw-controls">
            <span className="muted">{t('app.draw.points', { n: draftRoom?.length ?? 0 })}</span>
            <label>{t('app.height')}</label>
            <input type="number" value={height} style={{ width: 64 }} onChange={(e) => setHeight(+e.target.value)} />
            <span className="muted">{t('app.cm')}</span>
            <button className="primary" disabled={(draftRoom?.length ?? 0) < 3} onClick={finishRoom}>
              {t('app.done')}
            </button>
            <button onClick={cancelDraftRoom}>{t('app.cancel')}</button>
          </div>
        )}

        <button disabled={rooms.length === 0} onClick={addBox}>
          {t('app.addBox')}
        </button>
        <button onClick={undo} title={t('app.undo')}>↶</button>
        <button onClick={redo} title={t('app.redo')}>↷</button>
        <button onClick={() => exportProject()} title={t('app.exportTitle')}>{t('app.export')}</button>
        <button onClick={() => importInput.current?.click()} title={t('app.importTitle')}>{t('app.import')}</button>
        <button
          className="lang-toggle"
          title={t('app.langTitle')}
          onClick={() => setLang(lang === 'hu' ? 'en' : 'hu')}
        >
          {lang === 'hu' ? 'EN' : 'HU'}
        </button>
        <input
          ref={importInput}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              await importProject(file);
            } catch (err) {
              alert(t('app.importFailed', { msg: (err as Error).message }));
            }
          }}
        />
      </header>

      <div className="main">
        <aside className="sidebar">
          <CollapsibleGroup title={t('group.rooms')}>
            <RoomsPanel />
          </CollapsibleGroup>
          <CollapsibleGroup title={t('group.surfaces')} defaultOpen={false}>
            <SurfacesPanel />
          </CollapsibleGroup>
          <CollapsibleGroup title={t('group.tiles')}>
            <TileLibraryPanel />
          </CollapsibleGroup>
          <CollapsibleGroup title={t('group.objects')} defaultOpen={false}>
            <ObjectsPanel />
          </CollapsibleGroup>
          <CollapsibleGroup title={t('group.materials')} defaultOpen={false}>
            <MaterialPanel />
          </CollapsibleGroup>
        </aside>
        <main className="viewport">
          <ErrorBoundary>{viewMode === 'plan' ? <PlanView /> : <View3D />}</ErrorBoundary>
          <div className="hint">{viewMode === 'plan' ? t('app.hint.plan') : t('app.hint.3d')}</div>
          <BoxInspector />
          <ObjectInspector />
        </main>
      </div>

      {editingSurfaceId && <SurfaceEditor />}
      {favoritePicker && <FavoriteColorsManager />}
    </div>
  );
}
