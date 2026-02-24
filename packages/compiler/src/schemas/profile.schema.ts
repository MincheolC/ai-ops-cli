/**
 * Profile = AI 에이전트별 출력 설정. 어떤 규칙을 어떤 포맷/파일로 생성할지 정의.
 */
import { z } from 'zod';

export const OutputFileSchema = z
  .object({
    path: z.string().min(1),
    /** 단일 파일 내 포함할 섹션 목록 */
    sections: z.array(z.string().min(1)).optional(),
    /** 이 필드 기준으로 규칙을 별도 파일로 분할 (e.g., category별 .md 파일) */
    split_by: z.string().min(1).optional(),
  })
  .strict();

export const QualityGateSchema = z
  .object({
    enabled: z.boolean(),
    /** 생성 파일 하단에 삽입되는 self-check 체크리스트 */
    checklist: z.array(z.string().min(1)),
  })
  .strict();

export const ProfileSchema = z
  .object({
    id: z.string().min(1),
    output: z
      .object({
        format: z.enum(['markdown']),
        files: z.array(OutputFileSchema).min(1),
      })
      .strict(),
    include_rules: z.array(z.string().min(1)).min(1),
    quality_gate: QualityGateSchema.optional(),
  })
  .strict();

export type OutputFile = z.infer<typeof OutputFileSchema>;
export type QualityGate = z.infer<typeof QualityGateSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
