# Visitor analytics release · 2026-09-17

Asset tag: `room-community-20260917-1`; collector tag: `analytics-20260917-1`.

- Production Worker: `6f5e5df4-5281-4407-94f5-05d07c257cd2`
- Preview Worker: `f97ff8ac-a2cc-4c4c-b0d2-58ff6194b89a`
- Legacy gateway unchanged: `dd764081-8778-4a69-8060-c99934cbe1f9`

Adds an administrator-only Analytics tab at `/admin#analytics`: page views, estimated unique browsers, game opens, daily trends, game popularity, source channels, devices, entry domains, and community activity. Reports support Chinese and English, date filters, mobile layouts, and copyable promotion links. See [metric definitions](ANALYTICS.md).

A private backup of the primary D1 database was saved before applying additive migration `0005_icy_famine.sql`. It creates analytics tables and indexes without changing existing community tables. A daily cron retains the most recent 90 Shanghai calendar days. Backups, credentials, sessions, and production event records are not included in this repository.

Both public domains collect into the primary database. Anonymous collection from the legacy domain uses a restricted CORS request to the canonical endpoint, leaving the legacy gateway's existing route allowlist unchanged. Preview collection is disabled.

Validation:

- Build and all 68 automated tests passed; local documentation links and `git diff --check` passed.
- Primary and legacy domains served the new asset tag and matching collector/admin asset hashes.
- Public catalog, submission and board responses matched their pre-release values on both domains: 2 formal games, 5 approved playtests, and 6 board messages.
- Unauthenticated report requests returned 401. Unknown collection origins and preview collection returned 403; legacy-origin CORS preflight returned 204 with its exact allowed origin. DNT collection returned 204 without recording the request.
- One actual verification visit and game open on the production site produced one page-view event and one game-open event. No synthetic production events were seeded. The embedded game loaded, and returning to the room preserved navigation.
- Isolated browser checks verified populated reports, date filters, Chinese/English text and 320/390 px layouts. Opening and closing game feedback did not create another page view or game-open event.
- The production login page renders the updated sign-in copy. A real GitHub-account OAuth round trip remains unverified; authorization and signed-in report access are covered by isolated tests.

The repository homepage was also rewritten as a concise Chinese README with a separate English version. Longer operational and interaction notes now live in [DEVELOPMENT.md](DEVELOPMENT.md) and [ROOM.md](ROOM.md).
