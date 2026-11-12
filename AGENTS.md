# Agent entrypoint — knk-web-app

Before editing, find `knk-workspace/docs/ai-agents/GLOBAL_AGENT_INSTRUCTIONS.md`
and `knk-workspace/docs/ACTIVE_SESSIONS.md` in the local workspace or
[online](https://github.com/PandiO/knk-workspace/tree/main/docs). They govern
cross-repo coordination for all agents. Refresh the tracker, check overlapping
claims, publish a feature-scoped claim, and use the feature's standing branch
from this repo's `next` branch once the global branch model applies (until
then from its current default branch). If access is unavailable, disclose it
and avoid conflicting remote edits. Recheck old handoffs against current code
and plans. See [CLAUDE.md](CLAUDE.md) for repo-specific commands; its
`@...` import is Claude Code syntax and may depend on checkout layout.

This is the React/TypeScript Create React App frontend. Use
`npm run build` and `npm run test:ci` for verification. Confirm scripts in
`package.json` when changing tooling.

## Shipping a change

All documentation lives in `knk-workspace/docs/`; this repo keeps only its README, `AGENTS.md`,
`CLAUDE.md` and `.github/`. Follow `knk-workspace/docs/ai-agents/GLOBAL_AGENT_INSTRUCTIONS.md` § Shipping a change
([online](https://github.com/PandiO/knk-workspace/blob/main/docs/ai-agents/GLOBAL_AGENT_INSTRUCTIONS.md#shipping-a-change-documentation)):
fill in the PR template's Docs impact and Admin steps sections, and ship the essential docs (deploy notes, changelog
entry, status) before merge. At merge, close the feature issue, put the remaining docs in a `documentation`
sub-issue and start a new docs session for it right away with
[the docs-session prompt](https://github.com/PandiO/knk-workspace/blob/main/docs/ai-agents/docs-session-prompt.md).

Docs triggers in this repo: a new or changed page, form, message or wording a player sees means the player guide; an
admin page or form means the admin guide; a new build-time setting (`REACT_APP_*`) means
`guides/production-installation.md`.
