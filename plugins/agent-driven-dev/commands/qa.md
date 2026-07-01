---
description: QA — generate the automated test suite (vitest) covering the acceptance criteria and the MCP tools
---

Generate the automated tests for the app, following "Agents propose, humans decide".

## Preconditions

1. Check that `docs/define/prd.md` and `src/` exist. If the app is not implemented yet,
   stop and tell the user to complete Stage 2 (`/implement`) first.

## Steps

1. Delegate to the **qa-engineer** subagent (via the Agent tool). Tell it to:
   - Read `CLAUDE.md`, `docs/define/prd.md` (AC-1..AC-15) and `docs/specify/spec.md`.
   - Read the real code under `src/` and use the existing testing seams: `buildServer(config)`
     (`app.inject`), `buildMcpServer(repository)` (in-memory transport), and the pure
     `domain/transitions.ts`.
   - Write **vitest** tests (ESM/NodeNext, `.js` import extensions) using an in-memory SQLite
     (`:memory:`) per test, covering: domain transitions, the HTTP endpoints mapped to
     AC-1..AC-15 (strict-input 400s, 404s, 409 illegal transition), and a smoke test of the
     five MCP tools.
   - Run `npm test` and iterate until green — but if a test reveals a genuine app bug, stop
     and report it instead of weakening the test.
2. When the subagent returns, present: the suites added, the AC coverage, the `npm test`
   result, and any real bug found.
3. Ask the user to review and approve the test suite.

Do not change application code to force tests green in this command; QA verifies behavior.
