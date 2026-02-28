import { join } from 'node:path';
import { TOOL_OUTPUT_MAP } from './tool-output.js';
import type { Manifest } from './schemas/index.js';

/**
 * manifest에 installed_files가 없는 구버전 manifest를 위한 fallback.
 * manifest의 tools/workspaces/installed_rules 정보를 기반으로
 * 실제 설치됐을 파일 경로를 역산한다.
 */
export const inferInstalledFiles = (manifest: Manifest): string[] => {
  const files: string[] = [];
  const isMonorepo = manifest.workspaces !== undefined;

  for (const toolId of manifest.tools) {
    if (toolId === 'claude-code') {
      // claude-code: .claude/rules/{ruleId}.md
      const config = TOOL_OUTPUT_MAP['claude-code'];
      for (const ruleId of manifest.installed_rules) {
        files.push(join(config.rulesDir, `${ruleId}${config.fileExtension}`));
      }
    } else if (toolId === 'codex') {
      const config = TOOL_OUTPUT_MAP['codex'];
      if (!isMonorepo) {
        // 비모노: .codex/AGENTS.md + .codex/AGENTS.override.md (domain 있으면)
        files.push(join(config.dir, config.rootFileName));
        files.push(join(config.dir, config.domainFileName));
      } else {
        // 모노: .codex/AGENTS.md (global) + {workspace}/AGENTS.override.md (domain)
        files.push(join(config.dir, config.rootFileName));
        for (const ws of Object.keys(manifest.workspaces ?? {})) {
          files.push(join(ws, config.domainFileName));
        }
      }
    } else if (toolId === 'gemini') {
      const config = TOOL_OUTPUT_MAP['gemini'];
      if (!isMonorepo) {
        // 비모노: .gemini/GEMINI.md
        files.push(join(config.dir, config.rootFileName));
      } else {
        // 모노: .gemini/GEMINI.md (global) + {workspace}/GEMINI.md (domain)
        files.push(join(config.dir, config.rootFileName));
        for (const ws of Object.keys(manifest.workspaces ?? {})) {
          files.push(join(ws, config.domainFileName));
        }
      }
    }
  }

  // 중복 제거 (codex 비모노에서 rootFileName === domainFileName인 경우 대비)
  return [...new Set(files)];
};
