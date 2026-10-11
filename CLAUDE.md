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
  block embedded in `package.json` (extends `react-app`, `react-app/jest`,
  plus a `no-console` override for `services/`, `apiClients/` and
  `components/auth/`). The old unused flat `eslint.config.js` was removed
  (KNG-71).

**Structure:**
- Pages/routes: `src/pages/` (with `admin/`, `auth/` subfolders)
- Shared components: `src/components/`
- API clients (REST, one file per resource): `src/apiClients/`, built on
  `src/apiClients/objectManager.ts` + `src/services/serviceCall.ts`
- State management: React Context (`src/contexts/`, e.g. `AuthContext.tsx`)
  — no Redux/Zustand in use
- Types: `src/types/` (`domain/`, `dtos/`, `uiObjectConfig/`)

**Conventions:**
- Styling: Tailwind CSS only (Fluent UI was removed 2026-10-08, KNG-71:
  only its provider was used). No CSS modules or styled-components.
  Note `src/index.css` gives `h1`-`h3` `text-slate-900`, so headings on
  dark backgrounds need an explicit text colour.
- Dependency changes: the lock file is valid for **npm 11**; npm 10
  rejects it and regenerating with npm 10 churns it (see `f077570`).
  Use npm 11 (`npx npm@11 …`).
- No Prettier config in the repo — formatting relies on ESLint only
- Auth tokens: managed by `src/utils/tokenService.ts` — stored in
  `localStorage` if "remember me" was set at login, `sessionStorage`
  otherwise; attached as `Authorization: Bearer <token>` in
  `src/services/serviceCall.ts`

**Talks to:** `knk-web-api` over REST (no GraphQL). Base URL resolves via
`ConfigurationHelper.gatewayApiUrl` (`src/utils/config-helper.ts`) →
`appConfig.api.baseUrl` (`src/config/appConfig.ts`), which reads the
build-time `REACT_APP_API_BASE_URL` (default `/api` in production builds,
`http://localhost:5294/api` otherwise; see README "Configuration"). The
refresh token is an HttpOnly cookie on `/api/Auth`; every refresh goes
through the single-flight `src/services/sessionRefresh.ts`, which
`serviceCall.ts` uses to retry a request once after a 401.
