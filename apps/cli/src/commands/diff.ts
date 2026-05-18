import * as p from '@clack/prompts';
import { diffProjectLayer } from '@/core/index.js';
import { resolveBasePath } from '../lib/paths.js';

export const diffCommand = async (): Promise<void> => {
  p.intro('ai-ops diff');

  const report = diffProjectLayer(resolveBasePath());
  if (report.issues.length === 0) {
    p.log.success('변경 사항 없음. 최신 상태입니다.');
    p.outro('ai-ops diff 완료');
    return;
  }

  for (const item of report.issues) {
    const line = `[${item.code}] ${item.message}`;
    if (item.level === 'error') {
      p.log.error(line);
    } else {
      p.log.warn(line);
    }
  }

  if (report.issues.some((item) => item.level === 'error')) {
    process.exitCode = 1;
  }

  p.outro('ai-ops diff 완료');
};
