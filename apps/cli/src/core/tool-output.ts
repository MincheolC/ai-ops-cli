// Global 성격의 category (항상 로딩, frontmatter 없음)
export const GLOBAL_CATEGORIES = ['persona', 'communication', 'philosophy', 'convention', 'standard'] as const;

// Claude Code paths: frontmatter용 Rule ID → glob 매핑
// src/ 없이 루트를 src처럼 쓰는 React/Next.js 프로젝트 고려
// 매핑에 없는 domain 룰 → frontmatter 없이 항상 로딩 (안전 fallback)
export const CLAUDE_CODE_PATH_GLOBS: Readonly<Record<string, readonly string[]>> = {
  typescript: ['**/*.ts', '**/*.tsx'],
  'react-typescript': ['**/*.tsx', '**/*.jsx'],
  nextjs: ['**/app/**', 'next.config.*', '**/middleware.ts'],
  nestjs: ['**/*.module.ts', '**/*.controller.ts', '**/*.service.ts'],
  'nestjs-graphql': ['**/*.resolver.ts'],
  graphql: ['**/*.graphql', '**/*.gql'],
  'prisma-postgresql': ['prisma/**', '**/*.prisma'],
  'shadcn-ui': ['**/components/ui/**'],
  flutter: ['lib/**/*.dart'],
  python: ['**/*.py'],
  fastapi: ['**/routers/**', '**/main.py'],
  sqlalchemy: ['**/models/**/*.py', 'alembic/**'],
  'data-pipeline-python': ['**/pipelines/**', '**/etl/**'],
  'ai-llm-python': ['**/agents/**', '**/chains/**'],
  'libs-frontend-web': ['**/*.tsx', '**/*.ts'],
  'libs-frontend-app': ['lib/**/*.dart'],
  'libs-backend-ts': ['**/*.ts'],
  'libs-backend-python': ['**/*.py'],
};

export const TOOL_OUTPUT_MAP = {
  'claude-code': {
    mode: 'multi-file' as const,
    rulesDir: '.claude/rules',
    fileExtension: '.md',
    // single: path-scoped (paths: frontmatter) / monorepo: hierarchical ({workspace}/CLAUDE.md)
    contextStrategy: 'hybrid' as const,
  },
  codex: {
    mode: 'multi-file' as const,
    dir: '',
    rootFileName: 'AGENTS.md', // global 룰
    domainFileName: 'AGENTS.override.md', // domain 룰 (하위 폴더)
    contextStrategy: 'hierarchical' as const, // 루트 + 하위 폴더 JIT
  },
  gemini: {
    mode: 'multi-file' as const,
    dir: '.gemini',
    rootFileName: 'GEMINI.md', // global 룰
    domainFileName: 'GEMINI.md', // domain 룰 (하위 폴더)
    contextStrategy: 'hierarchical' as const, // 루트 + 하위 폴더 JIT
  },
} as const;

export type ToolId = keyof typeof TOOL_OUTPUT_MAP;
