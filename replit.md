# Fellowship 360 Dashboard

## Overview
Fellowship 360 is a comprehensive church management dashboard built on Next.js 14 (App Router). This project was converted from the Duralux admin template to serve as the UI foundation for the Fellowship 360 product.

## Recent Changes
- **Jan 25, 2026**: Complete rebranding from Duralux to Fellowship 360
  - Updated all metadata, titles, and navigation
  - Created new route structure with 11 main modules
  - Implemented 30+ pages with placeholder data
  - Cleaned up legacy Duralux routes

## Project Architecture

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Bootstrap 5 + Sass
- **UI Components**: Custom components based on Duralux patterns
- **Icons**: Feather Icons, React Icons

### Directory Structure
```
duralux_app/
├── src/
│   ├── app/
│   │   ├── (general)/          # Main authenticated pages
│   │   │   ├── home/           # Dashboard overview
│   │   │   ├── people/         # Contacts & Segments
│   │   │   ├── engage/         # Pipeline & Tasks
│   │   │   ├── comms/          # Conversations, Broadcasts, Templates
│   │   │   ├── grace/          # Grace AI calls & settings
│   │   │   ├── care/           # Prayer requests
│   │   │   ├── scheduling/     # Calendar, Appointments, Volunteers
│   │   │   ├── giving/         # Donations, Donors, Pledges
│   │   │   ├── reports/        # Overview, Attendance, Engagement
│   │   │   ├── settings/       # Church profile, Users, Integrations, Billing
│   │   │   └── admin/          # DS Digital super admin pages
│   │   ├── authentication/     # Login, Register, Reset pages
│   │   └── layout.js           # Root layout with providers
│   ├── components/             # Shared UI components
│   ├── utils/                  # Utility functions and fake data
│   └── assets/                 # SCSS styles
└── public/                     # Static assets
```

### Module Structure
1. **Home** - Dashboard with KPIs and recent activity
2. **People** - Contact management and segmentation
3. **Engage** - Visitor pipeline (Kanban) and task management
4. **Comms** - Conversations, broadcasts, and templates
5. **Grace AI** - AI call logs, transcripts, and settings
6. **Prayer & Care** - Prayer request management
7. **Scheduling** - Calendar, appointments, and volunteer scheduling
8. **Giving** - Donations, donor profiles, and pledges
9. **Reports** - Overview, attendance, and engagement reports
10. **Settings** - Church profile, users, integrations, and billing
11. **Admin** - DS Digital super admin (churches and provisioning)

## Development

### Running the App
```bash
cd duralux_app && npm run dev -- -p 5000
```

### Key Files
- `src/utils/fackData/menuList.js` - Navigation menu structure
- `src/components/shared/navigationMenu/` - Sidebar navigation components
- `src/app/(general)/layout.js` - Main authenticated layout

## User Preferences
- No emojis in code or comments
- Follow existing Bootstrap/Sass patterns
- Use placeholder data (real backend integration coming later)

## Notes
- All pages currently use placeholder data
- Authentication is UI-only (no backend enforcement yet)
- Multi-tenant and super-admin features are UI placeholders
