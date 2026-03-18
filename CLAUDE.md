# MiniMemo — Project Context

## What this product is
MiniMemo is a lightweight analytics report generator.

Users upload one or more datasets → the system automatically:
- profiles each dataset
- identifies measures, dimensions, and time columns
- computes summaries
- generates charts
- produces key insights
- outputs a clean, readable report

The goal is to feel like:
> a clean, professional analytics report — not a dashboard, not a notebook

---

## Core principles

1. Deterministic-first
- All analysis must work WITHOUT any LLM
- Heuristics + statistics drive everything
- AI (later) will only improve wording, not logic

2. Simplicity > complexity
- Avoid over-engineering
- Avoid adding unnecessary abstractions
- Prefer small, clear functions over complex systems

3. Product feel matters
- UI should feel like a real analytics tool
- Clean, minimal, structured
- Not flashy, not a marketing site

4. Generalizable logic
- Do NOT hardcode for specific datasets (e.g. "sales")
- All logic should work across arbitrary CSVs

---

## Multi-dataset direction (important)

- The system should support multiple datasets
- Each dataset is profiled independently first
- Relationships (joins) are NOT required yet

Design expectation:
- avoid assumptions that there is only one dataset
- structure data models to allow multiple datasets later
- keep report generation modular per dataset

---

## What a “good output” looks like

A strong report should:
- clearly separate measures, dimensions, and time columns
- show 3–5 high-quality insights (not too many)
- include meaningful group breakdowns
- include at least one time-based trend (if available)
- feel clean and easy to scan

---

## Architecture expectations

- Keep analysis logic separate from UI
- Keep report generation structured (not free text blobs)
- Future AI should plug into a single layer (e.g. narrative generator)
- Design data structures so they can scale to multiple datasets

---

## UI guidelines

Design style:
- minimal
- clean
- structured
- readable

Avoid:
- flashy gradients
- heavy animations
- cluttered dashboards

Prefer:
- card-based layout
- strong spacing
- clear typography hierarchy

---

## When making changes

Always:
- keep scope tight
- avoid rewriting unrelated code
- preserve working behavior
- explain what changed and why

Never:
- introduce large dependencies without reason
- redesign the entire system
- overcomplicate simple logic

---

## How to approach tasks

When given a task:
1. Identify the smallest meaningful improvement
2. Implement only that
3. Keep code readable
4. Ensure it aligns with deterministic-first philosophy

---

## Long-term vision 

- accept multiple datasets with relationships
- suggest joins between datasets
- accept user context (analysis goal, dataset meaning)
- use AI to generate narrative summaries
- generate richer visualizations

