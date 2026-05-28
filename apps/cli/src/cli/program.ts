import { Command } from 'commander';
import { registerCodexHookCommands } from '@/features/codex-hooks/register.js';
import { registerCodexPermissionsCommands } from '@/features/codex-permissions/register.js';
import { registerContextPromotionCommands } from '@/features/context-promotion/register.js';
import { registerIntegrationCommands } from '@/features/integrations/register.js';
import { registerPcCommands } from '@/features/pc/register.js';
import { registerProjectLayerCommands } from '@/features/project-layer/register.js';
import { registerSkillCommands } from '@/features/skills/register.js';
import { registerStudioCommands } from '@/features/studio/register.js';
import { registerSubagentCommands } from '@/features/subagents/register.js';
import { getCliVersion } from '@/shared/source-hash.js';

export const createProgram = (): Command => {
  const program = new Command();

  program.name('ai-ops').description('AI agent operating layer manager').version(getCliVersion());

  registerProjectLayerCommands(program);
  registerStudioCommands(program);
  registerSkillCommands(program);
  registerSubagentCommands(program);
  registerContextPromotionCommands(program);
  registerPcCommands(program);
  registerCodexHookCommands(program);
  registerCodexPermissionsCommands(program);
  registerIntegrationCommands(program);

  return program;
};
