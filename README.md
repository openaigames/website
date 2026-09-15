# OpenAIGames website

The Three.js community game showcase deployed at https://openaigames.lens-frontier.workers.dev/.

The homepage shows featured cartridges. The catalog lists every published game. Game submissions live in [openaigames/community](https://github.com/openaigames/community); contributors use its [submission guide](https://github.com/openaigames/community/blob/main/docs/GAME_SUBMISSION.md), [template](https://github.com/openaigames/community/blob/main/templates/game.json), and [Agent skill](https://github.com/openaigames/community/blob/main/skills/openaigames-submit-demo/SKILL.md).

## Quick submissions

`/#/submit` accepts a title, HTTPS play URL and short description without a GitHub account. Entries are persisted in the production `DB` binding and publicly listed in the **试玩收件箱** on the submission and catalog pages. Submitting requires acknowledgement of public display. Self-submissions and recommendations are explicitly distinguished; names are self-declared. Intake is separate from the reviewed PR catalog: it does not claim author verification or create a GitHub PR automatically. Preview deployments cannot access intake.

`POST /api/submissions` bounds input, restricts URLs, checks same origin and JSON, applies a 30-second per-client throttle, rejects duplicate links and supports idempotent retries. It does not fetch submitted URLs server-side. `GET /api/submissions` paginates 20 entries with optional `q` and `before`; request IDs and throttle keys are never public. Pending records are public immediately; the existing board is unchanged.

Maintainers can export records to prepare a community PR and reversibly hide spam or a record already fully archived in the catalog:

```sh
node scripts/submissions.mjs export /tmp/openaigames-intake.json --remote
node scripts/submissions.mjs archive 123 --remote
node scripts/submissions.mjs restore 123 --remote
```

The commands use existing Wrangler authorization; no public browser admin endpoint or broad GitHub credential is deployed. Obtain creator confirmation and the fields in the community submission guide before preparing `demos/<id>/game.json`. Merge its PR through the existing catalog workflow, then archive the intake record. Archiving hides it without deleting the retained submission. Omit `--remote` for local development.

The five links shared on September 15 are kept in `content/submissions-2026-09-15.json` as recommendations, not attributed to guessed authors. Names and descriptions were checked against their live start pages; this is not a full gameplay review. Import is URL-deduplicated:

```sh
npx wrangler d1 migrations apply DB --remote --config wrangler.cloudflare.json
node scripts/submissions.mjs import content/submissions-2026-09-15.json --remote
```

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

## Chinese and English

`ui/i18n.mjs` switches the interface in place, including modal controls and form validation, without replacing draft input or game iframes. `lib/i18n.mjs` contains interface strings and the shared bilingual search matcher.

`content/game-locales.json` stores reviewed display translations for the seven currently curated games, keyed by playable URL. Each entry pairs original `zh` text with `en` values for names, descriptions, instructions, credits and captions. Add matching fields in both languages when curating another game. These display translations do not overwrite catalog or submission records. Nicknames, player notes and unrecognized user content retain their original text. Covers and embedded games retain their own artwork and supported languages.

Full on-site guides are paired as `static/guides/<guide>.zh.md` and `<guide>.en.md`; maintain both when the submission workflow changes. Run `npm test` and check the room, catalog, game details, forms and guides in both languages after editing translations.

## Touch navigation

On the room canvas, one finger rotates the view, spreading two fingers approaches their midpoint, and bringing them together returns toward the entry overview. Cabinet inspection has a second, closer stop. A tap inserts a cartridge; lifting fingers after a pinch cannot insert one. Phone taps use insertion directly instead of desktop cartridge dragging. Screen menus remain tappable and their game list can be swiped.

`scene/touch-navigation.mjs` owns touch gestures only within the room. Modal forms keep native scrolling and browser zoom; full-window game iframes keep their own touch controls. The room does not add mobile gameplay controls to third-party games. Pointer cancellation, lost focus and orientation changes reset the gesture. Portrait framing uses a wider camera field of view, and coarse-pointer devices use a lower rendering pixel ratio.

The gesture state machine and camera paths have automated regression tests. Responsive browser checks cover 360 × 800, 390 × 844, 430 × 932 and 844 × 390 layouts, including the catalog, submissions, notes, community, game details and guides in Chinese and English. Full-window game framing and unloading on return are also checked. Physical iOS/Android multi-touch still needs a real-device check before claiming device compatibility.
