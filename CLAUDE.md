# CLAUDE.md — knk-web-app

## Global project context
@../../docs/ai-agents/GLOBAL_AGENT_INSTRUCTIONS.md

If the import above didn't load (e.g. this repo isn't checked out inside a
`knk-workspace` checkout at `Repository/knk-web-app` on this machine — that's
the current layout, but it may differ on other machines), here are the
essentials it contains:

- Knights and Kings V3 = `knk-web-app` (React/TS) + `knk-web-api`
  (ASP.NET Core) + `knk-plugin` (Spigot/Paper), one shared MySQL DB. Most
  features span all three repos.
- Current priority: reach MVP, siege minigame is the headline feature.
- The developer works on this evenings/weekends around a full-time job —
  don't require synchronous mid-week decisions; leave sessions in a clean,
  resumable state with clear handoff notes.
- Multiple sessions often run in parallel across repos on the same feature.
  Check and update `knk-workspace/docs/ACTIVE_SESSIONS.md` before and after
  working, and scope your claim by feature, not just by repo.
- Docs live in `knk-workspace` under `vision/ architecture/ guides/
  ai-agents/ specs/ backlog/ reports/ archive/` — don't scatter new docs
  elsewhere.

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
