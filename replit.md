# Fellowship 360 Dashboard

## Overview
Fellowship 360 is a comprehensive church management dashboard built on Next.js 14 (App Router). This project was converted from the Duralux admin template to serve as the UI foundation for the Fellowship 360 product.

## Recent Changes
- **Jan 25, 2026**: Enhanced sidebar navigation
  - Collapsible icon-only mode with localStorage persistence
  - Section groupings (Main, Communication, Operations, Administration)
  - Notification badges on Engage (5), Comms (3), and Care (2)
  - Tooltips for collapsed mode navigation
  - Quick Add modal for common CRM actions (7 actions with keyboard accessibility)
  - Fixed navigation to use buttons instead of links for parent menus
  - Added focus trapping and ARIA attributes for accessibility

- **Jan 25, 2026**: World-class UI enhancements
  - Dark mode toggle with full theme persistence (navigation, header, skin)
  - Command palette with Cmd/Ctrl+K keyboard shortcut for quick navigation
  - Drag-and-drop Kanban board using @hello-pangea/dnd with toast notifications
  - Toast notification system (success, error, warning, info types)
  - CSV export functionality for data tables
  - Skeleton loading components with multiple variants (Card, KPI, Table, Chart)
  - Micro-interactions SCSS with hover effects, animations, and transitions
  - Mobile responsive layouts with breakpoint handling
  - Onboarding tour for first-time users
  - Empty state components with custom illustrations

- **Jan 25, 2026**: Enhanced pages with rich data visualizations and charts
  - Giving/Donations: KPI cards, weekly giving trend area chart, fund breakdown donut, monthly bar chart
  - Reports/Overview: Attendance trend, visitor conversion donut, monthly giving, engagement radar, growth metrics
  - Engage/Pipeline: Funnel chart, weekly activity chart, enhanced Kanban with priority badges
  - People/Segments: Ministry involvement table with engagement progress bars, distribution donut, status cards

- **Jan 25, 2026**: Dashboard improvements and navigation fixes
  - Fixed menu navigation: single-item menus now link directly without dropdowns
  - Improved home dashboard with rich widgets (KPI cards, pipeline summary, events, donors, activity)
  - Created new Fellowship 360-specific components (ChurchOverviewStatistics, VisitorPipelineChart, UpcomingEvents, etc.)
  - Added church-specific placeholder data in churchStatisticsData.js
  
- **Jan 25, 2026**: Complete rebranding from Duralux to Fellowship 360
  - Updated all metadata, titles, and navigation
  - Created new route structure with 11 main modules
  - Implemented 30+ pages with placeholder data
  - Cleaned up legacy Duralux routes

## Project Architecture

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Bootstrap 5 + Sass
- **Charts**: ApexCharts (react-apexcharts)
- **Drag & Drop**: @hello-pangea/dnd
- **UI Components**: Custom components based on Duralux patterns
- **Icons**: Feather Icons, React Icons

### Reusable Components
- `Skeleton.jsx` - Loading skeleton components (Card, KPI, Table, Chart, Avatar, Text variants)
- `Toast.jsx` - Toast notification system with ToastProvider context
- `CommandPalette.jsx` - Global search with Cmd+K keyboard shortcut
- `EmptyState.jsx` - Empty state displays with custom illustrations
- `CsvExport.jsx` - CSV export utility for data tables
- `OnboardingTour.jsx` - Step-by-step onboarding tour for new users

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
