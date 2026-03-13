# Python Language

## Constraints

- Do not use `Any` in type hints by default.
- Do not use mutable default arguments.
- Do not use bare `except` or broad `except Exception`.
- Do not use wildcard imports.
- Do not use `type(x) == T` checks.
- Do not use `# type: ignore` without an explicit error code.

## Guidelines

- Annotate all function parameters and return types.
- Use Pydantic v2 models for validated DTO and config boundaries.
- Use `TypeAlias`, `TypeVar`, `ParamSpec`, `TypedDict`, and `Literal` deliberately.
- Keep business logic in pure `*_logic.py` modules.
- Use `@dataclass(frozen=True)` for immutable value objects without validation needs.
- Use `pathlib.Path` for filesystem paths.
- Use f-strings for string formatting.

## Decision Rules

- When structured input or output needs validation, use Pydantic v2 models.
- When immutable value objects do not need runtime validation, use frozen dataclasses.
- When runtime type narrowing is needed, use `isinstance()` or model validation.
