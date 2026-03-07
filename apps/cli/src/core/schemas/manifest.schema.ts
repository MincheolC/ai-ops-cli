/**
 * Manifest = 설치 추적 메타데이터. CLI가 이전 설치 상태를 기억하기 위한 JSON.
 */
import { z } from 'zod';

export const SCOPES = {
  PROJECT: 'project',
} as const;

/** init/update 시 선택된 settings 항목 추적 */
const SettingsConfigSchema = z
  .object({
    claude: z.array(z.string().min(1)).optional(),
    gemini: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type SettingsConfig = z.infer<typeof SettingsConfigSchema>;

/** 모노레포 워크스페이스별 preset + rules 추적 */
const WorkspaceEntrySchema = z
  .object({
    preset: z.string().min(1),
    rules: z.array(z.string().min(1)),
  })
  .strict();

export type WorkspaceEntry = z.infer<typeof WorkspaceEntrySchema>;

export const ManifestSchema = z
  .object({
    tools: z.array(z.string().min(1)).min(1),
    scope: z.literal('project'),
    /** 비모노레포 단일 preset */
    preset: z.string().min(1).optional(),
    /** 모노레포: workspace path → { preset, rules } */
    workspaces: z.record(z.string(), WorkspaceEntrySchema).optional(),
    installed_rules: z.array(z.string().min(1)),
    /** 실제 디스크에 쓰여진 파일 상대 경로 목록 (uninstall용). 기존 manifest 호환성 위해 optional */
    installed_files: z.array(z.string().min(1)).optional(),
    /** non-managed 파일에 섹션을 append한 경우 추적 (uninstall 시 섹션만 제거) */
    appended_files: z.array(z.string().min(1)).optional(),
    /** init 시 선택된 settings 항목 — update 시 재생성에 사용 */
    settings: SettingsConfigSchema.optional(),
    /** SSOT 데이터 파일들의 deterministic SHA-256 해시 (6자리 hex). diff/update 판단 기준 */
    sourceHash: z.string().regex(/^[a-f0-9]{6}$/, 'sourceHash must be 6 lowercase hex chars'),
    generatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type Manifest = z.infer<typeof ManifestSchema>;
