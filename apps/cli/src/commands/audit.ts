import * as p from '@clack/prompts';
import { auditProjectLayer } from '@/core/index.js';
import { resolveBasePath } from '../lib/paths.js';

export const auditCommand = async (): Promise<void> => {
  p.intro('ai-ops audit');

  const report = auditProjectLayer(resolveBasePath());
  if (report.issues.length === 0) {
    p.log.success('audit 통과. manifest, context-layer, frontmatter, docs-status가 일치합니다.');
    p.outro('ai-ops audit 완료');
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

  p.outro('ai-ops audit 완료');
};
