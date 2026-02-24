/**
 * Manifest = 설치 추적 메타데이터. CLI가 이전 설치 상태를 기억하기 위한 JSON.
 */
import { z } from 'zod';

export const SCOPES = {
  PROJECT: 'project',
  GLOBAL: 'global',
} as const;

export const ManifestSchema = z
  .object({
    profile: z.string().min(1),
    scope: z.enum(['project', 'global']),
    include_rules: z.array(z.string().min(1)),
    /** SSOT 데이터 파일들의 deterministic SHA-256 해시 (6자리 hex). diff/update 판단 기준 */
    sourceHash: z.string().regex(/^[a-f0-9]{6}$/, 'sourceHash must be 6 lowercase hex chars'),
    generatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type Manifest = z.infer<typeof ManifestSchema>;
