# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

This is a **shop backend management system** built on top of the vben-admin open-source framework. The active app variant is **web-naive** (Naive UI). Other app variants (web-antd, web-ele, web-tdesign, web-antdv-next) are retained as reference but not actively developed.

- **Frontend**: Vue 3 + Naive UI + TypeScript
- **Backend**: Node.js (NestJS/Express)
- **Database**: PostgreSQL
- **API Pattern**: RESTful, typed services under `apps/web-naive/src/api/`

## Commands

```bash
# Install
pnpm install

# Dev (primary app)
pnpm dev:naive         # Shop backend (Naive UI)
pnpm dev:play          # Playground
pnpm dev:docs          # Documentation site

# Build
pnpm build             # All apps
pnpm build:naive       # Shop backend only

# Lint & Format
pnpm lint              # ESLint + OxLint + Stylelint (via vsh)
pnpm format            # OxFmt formatting (via vsh)

# Type check
pnpm check:type        # All packages via turbo

# Tests
pnpm test:unit         # Vitest with happy-dom (excludes e2e/)
pnpm test:e2e          # Playwright e2e via turbo

# Other checks
pnpm check:circular    # Circular dependency detection
pnpm check:dep         # Dependency validation
pnpm check:cspell      # Spell check

# Run single test file
npx vitest run packages/stores/src/modules/tabbar.test.ts

# Backend (NestJS, port 3100)
pnpm dev:backend                                           # Start NestJS in watch mode
pnpm build:backend                                         # Build NestJS for prod
cd apps/backend && pnpm prisma:migrate:dev                 # Apply DB migrations (dev)
cd apps/backend && pnpm prisma:seed                        # Seed admin user (admin/admin123)
cd apps/backend && pnpm test:unit                          # Backend unit tests
cd apps/backend && pnpm test:integration                   # Backend e2e tests (requires PG)

# Docker
docker compose -f docker-compose.dev.yml up -d             # Dev DB (PostgreSQL + MinIO)
docker compose -f docker-compose.prod.yml up -d --build    # Full prod stack (frontend + backend + DB)
```

## Architecture

This is a **pnpm monorepo** with Turborepo orchestration, forked from vben-admin. The primary development target is `apps/web-naive/` (Naive UI shop backend).

### Layer Structure

```
apps/
  web-naive/             → PRIMARY: Shop backend frontend (Naive UI)
  backend/               → NestJS REST API (auth + users + menu, port 3100)
  backend-mock/          → Nitro mock (legacy; web-naive switched to backend in dev)
  web-antd/              → Reference only (Ant Design Vue)
  web-ele/               → Reference only (Element Plus)
  web-tdesign/           → Reference only (TDesign)
  web-antdv-next/        → Reference only (Antdv Next)

packages/@core/          → UI-agnostic core (shared across all apps)
  base/                  → Foundational utilities (shared, typings, icons, tokens)
  ui-kit/                → Headless UI components (shadcn-ui via reka-ui, form-ui, popup-ui, layout-ui, menu-ui, tabs-ui)
  composables/           → Shared Vue composables
  preferences/           → App preferences/settings system

packages/effects/        → Feature modules consumed by apps
  access/                → Permission & route access control
  common-ui/             → Shared UI components (with UI-library-specific adapters)
  hooks/                 → Business-level composables
  layouts/               → Layout system (sidebar, header, tabs)
  plugins/               → Plugin integrations (tiptap, vxe-table, etc.)
  request/               → HTTP client (axios wrapper with interceptors)

packages/types/          → Shared DTO/enum/types between web-naive and backend (UserRole, LoginDto, etc.)
packages/stores/         → Pinia stores (user, access, tabbar)
packages/locales/        → i18n (vue-i18n)
packages/utils/          → Pure utility functions
packages/icons/          → Icon sets (lucide-vue-next, @iconify)

internal/                → Build tooling (not published)
  vite-config/           → Shared Vite configuration
  tsconfig/              → Shared TypeScript configs
  tailwind-config/       → Tailwind CSS 4 preset
  lint-configs/          → ESLint, Stylelint configs
  node-utils/            → Node.js build helpers

scripts/                 → CLI tools
  vsh/                   → Monorepo CLI (lint, check-circular, check-dep, publint)
```

### Key Patterns

- **Workspace imports**: Apps import shared packages via `@vben/*` (e.g., `@vben/hooks`, `@vben/stores`, `@vben/request`)
- **App-local imports**: Within an app, use `#/*` path alias (maps to `./src/*`)
- **Component conventions**: `<script setup lang="ts">` with `defineOptions({ name: 'ComponentName' })`, `defineProps<{}>()`, `defineEmits<{}>()`
- **Preferences system**: `@vben/preferences` manages theme, layout, locale settings with persistence
- **Request layer**: `@vben/request` wraps axios; apps configure interceptors for auth tokens
- **Access control**: Route-based permissions via `@vben/access` + store-driven guards
- **Styling**: Tailwind CSS 4 utility-first; UI kit uses reka-ui (headless) + shadcn-style composition

### Formatting & Linting

- **OxFmt** for code formatting (`.ts`, `.tsx`, `.js`, `.jsx`, `.vue`, `.mts`, `.mjs`)
- **OxLint** + **ESLint** for linting
- **Stylelint** for CSS/SCSS
- **Lefthook** for git hooks (pre-commit runs lint on staged files)
