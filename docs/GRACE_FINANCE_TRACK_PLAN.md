# GRACE Finance Track Plan

Last updated: March 17, 2026  
Status: `Included in Grace launch branch`

## Decision
Finance delivery is now **in scope** for the current Grace launch branch.

`P0-016` and `P0-017` are tracked directly inside the launch branch and included in launch QA coverage.

## Why Branch First
- Lowest coordination overhead while Grace launch work is still active.
- Reuses existing auth, org, and data boundaries without immediate platform split risk.
- Keeps migration path open toward extraction if finance complexity grows.

## Separate-App Trigger Criteria
Split finance into a separate app when two or more of these are true:
- Finance requires independent release cadence and incident response.
- Compliance/audit requirements diverge from core Grace operations.
- Domain data model growth starts forcing frequent cross-domain regressions.
- Team ownership is dedicated and does not overlap with core Grace execution.

## Immediate Scope Rules
- Grace v1 launch gate now includes weekly finance accountability.
- QA launch matrix should include finance evidence in launch-gate runs.
- `FIN-006` is implemented in-branch (weekly digest auto-delivery to leadership inbox).
- `FIN-005` is implemented in-branch (weekly exception alerts for spikes/drops, recurring gift failures, and reconciliation mismatches with follow-up task creation).
- `FIN-007` is implemented in-branch (voice query support for weekly finance summary with deterministic fallback).
- Finance scope from the current launch plan is complete in-branch; future items can be tracked as post-launch enhancements.
