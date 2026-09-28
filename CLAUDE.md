# CLAUDE.md — knk-web-app

## Global project context
@../../docs/ai-agents/GLOBAL_AGENT_INSTRUCTIONS.md

Read `AGENTS.md` and the current `knk-workspace/docs/ACTIVE_SESSIONS.md`
before editing. The import above is Claude Code syntax for the nested
`knk-workspace/Repository/knk-web-app` layout. If it does not resolve, locate
the shared file in the workspace or open it from knk-workspace's current
default branch. Do not rely on a dated handoff without checking the current
branches, issue, plan and tracker.

## Repo-specific conventions (knk-web-app)

**Stack:** React + TypeScript, bootstrapped with Create React App
(`react-scripts` 5.0.1) — not Vite or Next.js.

**Common commands** (from `package.json`):
- Install: `npm install`
- Dev server: `npm start`
- Build: `npm run build`
- Test (watch mode): `npm test`
- Test (CI, non-interactive): `npm run test:ci`
- Coverage: `npm run test:coverage`
- E2E tests (Cypress): `npm run test:e2e` (or `npm run cypress:open` for the
  interactive runner)
- Lint: there is no dedicated `npm run lint` script. ESLint runs
  automatically during `npm start`/`npm run build` via the `eslintConfig`
  block embedded in `package.json` (extends `react-app`, `react-app/jest`).
  A separate `eslint.config.js` (flat config, ESLint 9/Vite-style) also
  exists at the repo root but isn't wired to any script — it appears to be
  an unused leftover; don't assume it's what actually lints this project.

**Structure:**
- Pages/routes: `src/pages/` (with `admin/`, `auth/` subfolders)
- Shared components: `src/components/`
- API clients (REST, one file per resource): `src/apiClients/`, built on
  `src/apiClients/objectManager.ts` + `src/services/serviceCall.ts`
- State management: React Context (`src/contexts/`, e.g. `AuthContext.tsx`)
  — no Redux/Zustand in use
- Types: `src/types/` (`domain/`, `dtos/`, `uiObjectConfig/`)

**Conventions:**
- Styling: Tailwind CSS + Fluent UI React Components
  (`@fluentui/react-components`) — both are used, no CSS modules or
  styled-components found
- No Prettier config in the repo — formatting relies on ESLint only
- Auth tokens: managed by `src/utils/tokenService.ts` — stored in
  `localStorage` if "remember me" was set at login, `sessionStorage`
  otherwise; attached as `Authorization: Bearer <token>` in
  `src/services/serviceCall.ts`

**Talks to:** `knk-web-api` over REST (no GraphQL). Base URL resolves via
`ConfigurationHelper.gatewayApiUrl` (`src/utils/config-helper.ts`) →
`appConfig.api.baseUrl` (`src/config/appConfig.ts`) — not a `REACT_APP_*`
environment variable.
