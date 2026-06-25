import { PatternKind } from '../model/types';

export interface Size {
  w: number;
  h: number;
}

/**
 * Egy lerakott csempe a felület u,v terében (cm).
 * A generátorok ABUTÁLÓ csempéket adnak (fuga nélkül); a fuga-hézagot a renderer
 * teszi hozzá úgy, hogy minden csempét grout/2-vel beljebb rajzol. Így a fuga
 * egységesen kezelhető minden mintára (a herringbone lattice is abutáló marad).
 */
export interface TilePlacement {
  cellId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotationDeg: number;
}

export interface PatternContext {
  /** Az alap csempe mérete cm-ben. */
  tile: Size;
  /** Generátor-specifikus paraméterek. */
  params: Record<string, number>;
  /** Origó eltolás cm-ben. */
  originOffset: { x: number; y: number };
}

export interface PatternGenerator {
  name: PatternKind;
  /** Emberi címke az UI-hoz. */
  label: string;
  /** Paraméter-leírások az UI-hoz (kulcs → {label, default, min, max, step}). */
  paramSpec: Record<string, { label: string; def: number; min: number; max: number; step: number }>;
  /** A befoglaló méretet (cm) kitölti csempékkel. */
  generate(bounds: Size, ctx: PatternContext): TilePlacement[];
}
