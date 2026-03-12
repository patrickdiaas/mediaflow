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

## Supabase Integration (Planned)

The Supabase client (`@supabase/supabase-js`) is already installed. When implementing:

1. Create `lib/supabase.ts` with the client singleton:
   ```typescript
   import { createClient } from '@supabase/supabase-js'
   export const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
   )
   ```
2. Add `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Replace mock data calls in pages with `supabase.from('table').select()`
4. Use Next.js Server Components for initial data fetching where possible

**Expected tables (to be defined):**
- `campaigns` — Meta/Google campaign metrics
- `creatives` — Ad creative performance
- `keywords` — Google Ads keywords
- `leads` — Lead Gen conversions from RD Station (webhook ingestion)
- `sales` — E-commerce sales from Digital Manager Guru (webhook ingestion)

---

## What's Not Implemented Yet

- Real data — all pages use mock data from `lib/mock-data.ts`
- Supabase queries and API routes
- Webhook endpoints for RD Station and Digital Manager Guru
- Authentication (no auth layer exists)
- Tests (no Jest/Vitest setup)
- CI/CD pipelines
- Docker/containerization
- Environment variable configuration (`.env.example` missing)
- API routes under `app/api/`
