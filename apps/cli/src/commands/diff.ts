import * as p from '@clack/prompts';
import {
  readManifest,
  resolveManifestPath,
  computeSourceHash,
  computeDiff,
  loadAllRules,
  loadAllSkills,
  loadPresets,
  buildSkillInstallPlan,
  resolveManifestProjectSkills,
  resolveManifestRules,
} from '@/core/index.js';
import { resolveBasePath, resolveCompilerDataDir, resolvePresetsPath, resolveRulesDir, resolveSkillsDir } from '../lib/paths.js';

export const diffCommand = async (): Promise<void> => {
  const basePath = resolveBasePath();

  p.intro('ai-ops diff');

  const manifest = readManifest(resolveManifestPath(basePath));
  if (!manifest) {
    p.log.error('manifest가 없습니다. 먼저 ai-ops init을 실행하세요.');
    process.exit(1);
  }

  const sourceHash = computeSourceHash(resolveCompilerDataDir());
  const allRules = loadAllRules(resolveRulesDir());
  const allSkills = loadAllSkills(resolveSkillsDir());
  const presets = loadPresets(resolvePresetsPath());
  const resolvedRules = resolveManifestRules({
    manifest,
    allRules,
    presets,
  });
  const resolvedSkills = resolveManifestProjectSkills({
    manifest,
    allSkills,
  });

  const result = computeDiff({
    previous: manifest,
    currentRules: resolvedRules.installedRules.map((rule) => rule.id),
    currentSourceHash: sourceHash,
  });

  const skillLines = resolvedSkills.map(({ skill, requestedTools }) => {
    const { installedSkill: next } = buildSkillInstallPlan({
      skill,
      requestedTools,
      scope: 'project',
    });
    const previous = (manifest.installed_skills ?? []).find((installedSkill) => installedSkill.id === skill.id);
    const previousHash = previous?.sourceHash ?? 'legacy';
    const changed = previousHash !== next.sourceHash;

    return `- ${skill.id}: ${changed ? 'changed' : 'up-to-date'} (${previousHash} -> ${next.sourceHash})`;
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

  if (skillLines.length > 0) {
    p.log.info(`project skills:\n${skillLines.map((line) => `  ${line}`).join('\n')}`);
  }

  p.outro('ai-ops diff 완료');
};
