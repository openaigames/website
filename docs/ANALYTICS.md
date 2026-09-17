# Site analytics

Administrators open `/admin#analytics` and sign in with GitHub. The existing immutable administrator-ID check protects `GET /api/admin/analytics`; ordinary signed-in users cannot read reports. English and Chinese views offer today, seven days, thirty days, or a custom range within the most recent 90 Shanghai calendar days.

## Definitions

- Page views (PV): one event for each visible top-level homepage document load. Room panels, language changes and hash routes do not create additional page views. Browser back/forward-cache restoration does not reload the document or create another PV.
- Visitors (UV): distinct anonymous browser identifiers within the selected range, not the sum of daily UV. Browser storage lasts 90 days. Different browsers, cleared storage and different origins can count the same person separately. This is not an exact people count.
- Game opens: creating the playable game iframe, including restarts and direct game links. Returning from an overlay to the same iframe does not count again. Opening an iframe does not prove that an external game loaded or that a round was played.
- Players: distinct anonymous identifiers with a game-open event in the selected range. Game identity hashes the play URL, matching feedback identity and surviving promotion from intake to formal catalog.
- Community activity: submissions, currently visible comments and notes created within the chosen dates. Likes and active ratings are labeled as current totals because their existing rows represent current choices, not historical actions.
- Sources: allowlisted `utm_source` categories or a coarse category inferred from the referrer host. Unknown or missing referrers cannot be reconstructed. WeChat and Xiaohongshu links are available to copy in the dashboard. No raw referrer or arbitrary query values are submitted.

Reports fill empty dates with zero. `startedAt` is the first accepted event; visits before enabling collection cannot be recovered. Source/device/domain UV can overlap and must not be added to obtain overall UV. Known crawlers, DNT/GPC opt-outs, network failures and blockers affect collection; these are approximate browser metrics, not an audited traffic or billing counter.

## Data and endpoints

`POST /api/analytics/event` accepts only a UUID event ID, UUID browser ID, `pageview` or `play`, an optional published game ID, a bounded source category and a coarse device category. The server controls timestamps and game titles; unapproved games are rejected. Event IDs make retries idempotent. A per-minute hashed-address quota limits event spam, including clients rotating browser IDs.

Only the server's salted digest of the anonymous browser ID is stored. No raw IP, complete user agent, browser fingerprint, full referrer, account identity or free-form event properties are stored. Address-quota keys include a minute boundary and the server secret, and cannot be used as report visitor IDs. Counts are kept separately from GitHub accounts.

The main site posts to its own endpoint. The legacy Workers domain posts anonymous events directly to the same canonical endpoint using restricted CORS and `credentials: omit`; it continues to share the primary database. The legacy gateway and its narrow write-route list are unchanged. Preview and unconfigured environments reject collection. Local development stores only local events.

`ANALYTICS_ENABLED=1` and the existing server session secret enable collection. `0005_icy_famine.sql` adds `analytics_events`, `analytics_limits` and `analytics_meta`; no existing table is changed. A daily 19:15 UTC / 03:15 Shanghai cron deletes events older than the available 90-day calendar window and expired quota records. The first-event timestamp remains. Disabling collection stops new events; remove old records separately if retention should end as well.

For a verification visit that should not count, add `?analytics=off`. This is a local browser opt-out, not an authorization mechanism. Tests use isolated databases and never add synthetic traffic to production.

## Validation

The 68-test suite covers authentication, cross-origin collection, input validation, anonymous-ID hashing, retry deduplication, range UV, Shanghai day boundaries, published-game validation, promotion identity, retention, disabled previews, client visibility and privacy opt-outs. An isolated browser fixture checks populated reports, date filters, language switching, 320/390 px layouts, and an actual homepage/game-open sequence. Opening and closing the review panel leaves both PV and game-open counts unchanged.
