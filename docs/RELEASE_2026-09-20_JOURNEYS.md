# Journey analytics · 2026-09-20

Asset tag: `room-community-20260920-1`; collector/admin tag: `analytics-20260920-2`.

This release connects room loading, submission, authentication, feedback, catalog search and embedded game runtime to anonymous journeys. Administrators can distinguish incomplete flows, server-confirmed saves and coarse failures instead of inferring conversion from unrelated event counts.

- Room load attempts, readiness, elapsed time and runtime graphics errors, split by device.
- Submission open / first input / attempt / confirmed result; feedback operations and GitHub session creation use server outcomes. Analytics never gates content writes.
- Debounced catalog searches, result counts and result selections without recording search text.
- Optional author SDK for game-ready, round-start, pause/resume and effective time. Iframe load alone never confirms readiness. Missing integrations remain unconfirmed.
- Exact Shanghai Day 1 / Day 7 browser-return cohorts; only complete observation days count.
- Chinese/English admin sections, horizontally scrollable keyboard-accessible tables, and narrow-screen scroll hints.

## Data compatibility

An external private backup was taken before applying `0007_happy_landau.sql` and `0008_easy_landau.sql`. These add an analytics table/indexes and an empty-default OAuth flow field. Existing events, user content and OAuth states are compatible; no historical journey events are fabricated. Retention remains 90 days. The primary database remains the sole write store, including signed submissions relayed by the unchanged legacy gateway. Preview still has only the catalog database and cannot collect analytics or issue login sessions.

## Validation

- Production build and Wrangler dry-run passed.
- 83 automated tests passed, including flow ownership, stage deduplication, rejection of client-forged success events/free text, server-confirmed submissions and feedback, OAuth state correlation, exact-day cohort maturity, cumulative runtime, stale/wrong-origin/wrong-nonce iframe messages, privacy opt-outs and signed legacy relay attribution.
- Isolated local browser checks exercised actual search/no-result/result selection and a saved four-star rating; corresponding aggregates changed as expected.
- English and Chinese dashboard checks at 390 px and 320 px: no page-level horizontal overflow; wide tables scroll with a hint. Browser dimensions were reset after checking.
- No synthetic analytics, submissions, ratings or comments were sent to production. The real GitHub authorization UI was not repeated; callback behavior was verified with mocked GitHub responses in integration tests.

## Deployment

- Production: `345318fc-d81c-48a4-a48b-da259b9ebb52`.
- Catalog-only preview: `e715af86-0760-4cce-aa9c-cca708bd649b`.
- Legacy gateway unchanged; no second analytics/content database was added.
- 21 post-release HTTP checks passed: current asset hashes on main/preview, protected report/session routes, privacy opt-out, preview collection rejection, exact legacy-origin CORS, rejection of foreign origins, and preservation of the primary public catalog/intake/board snapshots.
- The legacy `workers.dev` hostname repeatedly reset connections from the verification network before this deployment, so live HTTP checks of that hostname could not be completed. Its source/routing was not changed; signed relay attribution and shared-primary behavior passed integration tests. The canonical `openaigames.org` endpoints were reachable and verified.

Backup SQL, raw snapshots and local QA logs remain outside the public repository.
