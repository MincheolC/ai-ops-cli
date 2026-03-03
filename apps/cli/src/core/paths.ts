import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// src/core/* 또는 dist/bin/index.js 기준에서도 공통으로 패키지 루트/data를 가리키도록 계산
// src/core/paths.ts → ../../data = apps/cli/data
// dist/bin/index.js (bundle) → ../../data = apps/cli/data
const __dirname = dirname(fileURLToPath(import.meta.url));

export const COMPILER_DATA_DIR = resolve(__dirname, '..', '..', 'data');
