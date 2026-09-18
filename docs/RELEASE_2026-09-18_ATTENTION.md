# Game selection and active-time analytics · 2026-09-18

Asset tag: `room-community-20260918-1`; collector tag: `analytics-20260918-1`.

- Production Worker: `608e8fc1-5c1f-42cc-936d-b9d3c1e6a71a`
- Preview Worker: `c89c3be3-a244-4d0e-8c2e-19c9180ee00a`
- Legacy gateway unchanged; both public entry domains continue using the primary database.

The private analytics dashboard now separates explicit game selections from playable-frame opens. It also shows total and average active website time, with the number of timing-enabled visits and a start date. Both languages and date filters include the new metrics. Older visits without timing support are excluded from the duration denominator; an empty cohort displays “—”. See [definitions and limitations](ANALYTICS.md).

Timing pauses when the page is hidden, unfocused, focused inside an embedded game, or idle for 60 seconds. Cumulative saves run every 30 seconds, with best-effort exit saves. Repeated or out-of-order saves cannot inflate a visit's duration. These metrics do not measure actions inside third-party games or actual gameplay duration.

A private backup of the primary database was saved before applying additive migration `0006_steady_zaran.sql`. Only a new timed-visit table and index were created. The previous event table and legacy collector payload remain compatible. Timed visits follow the existing 90-day retention window. Backups, raw statistics, browser identities and credentials are not in the repository.

Validation:

- Build and all 72 automated tests passed, including idle/background pauses, device suspension, iframe focus, page-exit saves, BFCache restoration, cumulative idempotency, visit ownership, bounded duration and old-client denominator exclusion.
- An isolated browser fixture verified Chinese and English dashboards at 320px and 390px without page overflow. A pre-timing date correctly displayed unavailable duration rather than a misleading zero.
- A real local UI sequence produced one page view, one catalog-detail selection, one cartridge insertion selection and one game open. Language switching, opening feedback and following its game-details link did not create extra selection, page-view or open events. Duration heartbeats updated the same timed visit.
- All 24 production HTTP checks passed: both public domains served matching built assets; catalog, public intake and board payloads matched their pre-release snapshots; reports remained protected by authentication; unknown origins and preview collection were rejected; restricted legacy-origin CORS and the DNT opt-out remained intact.
- No synthetic traffic or private QA accounts were added to production. A real-account GitHub OAuth round trip was not part of this release verification; authentication and authorization are covered by the isolated suite.
