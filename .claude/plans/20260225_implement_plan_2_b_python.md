# Phase 2-B-13~18: Python 생태계 Rule YAML 구현

## Context

Phase 2-B-10까지 15개 TS/Dart 중심 Rule YAML 완성. 투자 분석·데이터 엔지니어링 파이프라인 최적화를 위한 Python 생태계 표준이 필요. 기존 rule이 TS/NestJS/React/Flutter의 HOW·WHICH를 다룬다면, 이번 추가는 **Python 언어 표준, FastAPI, 데이터 파이프라인, AI/LLM 통합, 도구 선택** 규칙에 집중.

추가로 `libs-backend.yaml`이 TS/NestJS 전용임에도 이름이 범용적이므로 `libs-backend-ts.yaml`로 rename하여 Python 대칭 구조 확보.

---

## 최종 파일 목록 (8 operations)

| #   | 파일                                         | 작업                 | id                     | category    | priority  |
| --- | -------------------------------------------- | -------------------- | ---------------------- | ----------- | --------- |
| 1   | `libs-backend.yaml` → `libs-backend-ts.yaml` | **rename + id 수정** | `libs-backend-ts`      | `tooling`   | 25 (유지) |
| 2   | `python.yaml`                                | **신규**             | `python`               | `language`  | **55**    |
| 3   | `fastapi.yaml`                               | **신규**             | `fastapi`              | `framework` | **42**    |
| 4   | `sqlalchemy.yaml`                            | **신규**             | `sqlalchemy`           | `database`  | **38**    |
| 5   | `data-pipeline-python.yaml`                  | **신규**             | `data-pipeline-python` | `domain`    | **33**    |
| 6   | `ai-llm-python.yaml`                         | **신규**             | `ai-llm-python`        | `domain`    | **28**    |
| 7   | `libs-backend-python.yaml`                   | **신규**             | `libs-backend-python`  | `tooling`   | **22**    |
| 8   | `rule-data.test.ts`                          | **수정**             | —                      | —           | —         |

### Priority Map (변경 후, 21개)

```
90 role-persona
85 communication
80 code-philosophy
75 naming-convention
70 engineering-standards
65 typescript
60 react-typescript
55 python              ← NEW
50 nextjs
45 nestjs
42 fastapi             ← NEW
40 prisma-postgresql
38 sqlalchemy          ← NEW
35 shadcn-ui
33 data-pipeline-python ← NEW
30 flutter
28 ai-llm-python       ← NEW
25 libs-backend-ts      ← RENAMED
22 libs-backend-python  ← NEW
20 libs-frontend-web
15 libs-frontend-app
```

---

## 1. `libs-backend.yaml` → `libs-backend-ts.yaml` (rename)

- `git mv` + id 필드만 `libs-backend` → `libs-backend-ts` 변경
- priority(25), category(tooling), tags(`typescript, nestjs, backend`), content 변경 없음

---

## 2. `python.yaml` — Core & Types (priority 55)

`typescript.yaml`과 대칭. PEP 8 + strict typing + Pydantic V2.

**constraints (6):**

1. `Any` 타입 힌트 금지 → `object` 또는 구체적 제네릭 사용
2. mutable default argument 금지 → `def f(items: list = [])` 대신 `None` sentinel + factory
3. bare `except:` / `except Exception:` 금지 → 구체적 예외 catch
4. `from module import *` 금지 → 명시적 import
5. string-based type checking 금지 (`type(x) == str`) → `isinstance()` 또는 Protocol
6. error code 없는 `# type: ignore` 금지 → `# type: ignore[arg-type]` 형태 필수

**guidelines (7):**

1. 모든 함수 시그니처에 파라미터 + 리턴 타입 어노테이션 필수 (`-> None` 포함)
2. Pydantic V2 `BaseModel`을 DTO·설정·스키마에 사용. `model_validator`/`field_validator` (V1 deprecated `validator` 금지)
3. `TypeAlias`, `TypeVar`, `ParamSpec`, `TypedDict`, `Literal` 활용
4. 비즈니스 로직은 `*_logic.py` (순수 함수), 서비스/라우터는 thin orchestrator
5. validation 불필요한 불변 값 객체는 `dataclass(frozen=True)` 사용
6. `os.path` 대신 `pathlib.Path` 사용
7. f-string만 사용. `%` formatting, `.format()` 지양

**decision_table (3):**

1. 검증/직렬화 필요한 구조화 데이터 → Pydantic V2 BaseModel | avoid: plain dict, TypedDict(런타임 검증 없음)
2. 검증 불필요한 불변 값 객체 → `@dataclass(frozen=True)` | avoid: Pydantic(불필요한 오버헤드)
3. 런타임 타입 내로잉 → `isinstance()` 또는 `model_validate()` | avoid: `type()` 비교, `hasattr()` (fragile)

---

## 3. `fastapi.yaml` — Framework (priority 42)

`nestjs.yaml`과 대칭. Dependency Injection & Async First.

**constraints (5):**

1. request/response 모델로 plain dict/TypedDict 금지 → Pydantic BaseModel + Field constraints
2. `async def` 핸들러 내 동기 blocking I/O 금지 (time.sleep, requests.get, open()) → httpx.AsyncClient, aiofiles, run_in_executor
3. route handler 내 수동 에러 dict 반환 금지 → `@app.exception_handler` + `HTTPException` 또는 커스텀 예외
4. router 함수에 비즈니스 로직 금지 → `Depends()`로 서비스 주입 (nestjs.yaml의 Controller 로직 금지와 대칭)
5. CORS origins 하드코딩 금지 → Pydantic Settings에서 로드

**guidelines (6):**

1. `Depends()`로 DI: DB 세션, auth, 서비스. 재사용 가능한 dependency 함수 작성
2. `APIRouter` per domain (`prefix="/users"`, `tags=["users"]`). main app에 mount
3. 모든 엔드포인트에 `response_model` 명시 → OpenAPI 정확성 + 응답 필터링
4. `Annotated[T, Depends(...)]` 패턴 (PEP 593) 사용
5. Pydantic `Settings` + `SettingsConfigDict(env_file=".env")` → startup 시 검증
6. `lifespan` context manager로 startup/shutdown (deprecated `@app.on_event` 금지)

**decision_table (5):**

1. CPU-bound 엔드포인트 → `def` (sync, FastAPI 자동 threadpool) | avoid: `async def` + blocking code
2. I/O-bound 엔드포인트 → `async def` + async 드라이버 | avoid: `def` + sync 드라이버
3. 공유 리소스 setup/teardown → `lifespan` async context manager | avoid: `@app.on_event` (deprecated)
4. 에러 응답 → `HTTPException`/커스텀 예외 + `@app.exception_handler`. engineering-standards 에러 envelope과 동기화 | avoid: route handler 내 수동 JSONResponse
5. 즉시 응답 필요하지만 후처리 작업이 있을 때 → 경량 작업: `BackgroundTasks` (FastAPI 내장), 중량 작업/재시도 필요: Celery 또는 TaskIQ (async 네이티브) | avoid: route handler 내에서 동기적으로 완료 대기 (응답 지연)

---

## 4. `sqlalchemy.yaml` — Database (priority 38)

`prisma-postgresql.yaml`과 대칭. SQLAlchemy 2.0 + Alembic.

**constraints (5):**

1. Legacy 1.x style `session.query()` 금지 → 2.0 style `select()` / `insert()` / `update()` 사용
2. raw SQL string 직접 실행 금지 (마이그레이션 제외) → ORM 또는 `text()` + 바인드 파라미터
3. `session.commit()` 분산 호출 금지 → Unit of Work 패턴, 서비스 레이어에서 단일 commit
4. 모델에 `created_at` / `updated_at` 누락 금지 → `server_default=func.now()`, `onupdate=func.now()`
5. Alembic 없이 스키마 변경 금지 → `alembic revision --autogenerate` + 수동 검토

**guidelines (7):**

1. `Mapped[T]` / `mapped_column()` 선언적 매핑 사용 (2.0 type-safe 스타일)
2. relationship은 `Mapped[list["Child"]]` + `relationship(back_populates=...)` 명시
3. `AsyncSession` + `async_sessionmaker` 사용 (FastAPI async 스택과 일치)
4. soft delete: `deleted_at: Mapped[datetime | None]` + 쿼리 필터 기본 적용
5. enum 컬럼은 Python `StrEnum` + `Mapped[MyEnum]` (문자열 저장, 마이그레이션 안전)
6. index/constraint 명시: 복합 인덱스, unique constraint는 `__table_args__`에 선언
7. N+1 방지: relationship 접근 시 반드시 eager loading 전략 명시 — `selectinload()` (1:N, 별도 IN 쿼리), `joinedload()` (N:1/1:1, JOIN). lazy='select' 기본값에 의존 금지

**decision_table (3):**

1. 단순 CRUD → SQLAlchemy ORM (`select`, `insert`) | avoid: raw SQL (타입 안전성 없음, SQL injection 위험)
2. 복잡한 분석 쿼리 → DuckDB 또는 raw SQL via `text()` + 바인드 파라미터 | avoid: ORM으로 복잡한 윈도우 함수 강제 표현
3. 스키마 변경 → Alembic `--autogenerate` + 수동 검토 | avoid: 수동 SQL DDL (추적 불가, 환경 간 불일치)

---

## 5. `data-pipeline-python.yaml` — Data Engineering (priority 33)

Vectorization over Loops.

**constraints (5):**

1. DataFrame row-by-row Python for-loop 금지 → 벡터화 연산 사용
2. Pandas `.apply(axis=1)` 금지 → Python-speed. 벡터화 컬럼 연산 또는 Polars 사용
3. RAM 초과 데이터셋 전체 메모리 로드 금지 → streaming/chunked reads (`scan_parquet`, `read_csv_batched`, DuckDB out-of-core)
4. 자동 dtype 추론 의존 금지 (`.infer_objects()`) → 명시적 dtype/schema at read time
5. DataFrame in-place mutation 금지 (`inplace=True`) → 항상 새 변수에 재할당

**guidelines (5):**

1. 신규 파이프라인은 Polars 우선 (lazy eval, multi-threaded, 인덱스 혼란 없음)
2. DuckDB로 로컬 파일(Parquet/CSV) SQL 분석 쿼리. Polars/Pandas DataFrame과 zero-copy 연동
3. Generator + `itertools`로 레코드 레벨 스트리밍 변환
4. 대규모 출력은 date/key 기준 Hive-style 파티셔닝 (`year=YYYY/month=MM/`) Parquet 포맷
5. 모든 I/O 경계에 명시적 스키마 (Polars `Schema`, Pandas `dtype` dict, Pydantic model)

**decision_table (4):**

1. < 10GB 테이블 변환 → Polars lazy mode + `.collect()` | avoid: Pandas (GIL-bound, single-threaded)
2. 로컬 파일 ad-hoc SQL 분석 → DuckDB SQL on Parquet/CSV | avoid: Pandas 로드 후 Python 필터링
3. 메모리 초과 데이터 → Polars `scan_*` (lazy) 또는 DuckDB out-of-core | avoid: Pandas `read_csv` 풀 로드 (OOM)
4. 복잡한 Python 로직 row-level 변환 → Polars `.map_elements()` 또는 struct 표현식 | avoid: `.iter_rows()` for-loop

---

## 6. `ai-llm-python.yaml` — AI/LLM Integration (priority 28)

Structured Output & Prompt Versioning.

**constraints (5):**

1. LLM 텍스트 응답 regex/string split 파싱 금지 → structured output (Pydantic + `response_format` / `instructor` / function calling)
2. 프롬프트 인라인 하드코딩 금지 → 버전 관리되는 외부 템플릿 (파일 또는 DB). diff/review 가능해야 함
3. async 앱에서 동기 SDK 호출 금지 → `AsyncOpenAI`, `AsyncAnthropic` 사용
4. 토큰 리밋 무시 금지 → 입력 토큰 수 계산, context window 초과 시 truncate/chunk
5. PII 포함 raw API 응답 로깅/저장 금지 → 민감 필드 마스킹 후 로깅

**guidelines (7):**

1. `instructor` 또는 네이티브 SDK `response_format` + Pydantic 모델로 structured output 추출
2. LLM API 호출에 exponential backoff 재시도 (`tenacity`). 429/500/503 핸들링
3. LiteLLM으로 provider 추상화. 코드베이스 전체에 특정 provider SDK 직접 결합 방지
4. 요청별 토큰 사용량 (input/output tokens, model name, latency) 추적·로깅 → 비용 모니터링
5. 프롬프트 템플릿 semantic versioning. LLM 호출 로그에 버전 메타데이터 포함 → 재현성 확보
6. Streaming 응답 우선: 사용자 대면 LLM 호출은 `stream=True`로 점진적 응답 전달 (TTFB 개선). 서버 내부 파이프라인(구조화 출력 추출 등)에서만 non-streaming 허용
7. Fallback 모델 설정: primary 모델 장애·rate limit 시 자동 전환할 fallback 모델 체인 정의. LiteLLM `fallbacks` 설정 또는 자체 retry-with-downgrade 로직 구현

**decision_table (4):**

1. LLM 출력이 특정 스키마를 따라야 할 때 → `instructor` + Pydantic 또는 `response_format={"type":"json_schema"}` | avoid: regex 파싱
2. 모델 선택 → 작업 요구 수준에 맞는 최소 모델 (Haiku/GPT-4o-mini = 분류/추출, 대형 모델 = 복잡한 추론만) | avoid: 모든 태스크에 최대 모델 기본 사용
3. context window 초과 문서 → 오버랩 청킹 + 독립 처리 + 결과 집계 | avoid: 묵시적 truncation
4. 다중 LLM provider 지원 → LiteLLM 통합 인터페이스 + 라우팅 설정 | avoid: provider별 SDK 호출 코드베이스 산재

---

## 7. `libs-backend-python.yaml` — Python Tooling (priority 22)

`libs-backend-ts.yaml`과 대칭. python-ops-infra 내용 통합.

**constraints (4):**

1. `requirements.txt` 금지 → `uv` (우선) 또는 Poetry + `pyproject.toml`. lock 파일 필수
2. `print()` 로깅 금지 → `structlog` JSON output
3. `unittest.TestCase` 금지 → `pytest` function-based tests + fixtures
4. production 코드에 bare `assert` 금지 (`-O` 플래그로 strip 됨) → 명시적 `if/raise`

**guidelines (10):**

1. `uv 0.5+` — 패키지 관리. `uv sync`, `uv run`. `uv.lock` 커밋 필수
2. `pytest 8+` / `pytest-asyncio` / `pytest-cov` — 테스팅. fixtures, parametrize, coverage
3. `httpx 0.28+` — sync/async HTTP 클라이언트. FastAPI 테스트 클라이언트 (`ASGITransport`)
4. `structlog 24+` — JSON 구조화 로깅. request_id/user_id context binding
5. `ruff` — lint + format (flake8, black, isort 대체). `pyproject.toml` `[tool.ruff]` 설정
6. `mypy 1.10+` 또는 `pyright` — strict mode 정적 타입 검사. CI gate
7. `pydantic-settings 2+` — 환경 변수 로딩·검증. config 단일 진실 공급원
8. `tenacity 9+` — 재시도 로직 (exponential backoff). 외부 API 호출·일시적 장애 복구
9. `Great Expectations 1+` 또는 `pandera` — 파이프라인 입출력 데이터 품질 검증
10. `polars 1+` / `duckdb 1+` — 데이터 처리 기본 스택. data-pipeline-python.yaml과 연계

**decision_table (4):**

1. 패키지 관리 → `uv` + `pyproject.toml` + `uv.lock` | avoid: pip + requirements.txt, conda
2. lint/format → `ruff` 단일 도구 | avoid: flake8 + black + isort (설정 분산, 느린 CI)
3. 데이터 품질 검증 → Great Expectations (배치) 또는 pandera (DataFrame 스키마) | avoid: 파이프라인 코드 내 산재된 수동 assert
4. HTTP 클라이언트 → `httpx` (sync/async 겸용) | avoid: `requests` (async 미지원), `aiohttp` (API 복잡)

---

## 수정 대상 파일 요약

| 파일                                                        | 작업                                          |
| ----------------------------------------------------------- | --------------------------------------------- |
| `packages/compiler/data/rules/libs-backend.yaml`            | **git mv** → `libs-backend-ts.yaml` + id 변경 |
| `packages/compiler/data/rules/python.yaml`                  | **신규**                                      |
| `packages/compiler/data/rules/fastapi.yaml`                 | **신규**                                      |
| `packages/compiler/data/rules/sqlalchemy.yaml`              | **신규**                                      |
| `packages/compiler/data/rules/data-pipeline-python.yaml`    | **신규**                                      |
| `packages/compiler/data/rules/ai-llm-python.yaml`           | **신규**                                      |
| `packages/compiler/data/rules/libs-backend-python.yaml`     | **신규**                                      |
| `packages/compiler/src/schemas/__tests__/rule-data.test.ts` | **수정** — ruleFiles 배열 업데이트            |

## 참조 파일

| 파일                                                      | 용도                                           |
| --------------------------------------------------------- | ---------------------------------------------- |
| `packages/compiler/src/schemas/rule.schema.ts`            | Zod 스키마 검증 대상                           |
| `packages/compiler/data/rules/engineering-standards.yaml` | 중복 확인 (API envelope, error format, UTC 등) |
| `packages/compiler/data/rules/typescript.yaml`            | 대칭 구조 참조                                 |
| `packages/compiler/data/rules/nestjs.yaml`                | 대칭 구조 참조                                 |
| `packages/compiler/data/rules/prisma-postgresql.yaml`     | 대칭 구조 참조                                 |
| `packages/compiler/data/rules/libs-backend.yaml`          | rename 대상 + 대칭 구조 참조                   |

## Verification

```bash
cd packages/compiler && npx vitest run && npx tsc --noEmit
```

- 21개 rule YAML 스키마 검증 통과
- id 유일성 (21개) 통과
- priority 유일성 (21개) 통과
