# GitHub sign-in and submission review

The room account button signs in any GitHub user using their public identity. Only immutable GitHub user ID `102272920` (currently `mattheliu`) may use moderation APIs. No repository write or organization membership permission is requested.

Review URL: `/admin`. The review desk supports Chinese/English, filters, search, game preview and a chronological audit trail. New intake is private until approved. Approval publishes a community playtest, not a formal catalog PR. Reject/archive requires a reason. Requeue and republish preserve the audit trail. Existing board messages are unaffected.

## Configuration

The GitHub OAuth app is named `OpenAIGames`, client ID `Ov23liQPBUoUNQGkyMsC`. Exact callbacks:

- `https://openaigames.org/api/auth/github/callback`
- `http://127.0.0.1:8499/api/auth/github/callback`

Server variables: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ADMIN_SESSION_SECRET` (random, at least 32 characters), `ADMIN_ORIGIN`. Local values belong in ignored `.dev.vars`; production secrets belong in Cloudflare. Never commit them. Production origin must be `https://openaigames.org`; local is `http://127.0.0.1:8499`.

Sessions last at most 8 hours, use opaque HttpOnly SameSite cookies, store only a hash of the session cookie in D1, and encrypt the GitHub access token with AES-GCM. OAuth state is bound to a cookie, expires in 10 minutes and is single-use, with PKCE S256. Mutation requests verify Origin, JSON content type, CSRF and live GitHub identity. Tokens never reach browser storage. Expired records are cleaned during login. Changing the encryption secret invalidates existing sessions.

## Release

Build and run `npm test`. Back up the current primary D1 database. Pause quick-submission writes for the short schema cutover; run migration `0002_living_barracuda.sql` and deploy the matching code immediately. Migration carries only previously public pending records to approved, leaving archived records private. New inserts default to pending. Deploying old code after this migration would show the wrong status, so rollback must retain the moderated public query and new-submission privacy, or pause submissions entirely.

Configure production variables/secrets before enabling login. Preview has no community DB or login configuration and cannot authenticate or review submissions. It continues to use only the catalog DB.

The old `lens-frontier.workers.dev` gateway has no DB. Its `/admin` and GitHub login entry redirect to the canonical origin so cookies and OAuth callbacks are never split between domains. Other public pages, games, music and submissions continue to proxy to the same primary. Authentication is completed on `openaigames.org`; no credential or session cookie is forwarded from the legacy host.

## Validation

The isolated Miniflare tests cover public/private records, immutable administrator ID, ordinary GitHub members, CSRF and Origin checks, encrypted stored tokens, state-cookie matching, PKCE, replay/expiry, revocation/logout, audit history, concurrent review conflicts and migration preservation. Local UI QA must additionally verify real GitHub OAuth and mobile/desktop layouts before release.

The legacy production gateway source is `worker/legacy-gateway.js`; its separate configuration is `wrangler.legacy-gateway.json`. Deploy it with the old account's authenticated Wrangler profile, not `npm run cf`, which selects the new account. It deliberately has no D1 or asset binding. Keep its existing `BOARD_RELAY_SECRET` and `UPSTREAM_RELAY_SECRET` secrets. The legacy preview gateway remains on its catalog-only relay configuration.


## Community sign-in and game feedback

The sign-in landing no longer publishes account allowlist details. The room account popover shows the GitHub avatar and username; moderation stays behind the immutable user-ID check. Ordinary users return to the room after sign-in.

Game details and the player toolbar open a bilingual comment panel inside the room. Readers can browse without signing in; posting requires the same GitHub session, same-origin JSON and CSRF validation. Comments derive their author from the verified session, with a 1,000-character limit and a 10-second per-user cooldown. Authors can remove their comments; moderators can remove any comment. Removal is soft deletion.

`/api/comments?game=<id>` accepts published catalog games and approved intake games. Comments use a hash of the public play URL so promotion from intake into the catalog keeps the conversation. Posts have per-user idempotency keys. OAuth uses allowlisted return destinations to restore the game comment panel; unposted text remains in session storage on that origin. The legacy domain redirects sign-in to the primary domain and reads the same public comment data through the existing gateway.

Migration: `drizzle/0003_common_loners.sql` adds only `game_comments` and indexes. This migration and `0004_famous_whiplash.sql` were applied to the primary database on 2026-09-16 before deploying the matching code. Both are additive; existing submissions, board messages and catalog entries were preserved.


Ratings and likes use `game_reactions` (migration `0004_famous_whiplash.sql`). Each game URL hash and GitHub user ID has one unique row. Rating and like writes set a desired value, preserving the other field; retries cannot add duplicate votes. Ratings accept integers 1–5 or null for withdrawal. Aggregate scores include the rating count; an empty collection returns null, never zero stars. Likes can be undone. All writes retain identity, same-origin and CSRF checks.

`GET /api/comments?game=<id>&view=summary` returns aggregate counts only; add `mine=1` to retrieve the authenticated user's current rating and like. Public responses never reveal anyone's selections. The same endpoint accepts `{action:"rate",rating:1..5|null}` or `{action:"like",liked:boolean}` as authenticated POSTs. Both features share comments' approved-game validation and preserve reactions on intake promotion.

Validation: 62 automated tests pass, including invalid score rejection, identity spoofing, CSRF/origin checks, duplicate submissions, independent rating/like changes, withdrawal, aggregate means and private viewer reads. Local isolated browser fixtures cover star selection, likes, persistence and a 320 px English layout. Real GitHub-account OAuth round-trip still requires browser verification. Production and preview deployment details and post-release checks are recorded in [the feedback release record](RELEASE_2026-09-16_FEEDBACK.md). Preview remains catalog-only and rejects feedback requests.
