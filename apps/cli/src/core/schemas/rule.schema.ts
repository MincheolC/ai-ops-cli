/**
 * Rule = SSOT의 최소 지식 단위. 하나의 코딩 컨벤션/아키텍처 규칙을 YAML로 구조화한 것.
 */
import { z } from 'zod';

export const DecisionTableEntrySchema = z
  .object({
    when: z.string().min(1),
    then: z.string().min(1),
    /** 조건부 규칙에서 회피해야 할 패턴 */
    avoid: z.string().min(1).optional(),
  })
  .strict();

export const RuleContentSchema = z
  .object({
    /** Anti-pattern 규칙 ('하지 마라'). guidelines보다 항상 상단 렌더링 */
    constraints: z.array(z.string().min(1)),
    /** Positive 규칙 ('해라') */
    guidelines: z.array(z.string().min(1)),
    /** 조건부 규칙. when→then→avoid 구조 */
    decision_table: z.array(DecisionTableEntrySchema).optional(),
  })
  .strict();

export const RuleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id must be kebab-case'),
    category: z.string().min(1),
    tags: z.array(z.string().min(1)),
    /** 0-100. 높을수록 생성 파일 상단 배치 (U-shaped attention 최적화) */
    priority: z.number().int().min(0).max(100),
    content: RuleContentSchema,
  })
  .strict();

export type DecisionTableEntry = z.infer<typeof DecisionTableEntrySchema>;
export type RuleContent = z.infer<typeof RuleContentSchema>;
export type Rule = z.infer<typeof RuleSchema>;
