import * as p from '@clack/prompts';
import {
  installProjectLayer,
  resolveProjectLayerTools,
  type ProjectLayerTool,
} from '@/core/index.js';
import { resolveBasePath } from '../lib/paths.js';
import { reportInvalidProjectLayerManifest } from './project-layer-errors.js';

type InitCommandOptions = {
  tool?: string[];
};

const TOOL_OPTIONS = [
  { value: 'codex' as ProjectLayerTool, label: 'Codex' },
  { value: 'gemini' as ProjectLayerTool, label: 'Gemini CLI' },
  { value: 'claude-code' as ProjectLayerTool, label: 'Claude Code' },
];

const promptTools = async (): Promise<ProjectLayerTool[] | null> => {
  const selectedTools = await p.multiselect<ProjectLayerTool>({
    message: 'AI 도구 adapter를 선택하세요',
    options: TOOL_OPTIONS,
    initialValues: TOOL_OPTIONS.map((option) => option.value),
    required: true,
  });

  return p.isCancel(selectedTools) ? null : resolveProjectLayerTools(selectedTools);
};

export const initCommand = async (opts: InitCommandOptions = {}): Promise<void> => {
  p.intro('ai-ops init');

  const tools = opts.tool && opts.tool.length > 0 ? resolveProjectLayerTools(opts.tool) : await promptTools();
  if (tools === null) {
    p.cancel('취소됨');
    process.exit(0);
  }

  let result: ReturnType<typeof installProjectLayer>;
  try {
    result = installProjectLayer({
      basePath: resolveBasePath(),
      tools,
    });
  } catch (error) {
    reportInvalidProjectLayerManifest({ error, outro: 'ai-ops init 실패' });
    return;
  }

  p.log.success(`project operating layer 설치 완료: ${result.manifest.managed_files.length + result.manifest.project_files.length}개 파일`);
  p.log.info(`도구 adapter: ${result.manifest.tools.join(', ')}`);
  if (result.appended.length > 0) {
    p.log.info(`기존 파일에 managed section 추가:\n${result.appended.map((file) => `  ${file}`).join('\n')}`);
  }
  if (result.refreshedProjectFiles.length > 0) {
    p.log.info(`unmodified project-owned 파일 갱신:\n${result.refreshedProjectFiles.map((file) => `  ${file}`).join('\n')}`);
  }
  if (result.preservedProjectFiles.length > 0) {
    p.log.info(`기존 project-owned 파일 보존:\n${result.preservedProjectFiles.map((file) => `  ${file}`).join('\n')}`);
  }

  p.outro('ai-ops init 완료');
};
