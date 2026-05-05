<!-- ai-ops:start -->
<!-- sourceHash: eb083c | generatedAt: 2026-03-25T04:09:49.004Z -->

# Plan Mode

## Guidelines

- Prefer Mermaid diagrams over long bullet lists when explaining flow, sequence, state, or structure.
- Pick the diagram type that matches the information structure; do not mix types arbitrarily.
- Use flowchart for UX/control flows and decision trees.
- Use sequenceDiagram for request/response and service interaction flows.
- Use erDiagram for entities and schema relationships.
- Use stateDiagram-v2 for lifecycle/state transitions.
- Wrap diagrams in fenced ```mermaid code blocks.

## Decision Table

| When | Then | Avoid |
|------|------|-------|
| Describing user journey or UI navigation | Use flowchart (LR or TD) | Text-only step lists |
| Describing API or service interactions | Use sequenceDiagram | Plain text arrows only |
| Describing schema relationships | Use erDiagram | Unstructured table bullet lists |
| Describing state transitions | Use stateDiagram-v2 | Flat textual state lists |
| Saving a plan document to disk | Name as YYYYMMDD_<topic>.md with kebab-case topic | Arbitrary names like plan.md or notes.md |
<!-- ai-ops:end -->
