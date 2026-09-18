# Development and deployment

[Back to the project homepage](../README.md)

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

Latest deployment: [game selection and active-time analytics · 2026-09-18](RELEASE_2026-09-18_ATTENTION.md).

Production and preview now run in the domain account (`1df8f334169206788cc480fb569f1761`). Use `npm run cf -- <wrangler arguments>` to select the isolated local credentials without changing other projects’ Wrangler login. The submissions maintainer commands select the same credentials automatically. On another computer, sign in to the domain account or supply its scoped Cloudflare API token. See [the migration record](CLOUDFLARE_MIGRATION.md).

- `wrangler.cloudflare.json`: the existing production Worker, `DB` for the shared message board, and `CATALOG` for published catalog data.
- `wrangler.preview.json`: a separate public preview Worker with **only** the catalog database. It cannot access the board database. `/community/pr/<number>` opens a PR preview; `?revision=<head SHA>` pins its version.
- `catalog-migrations/`: schema for the separate catalog D1 database. `drizzle/`: existing, immutable board migrations.
- `lib/catalog.mjs`: metadata validation, mirrored in community `tooling/catalog/schema.mjs`; keep the two compatible when extending the format.

The community's trusted default-branch workflow reads PR metadata as JSON, validates it, and POSTs a bounded catalog snapshot to the preview Worker's `/internal/catalog`. The narrow `CATALOG_PUBLISH_SECRET` is stored in Cloudflare and GitHub Secrets; it has no Cloudflare account permissions. A monotonic workflow sequence prevents older jobs replacing newer snapshots. Invalid PR revisions are marked unavailable. Production retains its previous catalog if publication fails.

Catalog publication does not redeploy the website. GET `/api/catalog` uses `Cache-Control: no-store`; browser reads refresh after 30 seconds or a page reload. Main-branch publications use the production channel; PR publications use independent channels. Closed and merged PRs are labeled, and historical snapshots remain readable by revision. Preview feedback goes to GitHub and cannot be submitted to the production message board. First-party visitor, game-selection, game-open and active website time statistics are available to administrators at `/admin#analytics`; no GA4 or third-party analytics script is used. See [analytics definitions and privacy](ANALYTICS.md).

Deploy code changes with `npm run build`, `npm test`, then `npm run cf -- deploy --config wrangler.cloudflare.json` (or `wrangler.preview.json`). Apply catalog migrations with `npm run cf -- d1 migrations apply CATALOG --remote --config wrangler.preview.json` when they change. Website-code PR deployments are not automated by the community data workflow.

The previous Sites deployment remains available and continues to relay its board through the old gateway. That gateway verifies its existing relay signature and signs the request again for the new primary; visitor rate limits remain separate. Its source registration and source-repository history are not part of this checkout.

## Quick-submission operations

`/#/submit` accepts a title, HTTPS play URL and short description without a GitHub account. New entries are private until an administrator approves them at `/admin`. Approved entries appear in the community playtest catalog; rejected and archived entries remain private. Author names are self-declared. Intake is separate from the PR-reviewed formal catalog and does not create PRs automatically.

All GitHub users can sign in through the room’s account button. Only GitHub user ID **102272920** (currently **mattheliu**) has moderation permissions. The server checks this immutable ID, not a username supplied by the browser. The app requests public identity only, with no repository or organization scope.

The bilingual review desk supports search, status filters, game previews, approval, rejection, archiving and restoration. Rejection and archiving require a reason. Every change records its actor, timestamp and note; concurrent stale changes return 409. Quick submissions retain their existing input limits, duplicate-link checks, idempotent retries and rate limits. Private submissions cannot be read through the public list or ID endpoints.

Migration `0002_living_barracuda.sql` preserves submissions that were already public before moderation as approved; previously archived records stay archived. Run it only as part of the coordinated release described in [AUTH_AND_MODERATION.md](AUTH_AND_MODERATION.md). Deploy application code and this migration together; a catalog-only publish does not deploy authentication or moderation.

Maintainers can export intake to prepare a community PR, or import recommendations into the pending queue:

```sh
node scripts/submissions.mjs export /tmp/openaigames-intake.json --remote
node scripts/submissions.mjs import content/submissions-2026-09-15.json --remote
```

These commands use existing Wrangler authorization. Review status changes belong in the authenticated review desk so their audit history is retained. Obtain creator confirmation and complete the community submission guide before preparing `demos/<id>/game.json`. After the formal PR is merged, archive its duplicate intake record in the desk. Omit `--remote` for local development.

## Translation maintenance

`ui/i18n.mjs` switches the interface in place, including modal controls and form validation, without replacing draft input or game iframes. `lib/i18n.mjs` contains interface strings and the shared bilingual search matcher.

`content/game-locales.json` stores reviewed display translations for the seven currently curated games, keyed by playable URL. Each entry pairs original `zh` text with `en` values for names, descriptions, instructions, credits and captions. Add matching fields in both languages when curating another game. These display translations do not overwrite catalog or submission records. Nicknames, player notes and unrecognized user content retain their original text. Covers and embedded games retain their own artwork and supported languages.

Full on-site guides are paired as `static/guides/<guide>.zh.md` and `<guide>.en.md`; maintain both when the submission workflow changes. Run `npm test` and check the room, catalog, game details, forms and guides in both languages after editing translations.
