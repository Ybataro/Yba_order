# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**阿爸的芋圓 (YBA)** — A restaurant chain management system for inventory, ordering, production, scheduling, and financial tracking. Mobile-first SPA deployed on Vercel with Supabase backend.

Three user roles: **admin** (全部管理), **kitchen** (央廚), **store** (門店). Authentication is PIN-based (no OAuth), stored in `user_pins` table with SHA-256 hashing via Web Crypto API. Sessions use `sessionStorage`.

## Commands

```bash
npm run dev          # Dev server on 0.0.0.0:5173 (supports mobile network access)
npm run build        # tsc -b && vite build (type-check then bundle)
npm run lint         # ESLint (flat config, TS + React hooks + React Refresh)
npm test             # vitest run (single run)
npm run test:watch   # vitest (watch mode)
npm run test:ui      # vitest --ui
```

**TypeScript is strict** — `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` are all enabled. Code must pass `tsc -b` before building.

## Tech Stack

- **React 19** + **TypeScript 5.9** + **Vite 7**
- **React Router v7** with lazy-loaded pages, two layout modes: `WideLayout` (admin schedule) and `NarrowLayout` (max 512px, all other pages)
- **Zustand** for state management — stores in `src/stores/`, all initialized via `useInitStores()` hook on app mount
- **Supabase** (PostgreSQL + Realtime) — client in `src/lib/supabase.ts`, migrations in `supabase/migrations/`
- **Tailwind CSS 3** with custom design tokens in `tailwind.config.js`
- **react-hook-form** + **zod** for form validation
- **date-fns** for date utilities
- **jspdf** + **xlsx** for PDF/Excel export
- **Telegram Bot API** for notifications (`src/lib/telegram.ts`)
- **sonner** for toast notifications (wrapped in `src/components/Toast.tsx`)

## Architecture

### Path Alias
`@/` maps to `./src/` (configured in both `vite.config.ts` and `tsconfig.app.json`).

### Directory Layout

```
src/
├── pages/           # Route pages, organized by role
│   ├── store/       # Store operations (inventory, order, settlement, etc.)
│   ├── kitchen/     # Central kitchen (shipment, production, material stock)
│   └── admin/       # Admin panel (product/staff/recipe management, analytics)
├── components/      # Shared UI components + sub-folders (NavComponents/, schedule/)
├── stores/          # Zustand stores (useProductStore, useScheduleStore, etc.)
├── hooks/           # Custom hooks (useInitStores, useNotifications, useSupplyTracker)
├── lib/             # Utility modules (auth, suggestion algorithm, PDF export, offline sync)
├── data/            # Static data definitions (product catalog, categories)
└── test/            # Test setup (vitest + jsdom)
```

### Routing (src/App.tsx)
- `/store/:storeId/*` — store role pages (requires `AuthGuard requiredRole="store"`)
- `/kitchen/*` — kitchen role pages (requires `AuthGuard requiredRole="kitchen"`)
- `/admin/*` — admin pages (requires `AuthGuard requiredRole="admin"`)
- `/admin/schedule` — full-width layout, requires `ScheduleGuard` (any role with `can_schedule` flag)
- Default redirect: `/` → `/store/lehua`

### State Management Pattern
Each Zustand store follows the same pattern:
1. Define interface with `initialized` flag
2. `initialize()` fetches from Supabase, merges with static fallback data
3. CRUD methods update both local state and Supabase
4. All stores initialized in parallel via `useInitStores()` hook

### Supabase Integration
- Client created in `src/lib/supabase.ts` (returns `null` if env vars missing)
- All DB access via `supabase.from('table').select/insert/update/delete`
- RLS enabled on all tables with permissive policies
- Migrations in `supabase/migrations/` (timestamped SQL files)
- Edge Functions in `supabase/functions/`

### Offline Support
- IndexedDB queue (`src/lib/offlineQueue.ts`) stores pending operations
- `submitWithOffline()` wrapper auto-queues on network failure
- `OfflineBanner` component shows connection status
- Auto-sync when coming back online

## Design Tokens (tailwind.config.js)

- **Brand colors**: `brand-lotus`, `brand-mocha`, `brand-silver`, `brand-blush`, `brand-camel`, `brand-amber`, `brand-oak`
- **Surface colors**: `surface-page` (#F5F0EB), `surface-card`, `surface-section`, `surface-input`, `surface-filled`
- **Status colors**: `status-success`, `status-warning`, `status-danger`, `status-info`
- **Border radius**: `rounded-btn` (12px), `rounded-card` (16px), `rounded-input` (10px), `rounded-sheet` (20px), `rounded-tag` (8px)
- **Font**: `font-sans` (Noto Sans TC), `font-num` (SF Pro Display/Roboto for numbers)
- **Dark mode**: class-based (`darkMode: 'class'`), CSS variables in `src/index.css`

## Key Business Logic

- **Order suggestion algorithm** (`src/lib/suggestion.ts`): Calculates recommended order quantities based on base stock, previous usage, weather adjustments (high temp → +20% ice products; rain → -15% dry goods), and history patterns
- **Linked inventory**: Products can link to other items (e.g., sugarcane juice links to ice). Configured via `linkedInventoryIds` in `store_products`
- **Dual-unit support**: Products have `boxUnit`/`boxRatio`/`bagWeight` for unit conversion (kg ↔ bags, boxes ↔ pieces)
- **Shelf life tracking**: Products have `shelfLifeDays`, inventory entries track expiry dates
- **Leave workflow**: Submit → pending → approve/reject (with Telegram notification)
- **Cost analysis**: Recipe-based cost calculation with material price tracking (`src/lib/costAnalysis.ts`, `src/lib/profitLoss.ts`)

## Conventions

- UI text and commit messages are in **繁體中文 (Traditional Chinese)**
- Commit format: `feat:`, `fix:`, `chore:` prefix with Chinese description
- Pages are **default-exported** and **lazy-loaded** in App.tsx
- Components use Tailwind utility classes directly (no CSS modules)
- Supabase column names use `snake_case`; TypeScript properties use `camelCase`
- Environment variables prefixed with `VITE_` for client access

## Environment Variables

```
VITE_SUPABASE_URL      # Supabase project URL
VITE_SUPABASE_ANON_KEY # Supabase anonymous key
VITE_CWA_API_KEY       # Taiwan Central Weather Bureau API key
```
