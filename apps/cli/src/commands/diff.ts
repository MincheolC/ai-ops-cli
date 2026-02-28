import * as p from '@clack/prompts';
import { readManifest, resolveManifestPath, computeSourceHash, computeDiff } from '@ai-ops/compiler';
import type { Scope } from '../lib/paths.js';
import { resolveBasePath, resolveRulesDir } from '../lib/paths.js';

export const diffCommand = async (opts: { scope: Scope }): Promise<void> => {
  const basePath = resolveBasePath(opts.scope);

  p.intro('ai-ops diff');

  const manifest = readManifest(resolveManifestPath(basePath));
  if (!manifest) {
    p.log.error('manifest가 없습니다. 먼저 ai-ops init을 실행하세요.');
    process.exit(1);
  }

  const sourceHash = computeSourceHash(resolveRulesDir());

  const result = computeDiff({
    previous: manifest,
    currentRules: manifest.installed_rules,
    currentSourceHash: sourceHash,
  });

  if (result.status === 'up-to-date') {
    p.log.success('변경 사항 없음. 최신 상태입니다.');
  } else {
    if (result.sourceChanged) {
      p.log.warn(`소스 변경 감지: ${manifest.sourceHash} → ${sourceHash}`);
    }
    if (result.added.length > 0) {
      p.log.info(`추가된 규칙: ${result.added.join(', ')}`);
    }
    if (result.removed.length > 0) {
      p.log.info(`제거된 규칙: ${result.removed.join(', ')}`);
    }
  }

  p.outro('ai-ops diff 완료');
};
