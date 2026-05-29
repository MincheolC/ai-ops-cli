import * as p from '@clack/prompts';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { InstalledSkill, Skill } from '@/core/schemas/index.js';
import {
  buildContextPromotionHookCommand,
  CONTEXT_PROMOTION_HOOK_ID,
  inspectContextPromotionHook,
  installContextPromotionHook,
  resolveCodexHooksPath,
  uninstallContextPromotionHook,
} from './core.js';
import { SKILL_TOOL } from '@/core/schemas/index.js';
import { loadAllSkills } from '@/shared/catalog-loader.js';
import { getCliVersion } from '@/shared/source-hash.js';
import { buildSkillInstallPlan } from '../skills/renderer.js';
import { readSkillRegistry, resolveCanonicalSkillId, resolveSkillRegistryPath, writeSkillRegistry } from '../skills/registry-io.js';
import { installSkillPackages } from '../skills/install-files.js';
import { findInstalledSkill, mergeSkillTools, upsertInstalledSkill } from '../skills/state.js';
import { resolveSkillsDir, resolveUserBasePath } from '../../shared/command-paths.js';

type CodexHookInstallOptions = {
  command?: string;
};

const CONTEXT_PROMOTION_REVIEW_SKILL_ID = 'context-promotion-review';

const resolveCodexHomePath = (): string => {
  const codexHome = process.env.CODEX_HOME;
  if (codexHome && codexHome.length > 0) {
    return codexHome;
  }
  const home = process.env.HOME;
  if (!home) {
    throw new Error('CODEX_HOME or HOME is required for Codex hook commands');
  }
  return `${home}/.codex`;
};

const assertContextPromotionHookId = (hookId: string): void => {
  if (hookId !== CONTEXT_PROMOTION_HOOK_ID) {
    throw new Error(`Unknown Codex hook: ${hookId}`);
  }
};

const reportCodexHookError = (error: unknown): void => {
  const message = error instanceof Error ? error.message : 'unknown error';
  p.log.error(message);
  process.exitCode = 1;
};

const readInstalledSkills = (basePath: string): InstalledSkill[] =>
  (readSkillRegistry(resolveSkillRegistryPath(basePath))?.skills ?? []).map((installedSkill) => ({
    ...installedSkill,
    id: resolveCanonicalSkillId(installedSkill.id),
  }));

const resolveContextPromotionReviewSkill = (): Skill => {
  const skill = loadAllSkills(resolveSkillsDir()).find(
    (candidate) => candidate.id === CONTEXT_PROMOTION_REVIEW_SKILL_ID,
  );
  if (!skill) {
    throw new Error(`Unknown skill: ${CONTEXT_PROMOTION_REVIEW_SKILL_ID}`);
  }
  return skill;
};

const hasInstalledContextPromotionReviewSkill = (basePath: string): boolean => {
  const installedSkill = findInstalledSkill(readInstalledSkills(basePath), CONTEXT_PROMOTION_REVIEW_SKILL_ID);
  return (
    installedSkill?.tools.includes(SKILL_TOOL.CODEX) === true &&
    existsSync(join(basePath, '.agents/skills/context-promotion-review/SKILL.md'))
  );
};

const ensureContextPromotionReviewSkill = (basePath: string): { changed: boolean; installedSkill: InstalledSkill } => {
  const skill = resolveContextPromotionReviewSkill();
  const installedSkills = readInstalledSkills(basePath);
  const existingInstalledSkill = findInstalledSkill(installedSkills, skill.id);
  const requestedTools = mergeSkillTools({
    existing: existingInstalledSkill?.tools,
    requested: [SKILL_TOOL.CODEX],
  });
  const { packages, installedSkill } = buildSkillInstallPlan({
    skill,
    requestedTools,
  });
  const alreadyInstalled =
    existingInstalledSkill?.sourceHash === installedSkill.sourceHash &&
    existingInstalledSkill.tools.includes(SKILL_TOOL.CODEX) &&
    existsSync(join(basePath, '.agents/skills/context-promotion-review/SKILL.md'));

  if (alreadyInstalled) {
    return { changed: false, installedSkill };
  }

  installSkillPackages(basePath, packages);
  writeSkillRegistry(resolveSkillRegistryPath(basePath), {
    skills: upsertInstalledSkill(installedSkills, installedSkill),
    cliVersion: getCliVersion(),
    generatedAt: new Date().toISOString(),
  });

  return { changed: true, installedSkill };
};

export const codexHookInstallCommand = async (
  hookId: string,
  opts: CodexHookInstallOptions = {},
): Promise<void> => {
  p.intro(`ai-ops codex-hook install ${hookId}`);
  try {
    assertContextPromotionHookId(hookId);
    const skillResult = ensureContextPromotionReviewSkill(resolveUserBasePath());
    const hooksPath = resolveCodexHooksPath(resolveCodexHomePath());
    const result = installContextPromotionHook({
      hooksPath,
      command: buildContextPromotionHookCommand(opts.command),
    });
    p.log.success(
      skillResult.changed
        ? `skill 설치 완료: ${skillResult.installedSkill.id}`
        : `skill 이미 설치됨: ${skillResult.installedSkill.id}`,
    );
    p.log.success(result.changed ? `hook 설치 완료: ${result.hooksPath}` : `hook 이미 설치됨: ${result.hooksPath}`);
  } catch (error) {
    reportCodexHookError(error);
  }
  p.outro('ai-ops codex-hook install 완료');
};

export const codexHookStatusCommand = async (hookId: string): Promise<void> => {
  p.intro(`ai-ops codex-hook status ${hookId}`);
  try {
    assertContextPromotionHookId(hookId);
    const result = inspectContextPromotionHook(resolveCodexHooksPath(resolveCodexHomePath()));
    const skillInstalled = hasInstalledContextPromotionReviewSkill(resolveUserBasePath());
    p.log.info(
      [
        `hooks file: ${result.hooksPath}`,
        `hook installed: ${result.installed ? 'yes' : 'no'}`,
        `skill installed: ${skillInstalled ? 'yes' : 'no'}`,
      ].join('\n'),
    );
  } catch (error) {
    reportCodexHookError(error);
  }
  p.outro('ai-ops codex-hook status 완료');
};

export const codexHookUninstallCommand = async (hookId: string): Promise<void> => {
  p.intro(`ai-ops codex-hook uninstall ${hookId}`);
  try {
    assertContextPromotionHookId(hookId);
    const result = uninstallContextPromotionHook(resolveCodexHooksPath(resolveCodexHomePath()));
    p.log.success(result.removed ? `hook 제거 완료: ${result.hooksPath}` : `설치된 hook 없음: ${result.hooksPath}`);
  } catch (error) {
    reportCodexHookError(error);
  }
  p.outro('ai-ops codex-hook uninstall 완료');
};
