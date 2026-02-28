import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// dist/index.js 위치 기준 → 상위(패키지 루트) → data/
// src/에서 실행 시: src/../data = data/ ✅
// dist/에서 실행 시: dist/../data = data/ ✅
const __dirname = dirname(fileURLToPath(import.meta.url));

export const COMPILER_DATA_DIR = resolve(__dirname, '..', 'data');
