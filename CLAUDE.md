# CLAUDE.md — MediaFlow

## Project Overview

**MediaFlow** is a paid media performance dashboard for marketing agencies. It centralizes analytics for Meta Ads and Google Ads campaigns across two business models:

- **Lead Gen** — B2B lead capture (RD Station CRM integration)
- **E-commerce** — B2C sales (Digital Manager Guru integration)

Real data will be ingested from **Supabase** via webhooks from RD Station (leads) and Digital Manager Guru (sales). The frontend is currently running on mock data while the backend integration is built out.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Recharts · Supabase

---

## Repository Structure

```
mediaflow/
├── app/                      # Next.js App Router
│   ├── layout.tsx            # Root layout — wraps app with DashboardProvider
│   ├── page.tsx              # Overview page (KPIs, trend chart, funnel)
│   ├── campanhas/page.tsx    # Campaigns analytics table
│   ├── criativos/page.tsx    # Creatives/ads performance
│   ├── keywords/page.tsx     # Keywords (Google Ads only)
│   ├── vendas/page.tsx       # Sales (E-commerce mode only)
│   └── globals.css           # Global styles, Tailwind directives, scrollbar
├── components/               # Reusable UI components
│   ├── sidebar.tsx           # Navigation + mode/platform toggles
│   ├── header.tsx            # Filter dropdowns (client, campaign, product, period)
│   ├── kpi-card.tsx          # Metric card with trend indicator
│   ├── trend-chart.tsx       # Line chart (Recharts) with toggleable metrics
│   ├── funnel.tsx            # Conversion funnel visualization
│   └── data-table.tsx        # Generic sortable table — DataTable<T>
├── lib/
│   ├── dashboard-context.tsx # React Context — global dashboard state
│   └── mock-data.ts          # All mock data and TypeScript interfaces
├── tailwind.config.ts        # Custom color palette and font config
├── next.config.mjs           # Next.js configuration
└── tsconfig.json             # TypeScript strict mode
```

---

## Architecture

### State Management

The app uses a single React Context (`DashboardContext`) defined in `lib/dashboard-context.tsx`. It is provided at the root layout level and consumed by all pages and components.

**Context state:**
```typescript
mode: "lead-gen" | "ecommerce"
platform: "meta" | "google"
client: string
campaign: string
product: string   // ecommerce only
period: string
```

All data filtering and conditional rendering is driven by this context. When adding new state (e.g., date range pickers, additional filters), extend this context.

### Conditional UI by Mode/Platform

Several pages and UI elements are gated by `mode` and `platform`:

| Route | Visible when |
|---|---|
| `/keywords` | `platform === "google"` |
| `/vendas` | `mode === "ecommerce"` |
| Funnel component | Always, but metrics differ by mode |

Pages that don't apply to the current mode/platform should show an inline alert (see `keywords/page.tsx` and `vendas/page.tsx` for the existing pattern).

### Data Flow (Current — Mock)

```
DashboardContext (mode, platform, filters)
    └── Pages read context
        └── Filter mock data from lib/mock-data.ts
            └── Pass to components (DataTable, KPICard, TrendChart, Funnel)
```

### Data Flow (Target — Supabase)

```
Webhooks
  ├── RD Station → Supabase (leads table) — Lead Gen mode
  └── Digital Manager Guru → Supabase (sales table) — E-commerce mode

Ad Platform APIs (future)
  ├── Meta Ads API → Supabase (campaigns, creatives, ad metrics)
  └── Google Ads API → Supabase (campaigns, keywords, ad metrics)

Frontend
  └── Supabase JS client → replace mock-data calls with real queries
```

When integrating Supabase, replace the mock data imports in each page with Supabase queries. Keep the TypeScript interfaces in `lib/mock-data.ts` as the source of truth for data shapes until a dedicated `lib/types.ts` is created.

---

## Key Conventions

### TypeScript

- Strict mode is enabled (`tsconfig.json`). Do not disable it.
- All data structures must be typed. Interfaces are currently in `lib/mock-data.ts`; when adding Supabase, move them to `lib/types.ts`.
- The `DataTable` component is generic: `DataTable<T extends object>`. Column definitions use `keyof T` for type safety.

### Tailwind CSS

Use only the custom color tokens defined in `tailwind.config.ts`. Do not use raw Tailwind color classes (e.g., `text-gray-500`) — use the semantic tokens:

| Token | Usage |
|---|---|
| `bg` | Page background (`#090b10`) |
| `card` | Card/panel background (`#0e1018`) |
| `border` / `border-light` | Borders and dividers |
| `text-primary` | Main body text |
| `text-secondary` | Secondary/label text |
| `text-muted` | Disabled/placeholder text |
| `accent` / `accent-dim` | Positive values, CTAs (green) |
| `blue` / `blue-dim` | Investment/spend metrics |
| `gold` / `gold-dim` | CPL, CPA metrics |
| `red` / `red-dim` | Negative trends, losses |

The app is **dark-only** — there is no light mode. Do not add light mode variants.

**Fonts:** `font-sans` → DM Sans, `font-mono` → DM Mono (configured in Tailwind, loaded via Google Fonts in `globals.css`).

### Component Patterns

- Pages always include `<Sidebar />` and `<Header />` at the top of their layout.
- KPI metrics are always rendered with `<KPICard />` — never build inline metric displays.
- Tables always use `<DataTable<T> />` with typed column definitions.
- Charts use Recharts with the custom color tokens (pass as hex strings, not CSS variables).
- Conditional page alerts (wrong mode/platform) follow this pattern:
  ```tsx
  <div className="flex items-center gap-2 text-text-secondary text-sm">
    <AlertCircle size={16} />
    <span>Esta seção está disponível apenas para ...</span>
  </div>
  ```

### Naming Conventions

- Files: `kebab-case.tsx`
- Components: `PascalCase`
- Context hooks: `use` prefix (e.g., `useDashboard`)
- Mock data exports: `mockKPIData`, `mockCampaigns`, etc.
- Portuguese is used for route names and UI labels (`/campanhas`, `/criativos`, `/vendas`); code identifiers are in English.

---

## Development Workflow

### Setup

```bash
npm install
npm run dev        # http://localhost:3000
```

### Available Scripts

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run start      # Start production server
npm run lint       # Run ESLint (next lint)
```

### Adding a New Page

1. Create `app/<route>/page.tsx`
2. Import `Sidebar` and `Header` components
3. Consume `useDashboard()` from `lib/dashboard-context.tsx` for filtering
4. Add the route to the navigation array in `components/sidebar.tsx`
5. Gate visibility with `mode`/`platform` checks if needed

### Adding a New KPI or Metric

1. Add the field to the relevant interface in `lib/mock-data.ts`
2. Add mock values to the mock data objects
3. Render with `<KPICard />` passing the correct props

### Adding a New Filter

1. Add the state field to `DashboardContext` in `lib/dashboard-context.tsx`
2. Add the dropdown to `components/header.tsx`
3. Use the new context value in pages to filter data

---

## Supabase Integration

Project: `ntsrfoggrltffpefkshy.supabase.co`

**Client setup:** `lib/supabase.ts` exports two clients:
- `supabase` — public client (anon key), used in frontend components
- `createServiceClient()` — server-side only (service role key), used in webhook handlers

**Environment variables** — see `.env.example` for all required vars. Copy to `.env.local` to run locally.

**Schema** — defined in `supabase/schema.sql`, already applied to the Supabase project.

**Tables (live):**
- `leads` — Lead Gen conversions ingested from RD Station webhooks
- `sales` — E-commerce orders ingested from Digital Manager Guru webhooks
- `campaigns` — Meta/Google campaign metrics (to be populated by ad platform sync)
- `creatives` — Ad creative performance (to be populated by ad platform sync)
- `keywords` — Google Ads keywords (to be populated by ad platform sync)

**Webhook endpoints (implemented, pending deployment):**
- `POST /api/webhooks/rdstation?secret=SECRET` — receives RD Station conversions → inserts into `leads`
- `POST /api/webhooks/dmguru?secret=SECRET` — receives DMGuru approvals/refunds → upserts into `sales`

To replace mock data in a page with real Supabase data:
```typescript
import { supabase } from '@/lib/supabase'

// Example: fetch leads count for a campaign
const { data, error } = await supabase
  .from('leads')
  .select('*')
  .eq('platform', 'meta')
  .eq('utm_campaign', campaignName)
```

---

## What's Not Implemented Yet

- Frontend connected to real Supabase data (pages still use `lib/mock-data.ts`)
- Webhook secrets configured in `.env.local` (`RD_STATION_WEBHOOK_SECRET`, `DMGURU_WEBHOOK_SECRET`)
- RD Station and DMGuru webhook URLs configured in each platform
- Meta Ads API sync (app created, token pending)
- Google Ads API sync (not started)
- Authentication (no auth layer exists)
- Tests (no Jest/Vitest setup)
- CI/CD pipelines
