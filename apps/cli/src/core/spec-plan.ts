import { SPEC_README_TEMPLATE } from '../data/spec-readme.js';
import type { FileAction } from './install-plan.js';

export const buildSpecInitPlan = (): readonly FileAction[] => [
  { relativePath: 'specs/README.md', content: SPEC_README_TEMPLATE },
  { relativePath: 'specs/baseline/.gitkeep', content: '' },
  { relativePath: 'specs/initial-build/.gitkeep', content: '' },
];
