# Data Pipeline Python Performance

## Constraints

- Do not iterate DataFrame rows in Python loops for core transformations.
- Do not use Pandas `.apply(axis=1)` for production-scale transforms.
- Do not load datasets larger than memory in one shot.
- Do not rely on implicit dtype inference in production pipelines.
- Do not mutate DataFrames in place.

## Guidelines

- Prefer Polars for new pipelines, especially lazy mode.
- Use DuckDB for local SQL analytics on Parquet/CSV and out-of-core workloads.
- Use streaming or chunked reads for large sources.
- Write partitioned Parquet outputs for downstream pruning.
- Enforce explicit schemas at I/O boundaries.

## Decision Rules

- When transforming medium or large tables, prefer Polars lazy pipelines.
- When ad-hoc SQL analysis on local files is needed, use DuckDB directly on the source files.
- When data exceeds available memory, use out-of-core execution.
- When custom per-row logic is unavoidable, use controlled vectorized or mapped APIs rather than general row iteration.
