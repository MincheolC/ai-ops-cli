# AI LLM Python Runtime

## Constraints

- Do not parse model outputs with regex or string splitting when schema output is required.
- Do not hardcode prompts inline.
- Do not call sync SDK methods from async application paths.
- Do not ignore token limits.
- Do not log raw responses containing PII.

## Guidelines

- Use Pydantic-based structured outputs or provider-native schema modes.
- Apply retry with exponential backoff for transient provider failures.
- Centralize provider routing through one abstraction layer.
- Track model, tokens, and latency per call.
- Version prompts and include the prompt version in logs.
- Stream user-facing responses when possible.
- Define fallback model chains for rate limits or provider outages.

## Decision Rules

- When output must match a strict schema, use structured output with schema validation.
- When selecting a model, prefer the smallest model that meets quality requirements.
- When input exceeds the context window, chunk with overlap and aggregate.
- When multiple providers are required, route them through one unified abstraction.
