import { PatternKind } from '../model/types';
import { gridGenerator } from './grid';
import { herringboneGenerator } from './herringbone';
import { offsetGenerator } from './offset';
import { PatternGenerator } from './types';

const generators: Record<PatternKind, PatternGenerator> = {
  grid: gridGenerator,
  offset: offsetGenerator,
  herringbone: herringboneGenerator,
};

export function getGenerator(kind: PatternKind): PatternGenerator {
  return generators[kind] ?? gridGenerator;
}

export function allGenerators(): PatternGenerator[] {
  return Object.values(generators);
}
