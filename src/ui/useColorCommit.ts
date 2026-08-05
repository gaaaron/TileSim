import { useEffect, useRef } from 'react';
import { useStore } from '../store/projectStore';

/**
 * Egy színválasztó folyamatos `onChange`-ét EGY undo-lépéssé fogja össze, és `requestAnimationFrame`-mel
 * ritkítja a store-frissítést (frame-enként legfeljebb egyszer) — így húzás/keverés közben nem duzzad a
 * history és nincs újrarajzolás minden apró változásnál.
 *
 * - `change(c)`: híváskor (első alkalommal) `beginDrag` (egy pillanatkép), majd a színt frame-enként commitolja.
 * - `end()`: a maradék szín kiírása + `endDrag` (a húzás lezárása). Hívd az input `onBlur`-jén.
 * A komponens unmountkor is lezár (nehogy a `suppressHistory` beragadjon, ha a popup bezárul húzás közben).
 */
export function useColorCommit(onChange: (color: string) => void) {
  const beginDrag = useStore((s) => s.beginDrag);
  const endDrag = useStore((s) => s.endDrag);
  const raf = useRef(0);
  const pending = useRef<string | null>(null);
  const active = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const flush = () => {
    raf.current = 0;
    if (pending.current != null) {
      onChangeRef.current(pending.current);
      pending.current = null;
    }
  };
  const change = (c: string) => {
    if (!active.current) {
      beginDrag();
      active.current = true;
    }
    pending.current = c;
    if (!raf.current) raf.current = requestAnimationFrame(flush);
  };
  const end = () => {
    if (raf.current) {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    }
    if (pending.current != null) {
      onChangeRef.current(pending.current);
      pending.current = null;
    }
    if (active.current) {
      endDrag();
      active.current = false;
    }
  };

  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      if (active.current) {
        endDrag();
        active.current = false;
      }
    },
    // csak unmountkor
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { change, end };
}
