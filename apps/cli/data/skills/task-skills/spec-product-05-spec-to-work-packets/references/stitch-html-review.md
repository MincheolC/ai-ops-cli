# Stitch HTML Review Checklist

Use this checklist before writing initial-build UI packets from Stitch output.

## Extract

- top-level screens represented by each HTML file
- repeated layout regions such as header, shell, side panel, footer
- major interactive blocks such as forms, tables, tabs, charts, filters
- visible state variants such as disabled, active, empty, loading-like placeholders, error copy

## Do Not Assume

- generated class names are production-ready structure
- every visual grouping should become a component
- missing states mean those states do not exist
- HTML output means the shipped product should be implemented as web markup

## Use For Packeting

- identify natural UI seams
- identify likely component boundaries
- identify stateful regions needing separate implementation work
- cross-check whether the generated visuals introduce behavior not present in the approved spec
- identify which approved layout hierarchy, CTA priority, copy grouping, and state presentation should survive target-platform translation
