# Fellowship 360 — Master Implementation Plan

> **Last Updated:** February 9, 2025
> **Status:** Phase 1 complete, Phases 2-5 pending
> **Project:** Church CRM with Grace AI (AI-powered communication assistant)

---

## Current State Summary

### What's Done ✅

- Grace AI Dashboard is the main landing page (`/app`)
- Pipeline page has working drag-and-drop kanban (local state via `@hello-pangea/dnd`)
- 18 app pages exist as UI shells with hardcoded mock data
- Auth system exists (bypassed for development)
- Organization system works (from IndieKit boilerplate)
- Billing/Stripe integration exists (test keys)
- Database connected: Drizzle ORM + Neon PostgreSQL
- Email infrastructure: React Email + AWS SES

### What's NOT Working ❌

- All pages use hardcoded data (nothing reads from or writes to DB)
- Two sidebar pages don't exist: `/app/calls`, `/app/reports`
- No AI integration
- No SMS/calling capability
- No real communication engine
- Auth is bypassed

---

## Phase 1: Database Schemas (Foundation) ⏳

Create Drizzle schemas in `src/db/schema/` for all app features.

### Existing schemas (from boilerplate):

- `user.ts` — Users and auth
- `organization.ts` — Churches/orgs
- `organization-membership.ts` — User-org relationships
- `plans.ts` — Subscription plans
- `invitation.ts` — Org invites
- `contact.ts` — Basic contact (needs expansion)

### New schemas needed:

#### `src/db/schema/contacts.ts`

- [ ] `contacts` table — firstName, lastName, email, phone, memberStatus (visitor/member/leader), familyId, tags, source, organizationId, createdAt, updatedAt
- [ ] `families` table — familyName, address, organizationId
- [ ] `contact_tags` table — contactId, tag

#### `src/db/schema/pipeline.ts`

- [ ] `pipeline_stages` table — name, order, color, organizationId
- [ ] `pipeline_items` table — contactId, stageId, order, assigneeId, priority, notes, lastContactDate, nextActionDate

#### `src/db/schema/communications.ts`

- [ ] `conversations` table — contactId, channel (phone/sms/email/web), status, assigneeId, organizationId
- [ ] `messages` table — conversationId, content, direction (inbound/outbound), sentAt, senderType (human/ai)
- [ ] `broadcasts` table — title, content, channel, audienceFilter, sentAt, stats (delivered/opened/clicked)
- [ ] `templates` table — name, content, category, variables, organizationId

#### `src/db/schema/ministries.ts`

- [ ] `ministries` table — name, description, leaderId, meetingSchedule, organizationId
- [ ] `ministry_members` table — ministryId, contactId, role

#### `src/db/schema/operations.ts`

- [ ] `events` table — title, description, startDate, endDate, location, recurring, organizationId
- [ ] `appointments` table — contactId, staffId, dateTime, status, type, notes
- [ ] `tasks` table — title, description, assigneeId, dueDate, priority, status, organizationId
- [ ] `volunteers` table — contactId, role, totalHours, status
- [ ] `volunteer_shifts` table — volunteerId, eventId, date, hours

#### `src/db/schema/finances.ts`

- [ ] `donations` table — contactId, amount, date, method, fund, receiptSent, organizationId
- [ ] `pledges` table — contactId, amount, startDate, endDate, frequency, amountPaid
- [ ] `donors` table — (view/extension of contacts with giving summary)

#### `src/db/schema/prayer.ts`

- [ ] `prayer_requests` table — contactId, content, urgency, status (new/praying/answered/archived), assignedTeam, organizationId

### Migration commands:

```bash
# After creating schemas:
pnpm drizzle-kit generate   # Generate migration SQL
pnpm drizzle-kit push        # Push to Neon DB (dev)
# OR
pnpm drizzle-kit migrate     # Run migrations (production)
```

---

## Phase 2: CRUD + Page Wiring ⏳

Connect every page to its database schema via Server Actions (`src/app/actions/`).

### Server Actions to create:

#### `src/app/actions/contacts.ts`

- [ ] `getContacts(orgId, filters)` — List with search, pagination
- [ ] `getContact(id)` — Single contact detail
- [ ] `createContact(data)` — Add new contact
- [ ] `updateContact(id, data)` — Edit contact
- [ ] `deleteContact(id)` — Remove contact
- [ ] `importContacts(csvData)` — Bulk CSV import
- [ ] `exportContacts(orgId)` — CSV export

#### `src/app/actions/pipeline.ts`

- [ ] `getPipelineData(orgId)` — Fetch stages + items
- [ ] `updateItemStage(itemId, stageId, order)` — Drag-drop persistence
- [ ] `createPipelineItem(data)` — Add visitor to pipeline
- [ ] `seedDefaultStages(orgId)` — Create default stages for new org

#### `src/app/actions/tasks.ts`

- [ ] `getTasks(orgId, filters)` — List tasks
- [ ] `createTask(data)` — New task
- [ ] `updateTask(id, data)` — Edit/complete task
- [ ] `deleteTask(id)` — Remove task

#### `src/app/actions/calendar.ts`

- [ ] `getEvents(orgId, dateRange)` — Events for calendar view
- [ ] `createEvent(data)` — New event
- [ ] `updateEvent(id, data)` — Edit event
- [ ] `deleteEvent(id)` — Remove event

#### `src/app/actions/prayer.ts`

- [ ] `getPrayerRequests(orgId)` — List requests
- [ ] `createPrayerRequest(data)` — Submit prayer
- [ ] `updatePrayerRequest(id, data)` — Update status/add notes

#### `src/app/actions/finances.ts`

- [ ] `getDonations(orgId, dateRange)` — List donations
- [ ] `createDonation(data)` — Record donation
- [ ] `getPledges(orgId)` — List pledges
- [ ] `createPledge(data)` — New pledge
- [ ] `getDonorSummary(orgId)` — Donor list with totals

#### `src/app/actions/ministries.ts`

- [ ] `getMinistries(orgId)` — List ministries
- [ ] `createMinistry(data)` — New ministry
- [ ] `addMember(ministryId, contactId)` — Add member

#### `src/app/actions/operations.ts`

- [ ] `getAppointments(orgId)` — List appointments
- [ ] `createAppointment(data)` — Schedule appointment
- [ ] `getVolunteers(orgId)` — List volunteers

### Pages to update:

- [ ] `/app/contacts` — Wire to contacts actions, real search, add/edit modals
- [ ] `/app/pipeline` — Persist drag-drop to DB
- [ ] `/app/tasks` — Wire to tasks actions
- [ ] `/app/calendar` — Wire to events actions
- [ ] `/app/prayer-requests` — Wire to prayer actions
- [ ] `/app/donations` — Wire to finances actions
- [ ] `/app/donors` — Wire to donor summary
- [ ] `/app/pledges` — Wire to pledges actions
- [ ] `/app/ministries` — Wire to ministries actions
- [ ] `/app/appointments` — Wire to appointments actions
- [ ] `/app/volunteers` — Wire to volunteers actions
- [ ] `/app/conversations` — Wire to conversations actions
- [ ] `/app/broadcasts` — Wire to broadcasts actions
- [ ] `/app/templates` — Wire to templates actions
- [ ] `/app/home` — Wire KPIs to real aggregate queries

### Missing pages to create:

- [ ] `/app/calls` — Call log page with history and click-to-call
- [ ] `/app/reports` — Customizable reports dashboard

---

## Phase 3: Communication Engine ⏳

### Prerequisites (USER decisions needed):

- [ ] **SMS Provider:** Twilio account + API credentials + phone number
- [ ] **Email:** Already have AWS SES — just need to wire it up
- [ ] **Voice/Calls:** Decide on provider (see Phase 4)

### Implementation:

- [ ] `src/lib/twilio/` — SMS send/receive helpers
- [ ] `src/app/api/webhooks/twilio/` — Inbound SMS/call webhook handlers
- [ ] `src/lib/email/send.ts` — Email sending via SES (partially exists)
- [ ] Broadcast composer — Select audience, compose, send via SMS/email
- [ ] Template engine — Variable substitution ({firstName}, {churchName}, etc.)
- [ ] `/app/conversations` — Real-time inbox pulling from messages table
- [ ] `/app/broadcasts` — Compose + send + track delivery

---

## Phase 4: Grace AI Integration ⏳

### Prerequisites (USER decisions needed):

- [ ] **LLM Provider:** OpenAI / Anthropic / Google — need API key
  - Recommendation: **OpenAI GPT-4o** for conversation + function calling
- [ ] **Voice AI Provider:** Choose one:
  - **Vapi.ai** — Easiest, all-in-one AI voice agent (recommended for MVP)
  - **Twilio + OpenAI Realtime API** — More control, complex setup
  - **Bland.ai** — Alternative all-in-one
- [ ] **Grace AI Behavior Definition:**
  - What should Grace do on outbound calls? (visitor follow-up, prayer check-in, reminders)
  - What should Grace do on inbound calls? (answer office phone, route to staff, take messages)
  - What tone/personality? (warm pastoral, professional, casual)
  - Should AI send messages autonomously or draft for human approval?

### Implementation:

- [ ] `src/lib/ai/` — AI client config and helpers
- [ ] `src/lib/ai/prompts.ts` — System prompts for Grace AI personality
- [ ] `src/lib/ai/functions.ts` — Function definitions for AI tool use (look up contact, schedule appointment, log prayer request, etc.)
- [ ] `src/app/api/ai/chat/` — Chat completion endpoint
- [ ] `src/app/api/ai/voice/` — Voice agent webhook handlers
- [ ] Grace AI Settings page (`/app/settings/grace`) — Configure AI behavior, call hours, scripts
- [ ] AI response suggestions in conversations inbox
- [ ] Automated call scheduling and logging
- [ ] Sentiment analysis on conversations

---

## Phase 5: Polish & Production ⏳

- [ ] Re-enable authentication (remove bypass in layout.tsx)
- [ ] Role-based access control (admin, staff, volunteer)
- [ ] Add `.env` to `.gitignore` (currently committed with keys!)
- [ ] Error handling and loading states on all pages
- [ ] Mobile responsiveness testing
- [ ] Data seeding script for demo/development
- [ ] Production deployment (Vercel recommended)
- [ ] Domain setup and SSL

---

## Environment Variables Needed

```env
# Already configured:
DATABASE_URL=             # ✅ Neon PostgreSQL
AUTH_SECRET=              # ✅ NextAuth
STRIPE_SECRET_KEY=        # ✅ Stripe (test)
STRIPE_PUBLISHABLE_KEY=   # ✅ Stripe (test)

# Phase 3 — Communication:
TWILIO_ACCOUNT_SID=       # ⏳ For SMS/calls
TWILIO_AUTH_TOKEN=         # ⏳
TWILIO_PHONE_NUMBER=      # ⏳

# Phase 4 — AI:
OPENAI_API_KEY=           # ⏳ For GPT-4o (or ANTHROPIC_API_KEY)
VAPI_API_KEY=             # ⏳ For AI voice agent (if using Vapi)
```

---

## File Structure Reference

```
src/
├── app/
│   ├── (in-app)/(organization)/app/   # All dashboard pages
│   ├── actions/                        # Server Actions (TO CREATE)
│   └── api/                            # API routes
├── components/
│   ├── grace/                          # Grace AI dashboard components
│   ├── dashboard/                      # Ministry overview components
│   └── ui/                             # shadcn/ui components
├── db/
│   ├── schema/                         # Drizzle schemas
│   └── index.ts                        # DB connection
└── lib/
    ├── ai/                             # AI helpers (TO CREATE)
    ├── twilio/                         # SMS/call helpers (TO CREATE)
    └── ...                             # Existing auth, org, etc.
```

---

## Quick Start for Next Session

To resume work:

1. `cd /Users/studiocomp/Documents/fellowship-360-app`
2. `pnpm dev` to start the server
3. Auth is bypassed — go straight to `http://localhost:3000/app`
4. Pick a phase above and start implementing

**Recommended order:** Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
