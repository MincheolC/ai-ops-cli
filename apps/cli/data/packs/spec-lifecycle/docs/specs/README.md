---
status: Reserved
layer: spec
owner: project
read_when:
  - spec_lifecycle
update_when:
  - spec_lifecycle_changes
---
# Specs

This document is Reserved. Do not use this document as current decision-making evidence until the project fills in real spec lifecycle documents.

## Directory Structure

```text
docs/specs/
├── baseline/
└── initial-build/
```

## Rules

- `baseline/` contains approved product, technical, and UI baseline documents.
- `initial-build/` contains initial implementation work packets and related artifacts.
- Before using any document as decision-making evidence, update its frontmatter and its status in `docs/docs-status.md`.
