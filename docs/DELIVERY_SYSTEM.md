# Delivery System

Last updated: April 1, 2026  
Purpose: keep one truthful view of what is left, what blocks launch, and what should be built next.

## Canonical Sources
- `docs/DELIVERY_BOARD.md`: the only current backlog and sequencing document.
- `pnpm status:delivery`: the machine gate for repo health plus launch readiness.
- `pnpm launch:preflight`: the operational gate for environment, provider coverage, and production-safe config.

Older planning docs can stay for historical context, but they are not the source of truth once they diverge from this system.

## Work Item Model
Every item on the board should include:
- ID: stable identifier like `DLV-###`.
- Stream: `Repo Hygiene`, `Launch Blocker`, `Product Hardening`, or `Deferred`.
- Status: `Now`, `Next`, `Later`, `Blocked`, `Done`, or `Deferred`.
- Why it matters: one sentence tied to risk, launch, or customer value.
- Evidence: command output, file path, or test that proves the item exists.
- Done when: the exact command, UX flow, or acceptance condition that closes it.

If an item cannot point to code, a command, or an operator workflow, it is not ready to enter the board.

## Lane Definitions
- `Now`: blocks trustworthy shipping, truthful status, or production readiness.
- `Next`: important hardening after `Now` is clean.
- `Later`: useful, but does not block launch or reliable operation.
- `Deferred`: consciously not in scope; leave a reason.

## Weekly Operating Cadence
1. Run `pnpm status:delivery`.
2. Move every failing result into `docs/DELIVERY_BOARD.md` if it is not already tracked.
3. Keep at most 3 items in `Now`.
4. Each PR must close a board item or explicitly update its status/evidence.
5. If a doc says `Done` while a command still fails, the command wins.

## Daily Triage
1. Check `docs/DELIVERY_BOARD.md`.
2. Pick one launch blocker and one hardening item at most.
3. Before merging, run the narrowest proving command:
   - `pnpm lint`
   - `pnpm test:launch-gate`
   - `pnpm build`
   - `pnpm launch:preflight`
4. Record the result directly on the board.

## Current Build Order
1. Truthfulness first: repo health commands and canonical board.
2. Launch blockers next: secrets, rate limiting, provider coverage, operational readiness.
3. Hardening after that: edge-case tests, scope cleanup, deeper E2E.
4. Deferred work stays out of active lanes until explicitly re-opened.

## Rules
- Do not create a second tracker.
- Do not leave stale `Done` claims in active docs.
- Do not treat optional integrations as blockers unless launch depends on them.
- Do not carry speculative backlog items without evidence from code or operations.
