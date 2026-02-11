# Fellowship 360 — Implementation Plan

> **Last Updated:** February 10, 2026
> **Status:** Phases 1-5 complete, Phase 6 next
> **Project:** Church CRM with Grace AI (organization-scoped, DB-backed)

---

## Current State Summary

### Completed ✅

- Database schemas implemented for church operations, communications, pipeline, ministries, finances, and prayer.
- Server actions implemented under `src/app/actions/` for CRUD and aggregated dashboard/report data.
- Core app pages wired to real data (organization scoped), including dashboards.
- Missing pages from earlier scope now exist and are wired:
  - `/app/calls`
  - `/app/reports`
  - `/app/seed`
- Reports export implemented (client-side CSV download).
- Build passes (`pnpm build`).

### Known Non-Blocking Issues ⚠️

- `baseline-browser-mapping` warning still appears during build despite package update and suppression env vars.
- `tailwind.config.ts` module type warning still appears during build.

---

## Phase 1: Database Schemas ✅

Implemented in `src/db/schema/`:

- `church-contacts.ts`
- `pipeline.ts`
- `communications.ts`
- `ministries.ts`
- `operations.ts`
- `finances.ts`
- `prayer.ts`

Index exports updated in `src/db/schema/index.ts`.

---

## Phase 2: Server Actions ✅

Implemented in `src/app/actions/`:

- `contacts.ts`
- `pipeline.ts`
- `tasks.ts`
- `calendar.ts`
- `prayer.ts`
- `finances.ts`
- `ministries.ts`
- `operations.ts`
- `communications.ts`
- `dashboard.ts`
- `reports.ts`
- `seed.ts`

---

## Phase 3: Wire App Pages to Real Data ✅

Wired pages include:

- `contacts`, `pipeline`, `tasks`, `calendar`, `prayer-requests`
- `donations`, `donors`, `pledges`
- `ministries`, `appointments`, `volunteers`
- `conversations`, `broadcasts`, `templates`

---

## Phase 4: Wire Dashboards ✅

Completed:

- Grace dashboard (`/app/grace`) wired to live aggregates.
- Ministry dashboard (`/app/home`) wired to live aggregates.
- Donor-name query robustness fixed in dashboard action.
- Full build verification completed.

---

## Phase 5: Remaining Page Wiring ✅

Completed:

- `/app/calls`: wired to real phone conversation data and KPIs.
- `/app/reports`: wired to real aggregated reporting data with timeframe toggles.
- `/app/seed`: functional + guard rails improved.
- Reports export button now performs CSV export.

---

## Review Before Phase 6

### Findings

1. Medium: Build warning noise remains from baseline-browser-mapping.
   - Impact: no runtime break, but noisy CI/build logs.
   - Recommendation: treat as tooling warning; continue shipping.

2. Medium: Reports export is client-generated CSV only.
   - Impact: no server audit trail or signed exports.
   - Recommendation: acceptable for MVP; move server-side export to backlog if compliance/audit is needed.

3. Medium: Some pages still have UI-only search/filter interactions.
   - Impact: UX inconsistency as data grows.
   - Recommendation: prioritize server/query-backed filters in next polish pass.

4. Low: Build warning for module type (`tailwind.config.ts`) remains.
   - Impact: performance warning only.
   - Recommendation: optional cleanup when touching build/tooling configs.

### Decision

- **Proceed to Phase 6.**
- No blocking defects found for Phase 6 execution.

---

## Phase 6: Create/Edit Forms (Next)

Goal: Convert remaining “Add” / static actions into real create/edit workflows with validation.

### Priority Order

1. Appointments
- Add create modal
- Add edit flow

2. Prayer Requests
- Add create modal
- Add edit/status flow

3. Broadcasts
- Add compose/send flow
- Add edit draft flow

4. Ministries
- Add create modal
- Add edit flow

5. Pledges
- Add create modal
- Add edit flow

6. Calendar Events
- Add create/edit event modals

### Execution Standards

- Use server actions for mutations.
- Add form validation (`zod` + `react-hook-form` where appropriate).
- Preserve org scoping on all writes.
- Add success/error toasts and loading states.
- Ensure empty states and error states render cleanly.

### Verification for Each Page

1. Create succeeds and record appears without refresh issues.
2. Edit persists and reflects immediately.
3. Validation errors display clearly.
4. No console errors and `pnpm build` still passes.

---

## Quick Resume

1. `cd /Users/studiocomp/Documents/fellowship-360-app`
2. `pnpm dev`
3. Open `/app` and continue with Phase 6 forms in the priority order above.
