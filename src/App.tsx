import { useEffect, useRef } from 'react';
import { useStore } from './store/projectStore';
import { PlanView } from './views/PlanView';
import { View3D } from './views/View3D';
import { SurfaceEditor } from './views/SurfaceEditor';
import { TileLibraryPanel } from './panels/TileLibraryPanel';
import { RoomsPanel } from './panels/RoomsPanel';
import { SurfacesPanel } from './panels/SurfacesPanel';
import { BoxInspector } from './panels/BoxInspector';
import { CollapsibleGroup } from './ui/CollapsibleGroup';
import { ErrorBoundary } from './ui/ErrorBoundary';

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
  const rooms = useStore((s) => s.project.rooms);
  const importInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    init();
  }, [init]);

  if (!loaded) return <div className="loading">Betöltés…</div>;

  const finishRoom = () => commitDraftRoom();

  return (
    <div className="app">
      <header className="toolbar">
        <div className="tabs">
          <button className={viewMode === 'plan' ? 'active' : ''} onClick={() => setViewMode('plan')}>
            Alaprajz
          </button>
          <button className={viewMode === '3d' ? 'active' : ''} onClick={() => setViewMode('3d')}>
            3D nézet
          </button>
        </div>

        <div className="spacer" />

        {viewMode === 'plan' && planTool !== 'draw-room' && (
          <button onClick={startDraftRoom}>+ Szoba rajzolása</button>
        )}
        {planTool === 'draw-room' && (
          <div className="draw-controls">
            <span className="muted">
              {draftRoom?.length ?? 0} pont — húzd a falakat (Shift = egyenes), a kezdőpontra kattintva záródik
            </span>
            <label>Magasság</label>
            <input type="number" value={height} style={{ width: 64 }} onChange={(e) => setHeight(+e.target.value)} />
            <span className="muted">cm</span>
            <button className="primary" disabled={(draftRoom?.length ?? 0) < 3} onClick={finishRoom}>
              Kész
            </button>
            <button onClick={cancelDraftRoom}>Mégse</button>
          </div>
        )}

        <button disabled={rooms.length === 0} onClick={addBox}>
          + Doboz
        </button>
        <button onClick={undo} title="Visszavonás">↶</button>
        <button onClick={redo} title="Újra">↷</button>
        <button onClick={() => exportProject()} title="Projekt exportálása (a textúrákkal)">⭳ Export</button>
        <button onClick={() => importInput.current?.click()} title="Projekt importálása">⭱ Import</button>
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
              alert('Importálás sikertelen: ' + (err as Error).message);
            }
          }}
        />
      </header>

      <div className="main">
        <aside className="sidebar">
          <CollapsibleGroup title="Szobák">
            <RoomsPanel />
          </CollapsibleGroup>
          <CollapsibleGroup title="Oldalak" defaultOpen={false}>
            <SurfacesPanel />
          </CollapsibleGroup>
          <CollapsibleGroup title="Csempék">
            <TileLibraryPanel />
          </CollapsibleGroup>
        </aside>
        <main className="viewport">
          <ErrorBoundary>{viewMode === 'plan' ? <PlanView /> : <View3D />}</ErrorBoundary>
          <div className="hint">
            {viewMode === 'plan'
              ? 'Tipp: dobozokat húzással mozgathatsz. Dupla katt egy felületre = szerkesztés.'
              : 'Tipp: forgatás bal egér, dupla katt egy falra/padlóra/oldalra = csempe-szerkesztő.'}
          </div>
          <BoxInspector />
        </main>
      </div>

      {editingSurfaceId && <SurfaceEditor />}
    </div>
  );
}
