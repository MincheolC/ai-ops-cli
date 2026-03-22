import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import * as p from '@clack/prompts';
import { buildSpecInitPlan } from '@/core/index.js';

export const specInitCommand = async (opts: { force: boolean }): Promise<void> => {
  p.intro('ai-ops spec init');

  const specsDir = join(process.cwd(), 'specs');

  if (existsSync(specsDir) && !opts.force) {
    p.log.error('specs/ 디렉토리가 이미 존재합니다. 덮어쓰려면 --force 옵션을 사용하세요.');
    process.exit(1);
  }

  const actions = buildSpecInitPlan();

  for (const action of actions) {
    const dest = join(process.cwd(), action.relativePath);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, action.content, 'utf-8');
    p.log.success(`생성: ${action.relativePath}`);
  }

  p.outro('ai-ops spec init 완료');
};
