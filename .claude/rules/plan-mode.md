<!-- managed by ai-ops -->
<!-- sourceHash: d53af8 | generatedAt: 2026-03-03T02:59:36.622Z -->

# Plan Mode

## Constraints

- DO NOT mix Mermaid diagram types arbitrarily. Pick the type that matches the information structure.

## Guidelines

- Prefer Mermaid diagrams over long bullet lists when explaining flow, sequence, state, or structure.
- Use flowchart for UX/control flows and decision trees.
- Use sequenceDiagram for request/response and service interaction flows.
- Use erDiagram for entities and schema relationships.
- Use stateDiagram-v2 for lifecycle/state transitions.
- Wrap diagrams in fenced ```mermaid code blocks.

## Decision Table

| When                                     | Then                     | Avoid                           |
| ---------------------------------------- | ------------------------ | ------------------------------- |
| Describing user journey or UI navigation | Use flowchart (LR or TD) | Text-only step lists            |
| Describing API or service interactions   | Use sequenceDiagram      | Plain text arrows only          |
| Describing schema relationships          | Use erDiagram            | Unstructured table bullet lists |
| Describing state transitions             | Use stateDiagram-v2      | Flat textual state lists        |
