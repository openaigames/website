# Cockroach Battle site move — 2026-09-28

The maintainer supplied a new playable URL for approved intake entry `inbox-1`:

- Previous: https://dirty-room.zackliny.chatgpt.site/
- Current: https://cockroach-battle.zackliny.chatgpt.site/

Updated the existing production submission in place, with a conditional old-URL / review-version check. Its ID, title, approval state, creation declaration and original submission time are retained; the review version advances from 1 to 2 to invalidate stale moderation forms. Existing moderation decisions are not rewritten. The maintenance was performed using the established Cloudflare maintainer credentials, authorized by the maintainer in this task.

Media lookup recognizes both addresses so the existing cover and dated screenshots remain available. The translation key and import seed now use the new URL. The legacy feedback keys were checked and included in the guarded URL migration; neither address had existing rating or comment rows at the preflight check. No test feedback was written to production.

Validation: production build and all 85 automated tests passed. The new site's title screen identifies itself as 蟑螂大作战; OpenAIGames' production source-link panel now points to the new address and retains the artwork and AI creation badge. This is a link update, not a full gameplay certification.

Production Worker version: `bc36e08f-5300-4e66-838b-82a1dd895d46`.

The separate local ratings preview also uses the new URL. Its unpublished assessment code and database migration were not included in this production release.
