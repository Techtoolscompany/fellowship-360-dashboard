# Finance Tracking Dashboard

## Overview
A modern finance tracking dashboard built on Next.js 14 (App Router). The dashboard features a clean "Cash Flow Dashboard" interface with a minimal icon-only sidebar, bright lime green (#bbff00) accents, and financial widgets for tracking income, expenses, and net worth.

## Recent Changes
- **Jan 25, 2026**: Built finance dashboard matching Figma design
  - Minimal 96px icon-only sidebar with diamond logo, nav icons, and dark/light mode toggle
  - Hero section with "Cash Flow Dashboard" headline and pill-shaped search bar
  - KPI row: Total Balance, Inflows ($11,342,882), Outflows ($6,258,444)
  - Net Worth donut chart with color-coded legend
  - Trends and Insights weekly bar chart with lime accent on Thursday
  - Promotional CTA card with green gradient background (#f4ffd4)
  - Debt Status card (dark #343330 background) with progress bar
  - Net Worth line chart with dual SVG paths and 50% increase badge
  - Transaction History table with status badges (Pending/Done)
  - This Month mini card with income/expenses visualization

## Project Architecture

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Inline styles with Plus Jakarta Sans font
- **Charts**: Custom CSS/SVG implementations
- **Icons**: React Icons (Feather Icons)

### Design System
- **Primary Accent**: Bright lime green (#bbff00)
- **Background Gray**: #f2f2f2 for cards and sidebar
- **Border Gray**: #e9e9e9
- **Dark Gray**: #343330 for text and dark cards
- **Card Border Radius**: 24px
- **Pill Buttons**: 360px border radius
- **Font**: Plus Jakarta Sans (Regular, Medium, SemiBold, Bold)

### Key Components
- `FigmaSidebar.jsx` - Minimal icon-only sidebar with theme toggle
- `home/page.js` - Main finance dashboard with all widgets

### Directory Structure
```
duralux_app/
├── src/
│   ├── app/
│   │   ├── (general)/
│   │   │   ├── home/          # Finance dashboard
│   │   │   └── layout.js      # Layout with FigmaSidebar for home
│   │   └── layout.js          # Root layout with font
│   └── components/
│       └── FigmaSidebar.jsx   # Icon-only sidebar
```

## Development

### Running the App
```bash
cd duralux_app && npm run dev -- -p 5000
```

## User Preferences
- Exact Figma design implementation required
- No variations or creative interpretation
- Use inline styles for pixel-perfect matching
