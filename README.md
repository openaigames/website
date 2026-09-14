# OpenAIGames website

The Three.js community game showcase deployed at https://openaigames.lens-frontier.workers.dev/.

The homepage shows featured cartridges. The catalog lists every published game. Game submissions live in [openaigames/community](https://github.com/openaigames/community); contributors use its [submission guide](https://github.com/openaigames/community/blob/main/docs/GAME_SUBMISSION.md), [template](https://github.com/openaigames/community/blob/main/templates/game.json), and [Agent skill](https://github.com/openaigames/community/blob/main/skills/openaigames-submit-demo/SKILL.md).

## Local development

```sh
npm ci
npm run build
npm run db:local
npm run dev
npm test
```

The local configuration falls back to the included published catalog when no `CATALOG` binding is present. The board uses the local D1 binding. Tests use isolated databases and never write test comments to the public board.

## Production and previews

- `wrangler.cloudflare.json`: the existing production Worker, `DB` for the shared message board, and `CATALOG` for published catalog data.
- `wrangler.preview.json`: a separate public preview Worker with **only** the catalog database. It cannot access the board database. `/community/pr/<number>` opens a PR preview; `?revision=<head SHA>` pins its version.
- `catalog-migrations/`: schema for the separate catalog D1 database. `drizzle/`: existing, immutable board migrations.
- `lib/catalog.mjs`: metadata validation, mirrored in community `tooling/catalog/schema.mjs`; keep the two compatible when extending the format.

The community's trusted default-branch workflow reads PR metadata as JSON, validates it, and POSTs a bounded catalog snapshot to the preview Worker's `/internal/catalog`. The narrow `CATALOG_PUBLISH_SECRET` is stored in Cloudflare and GitHub Secrets; it has no Cloudflare account permissions. A monotonic workflow sequence prevents older jobs replacing newer snapshots. Invalid PR revisions are marked unavailable. Production retains its previous catalog if publication fails.

Catalog publication does not redeploy the website. GET `/api/catalog` uses `Cache-Control: no-store`; browser reads refresh after 30 seconds or a page reload. Main-branch publications use the production channel; PR publications use independent channels. Closed and merged PRs are labeled, and historical snapshots remain readable by revision. Preview feedback goes to GitHub and cannot be submitted to the production message board. No GA4 measurement ID or analytics script is configured.

Deploy code changes with `npm run build`, `npm test`, then `npx wrangler deploy --config wrangler.cloudflare.json` (or `wrangler.preview.json`). Apply catalog migrations with `npx wrangler d1 migrations apply CATALOG --remote --config wrangler.preview.json` when they change. Website-code PR deployments are not automated by the community data workflow.

The previous Sites deployment remains available and continues to relay its board to production with the existing `BOARD_RELAY_SECRET`. Its source registration and source-repository history are not part of this checkout.

## Content and licensing

Original website code is MIT-licensed. Third-party game assets, fonts, and library licenses remain separate; see `THIRD_PARTY_NOTICES.md`. Secrets and player records do not belong in this repository.
