# OpenAIGames website

The Three.js community game showcase deployed at https://openaigames.org/. The previous https://openaigames.lens-frontier.workers.dev/ address remains a gateway to the same site and databases.

The homepage shows featured cartridges. The catalog lists every published game. Game submissions live in [openaigames/community](https://github.com/openaigames/community); contributors use its [submission guide](https://github.com/openaigames/community/blob/main/docs/GAME_SUBMISSION.md), [template](https://github.com/openaigames/community/blob/main/templates/game.json), and [Agent skill](https://github.com/openaigames/community/blob/main/skills/openaigames-submit-demo/SKILL.md).

## Quick submissions

`/#/submit` accepts a title, HTTPS play URL and short description without a GitHub account. New entries are private until an administrator approves them at `/admin`. Approved entries appear in the community playtest catalog; rejected and archived entries remain private. Author names are self-declared. Intake is separate from the PR-reviewed formal catalog and does not create PRs automatically.

All GitHub users can sign in through the room’s account button. Only GitHub user ID **102272920** (currently **mattheliu**) has moderation permissions. The server checks this immutable ID, not a username supplied by the browser. The app requests public identity only, with no repository or organization scope.

The bilingual review desk supports search, status filters, game previews, approval, rejection, archiving and restoration. Rejection and archiving require a reason. Every change records its actor, timestamp and note; concurrent stale changes return 409. Quick submissions retain their existing input limits, duplicate-link checks, idempotent retries and rate limits. Private submissions cannot be read through the public list or ID endpoints.

Migration `0002_living_barracuda.sql` preserves submissions that were already public before moderation as approved; previously archived records stay archived. Run it only as part of the coordinated release described in [AUTH_AND_MODERATION.md](docs/AUTH_AND_MODERATION.md). Deploy application code and this migration together; a catalog-only publish does not deploy authentication or moderation.

Maintainers can export intake to prepare a community PR, or import recommendations into the pending queue:

```sh
node scripts/submissions.mjs export /tmp/openaigames-intake.json --remote
node scripts/submissions.mjs import content/submissions-2026-09-15.json --remote
```

These commands use existing Wrangler authorization. Review status changes belong in the authenticated review desk so their audit history is retained. Obtain creator confirmation and complete the community submission guide before preparing `demos/<id>/game.json`. After the formal PR is merged, archive its duplicate intake record in the desk. Omit `--remote` for local development.

## Current release: community feedback

The room keeps featured cartridges on the left and community playtests on the right, with stable ordering. A collection stays in place until it overflows; a one-page cabinet hides paging controls. Larger collections turn only the overflowing pages, keeping the shorter side fixed.

The account popover shows the GitHub avatar and username. Game details show average rating, voter count, likes and comment count. The player toolbar opens the same room feedback panel. Each GitHub account can keep one 1–5-star rating and one like per game, update or clear its rating, undo its like, and post or delete its own comments; the public login screen has no administrator allowlist copy. This update adds migrations `0003_common_loners.sql` (comments) and `0004_famous_whiplash.sql` (ratings and likes), applied to the primary database on 2026-09-16. See [the release record](docs/RELEASE_2026-09-16_FEEDBACK.md) and [authentication notes](docs/AUTH_AND_MODERATION.md) for validation and persistence details.

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

Production and preview now run in the domain account (`1df8f334169206788cc480fb569f1761`). Use `npm run cf -- <wrangler arguments>` to select the isolated local credentials without changing other projects’ Wrangler login. The submissions maintainer commands select the same credentials automatically. On another computer, sign in to the domain account or supply its scoped Cloudflare API token. See [the migration record](docs/CLOUDFLARE_MIGRATION.md).

- `wrangler.cloudflare.json`: the existing production Worker, `DB` for the shared message board, and `CATALOG` for published catalog data.
- `wrangler.preview.json`: a separate public preview Worker with **only** the catalog database. It cannot access the board database. `/community/pr/<number>` opens a PR preview; `?revision=<head SHA>` pins its version.
- `catalog-migrations/`: schema for the separate catalog D1 database. `drizzle/`: existing, immutable board migrations.
- `lib/catalog.mjs`: metadata validation, mirrored in community `tooling/catalog/schema.mjs`; keep the two compatible when extending the format.

The community's trusted default-branch workflow reads PR metadata as JSON, validates it, and POSTs a bounded catalog snapshot to the preview Worker's `/internal/catalog`. The narrow `CATALOG_PUBLISH_SECRET` is stored in Cloudflare and GitHub Secrets; it has no Cloudflare account permissions. A monotonic workflow sequence prevents older jobs replacing newer snapshots. Invalid PR revisions are marked unavailable. Production retains its previous catalog if publication fails.

Catalog publication does not redeploy the website. GET `/api/catalog` uses `Cache-Control: no-store`; browser reads refresh after 30 seconds or a page reload. Main-branch publications use the production channel; PR publications use independent channels. Closed and merged PRs are labeled, and historical snapshots remain readable by revision. Preview feedback goes to GitHub and cannot be submitted to the production message board. No GA4 measurement ID or analytics script is configured.

Deploy code changes with `npm run build`, `npm test`, then `npm run cf -- deploy --config wrangler.cloudflare.json` (or `wrangler.preview.json`). Apply catalog migrations with `npm run cf -- d1 migrations apply CATALOG --remote --config wrangler.preview.json` when they change. Website-code PR deployments are not automated by the community data workflow.

The previous Sites deployment remains available and continues to relay its board through the old gateway. That gateway verifies its existing relay signature and signs the request again for the new primary; visitor rate limits remain separate. Its source registration and source-repository history are not part of this checkout.

## Content and licensing

Original website code is MIT-licensed. Third-party game assets, fonts, and library licenses remain separate; see `THIRD_PARTY_NOTICES.md`. Secrets and player records do not belong in this repository.

## Chinese and English

`ui/i18n.mjs` switches the interface in place, including modal controls and form validation, without replacing draft input or game iframes. `lib/i18n.mjs` contains interface strings and the shared bilingual search matcher.

`content/game-locales.json` stores reviewed display translations for the seven currently curated games, keyed by playable URL. Each entry pairs original `zh` text with `en` values for names, descriptions, instructions, credits and captions. Add matching fields in both languages when curating another game. These display translations do not overwrite catalog or submission records. Nicknames, player notes and unrecognized user content retain their original text. Covers and embedded games retain their own artwork and supported languages.

Full on-site guides are paired as `static/guides/<guide>.zh.md` and `<guide>.en.md`; maintain both when the submission workflow changes. Run `npm test` and check the room, catalog, game details, forms and guides in both languages after editing translations.

## Touch navigation

On the room canvas, one finger rotates the view, spreading two fingers approaches their midpoint, and bringing them together returns toward the entry overview. Cabinet inspection stops at the whole row first; a fresh zoom gesture opens a closer view. In close-up, mouse or single-finger dragging pans horizontally and vertically without picking up a cartridge or changing the return point. Side-cabinet close-ups initially include the category header and lower cubbies. A tap inserts a cartridge; lifting fingers after a pinch cannot insert one. Phone taps use insertion directly instead of desktop cartridge dragging. Screen menus remain tappable and their game list can be swiped.

`scene/touch-navigation.mjs` owns touch gestures only within the room. One finger looks around (or pans an existing close-up); two fingers moving together pan, while spreading/closing zooms toward the pointed object. Modal forms keep native scrolling and browser zoom; full-window game iframes keep their own touch controls. The room does not add mobile gameplay controls to third-party games. Pointer cancellation, lost focus and orientation changes reset the gesture. Portrait starts closer to the desk with a capped field of view; phone-sized and coarse-pointer devices use a lower rendering pixel ratio and smaller shadow map. The hidden room stops rendering while a game or page panel is open.

Mobile catalog, submissions, community, notes and radio use dark bottom sheets. Pull the top handle down to dismiss; content scrolling never closes them. Visual viewport changes keep forms above the software keyboard without resetting the room camera. The top-left brand returns to the entry view. `static/mobile-room.css`, `ui/mobile-room.mjs` and `lib/sheet-gesture.mjs` contain these adaptations.

The gesture state machine, sheet dismissal and camera paths have automated regression tests. Responsive browser checks cover 320 × 740, 360 × 800, 390 × 844, 430 × 932 and 844 × 390 layouts, including the catalog, submissions, notes, community, game details and guides in Chinese and English. Full-window game framing and unloading on return are also checked. Physical iOS/Android multi-touch and software-keyboard behavior still need a real-device check before claiming device compatibility.

The full-window game toolbar includes a rotation toggle on desktop and mobile. It rotates the existing iframe by 90 degrees and exchanges its layout dimensions, preserving the game session without requiring device orientation-lock support. The toolbar stays upright and accessible. Clicking again, changing games or rotating the physical device resets the manual orientation. This does not add touch controls to games that only support a keyboard.

Reviews, game details, and the change-game picker now cover the live game without ejecting it or resetting the camera. Closing via ×, Escape, backdrop, or the mobile sheet handle returns to the same session and orientation. Choosing the same game continues it; choosing a different game unloads the old iframe. Camera/cartridge animation time stops behind panels instead of jumping ahead when they close. These interactions do not guarantee pausing a third-party game's engine or audio, and a full-page GitHub authorization still leaves the current document.

The compact review panel keeps rating stars, likes, and the comment form at the top, with unrelated room navigation hidden. Signed-in ratings save on tap and can be changed or cleared; likes toggle immediately, and comments have one send button. Local browser checks cover fullscreen return, nested panels, language switching, same/different-game selection, mobile sheet dismissal, and 320/390 px review layouts. Signed-in rating/like/comment checks use an isolated test account and database, not production player records.


### Room music and navigation

- Wheel/pinch approaches the pointed object. Drag rotates the overview and pans a close-up; desktop users can also Shift-drag or right-drag to pan. Outward scrolling returns to the entry view.
- The small music button sits next to the language switch. The physical radio is between the TV and the right cabinet, behind the featured cartridges.
- Music starts only on request. Opening a game pauses it; returning to the room resumes it only if it was playing. Switching tracks unloads the previous audio and ignores stale network results.
- Three original synthesized instrumental miniatures are included in `static/music/`. Recreate them with `node scripts/build-music.mjs`.
- Import audio files, M3U/JSON playlists, HTTPS audio URLs, and full public NetEase/QQ Music playlist links. Local audio stays in IndexedDB on the visitor's device; playlists and volume persist locally. For playlists referencing local files, select the playlist and its audio files together. Limits: 300 tracks per import, 500 MB per file batch, 30 custom playlists.
- Platform imports read public metadata and request anonymous playback URLs from the platform. Songs that require login, membership or do not permit external playback are reported as unavailable, with a link to the original platform. Short share links and authenticated private playlists are not supported. Remote M3U/JSON files need to allow browser CORS; downloading and importing the file works otherwise.

The room displays a short “滑动滚轮进入 / Scroll to enter” cue after loading. Coarse-pointer devices see the pinch/drag cue instead. It disappears on interaction or after eight seconds; reduced-motion mode keeps it still until interaction.
