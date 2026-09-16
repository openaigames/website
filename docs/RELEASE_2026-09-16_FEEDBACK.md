# Community feedback release · 2026-09-16

Asset tag: `room-community-20260916-6`.

- Production Worker: `732d2a9c-9f48-4efc-a40a-ffd4e551e7d2`
- Preview Worker: `fda9ab7d-82a7-45aa-8ea7-00998f470c1a`
- Legacy gateway unchanged: `dd764081-8778-4a69-8060-c99934cbe1f9`

Adds GitHub-authenticated game ratings, likes and comments, a compact bilingual feedback panel and account popover. Featured cartridges stay on the left; community playtests stay on the right. Only overflowing collections paginate. Opening a room panel preserves the game iframe, orientation and camera; closing it returns to the same session. Enlarged cartridge previews avoid both shelves and never intercept cartridge selection.

A private primary-database backup was made before applying additive migrations `0003_common_loners.sql` and `0004_famous_whiplash.sql`. No database export, session data or credentials are included in the repository. Both public domains continue to read and write through the same primary Worker and databases. Preview has no community database and cannot submit feedback.

Validation:

- Build and all 62 automated tests passed; `git diff --check` was clean.
- Primary and legacy domains served the new asset tag and matching built JavaScript/CSS hashes.
- Public catalog, submissions and board payloads exactly matched their pre-release values: 2 formal games, 7 approved submissions and 6 board messages.
- Feedback reads returned successfully on both public domains. Anonymous rating writes and unauthenticated moderation were rejected; preview feedback was rejected.
- Legacy sign-in redirected to the canonical origin with its return destination preserved.
- Production browser smoke check opened a fullscreen game, loaded its rating/comment panel, and returned to the same fullscreen game when the panel closed.
- Local desktop/mobile UI checks covered compact reviews, return from fullscreen panels, nested panels, language switching, same/different game selection, and cartridge preview clearance. Authenticated interaction checks used an isolated fixture account and database, not production player records.

A real GitHub-account browser sign-in round trip remains unverified. Protocol, authorization and authenticated feedback are covered by isolated tests; those checks are not evidence of a completed real-account browser login. Full-page OAuth navigation leaves the running game document. Opening a panel cannot universally pause third-party game engines or audio.

The earlier room/music/moderation release remains documented in [RELEASE_2026-09-16.md](RELEASE_2026-09-16.md).
