# Agent entrypoint — knk-web-app

Before editing, find `knk-workspace/docs/ai-agents/GLOBAL_AGENT_INSTRUCTIONS.md`
and `knk-workspace/docs/ACTIVE_SESSIONS.md` in the local workspace or
[online](https://github.com/PandiO/knk-workspace/tree/main/docs). They govern
cross-repo coordination for all agents. Refresh the tracker, check overlapping
claims, publish a feature-scoped claim, and use the feature's standing branch
from this repo's current default branch. If access is unavailable, disclose it
and avoid conflicting remote edits. Recheck old handoffs against current code
and plans. See [CLAUDE.md](CLAUDE.md) for repo-specific commands; its
`@...` import is Claude Code syntax and may depend on checkout layout.

This is the React/TypeScript Create React App frontend. Use
`npm run build` and `npm run test:ci` for verification. Confirm scripts in
`package.json` when changing tooling.
