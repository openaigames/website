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
