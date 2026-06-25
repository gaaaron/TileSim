import { useEffect, useState } from 'react';
import { useStore } from './store/projectStore';
import { PlanView } from './views/PlanView';
import { View3D } from './views/View3D';
import { SurfaceEditor } from './views/SurfaceEditor';
import { TileLibraryPanel } from './panels/TileLibraryPanel';
import { RoomsPanel } from './panels/RoomsPanel';
import { BoxInspector } from './panels/BoxInspector';

export default function App() {
  const init = useStore((s) => s.init);
  const loaded = useStore((s) => s.loaded);
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const planTool = useStore((s) => s.planTool);
  const draftRoom = useStore((s) => s.draftRoom);
  const startDraftRoom = useStore((s) => s.startDraftRoom);
  const cancelDraftRoom = useStore((s) => s.cancelDraftRoom);
  const addRoom = useStore((s) => s.addRoom);
  const addBox = useStore((s) => s.addBox);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const editingSurfaceId = useStore((s) => s.editingSurfaceId);
  const rooms = useStore((s) => s.project.rooms);

  const [height, setHeight] = useState(270);

  useEffect(() => {
    init();
  }, [init]);

  if (!loaded) return <div className="loading">Betöltés…</div>;

  const finishRoom = () => {
    if (draftRoom && draftRoom.length >= 3) {
      addRoom(draftRoom, height);
    }
    cancelDraftRoom();
  };

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
            <span className="muted">{draftRoom?.length ?? 0} pont — kattints az alaprajzon</span>
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
      </header>

      <div className="main">
        <aside className="sidebar">
          <RoomsPanel />
          <TileLibraryPanel />
        </aside>
        <main className="viewport">
          {viewMode === 'plan' ? <PlanView /> : <View3D />}
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
