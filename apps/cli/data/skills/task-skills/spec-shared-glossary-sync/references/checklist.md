# Glossary Sync Checklist

Use this checklist before finalizing `01_glossary.md`.

## Look For

- one concept described with multiple Korean names
- one Korean term mapped to multiple English code names
- UI copy that conflicts with domain terms
- product docs and change docs using different names for the same thing
- states that appear in packets but were never defined centrally

## Prefer

- a table-first structure for most vocabulary
- one canonical project term per concept
- prefer Korean for user-facing/domain nouns, but keep standard English when that is clearer or already the stable norm
- one code-facing English name per canonical concept when possible
- short definitions that explain scope, not implementation
- explicit “do not use” wording for risky ambiguities
- detailed prose only for genuinely complex concepts

## 대표 예시

- 플랜 / 루틴 / 프로그램
- 운동 세션 / 운동 기록 / workout
- 세트 템플릿 / 세트 기록
- 저장 / 완료 / 확정
- 초안 / 진행 중 / 임시 저장

## Update Rule

- merge new terms into the existing glossary
- do not delete stable terms unless they are clearly wrong
- when uncertain, add the conflict to `정의 충돌 / 검토 필요`
- keep simple terms in tables; avoid turning the whole glossary into long prose
