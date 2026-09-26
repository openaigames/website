# Creation method declarations · 2026-09-26

Web submissions and formal PR catalog records now carry `creation_method` and public `creation_note`. Four methods are supported: Not declared, Human-made, AI-assisted, and Primarily AI-generated. Human-made means a declaration of no generative AI use, including assets; conventional engines and tools remain compatible. Approval and featured status are independent of the declaration.

The bilingual submission form, moderation list/editor, public catalog, playtest inbox, game details, console selection/player toolbar and 3D cartridge status display the same metadata. Moderators can correct approved entries without changing approval. Corrections require a private review reason, retain before/after public metadata in the audit, and use the existing review-version concurrency check and administrator authorization. Language switching preserves form drafts.

Migration `0009_old_quicksilver.sql` adds columns only. Historical submissions receive undeclared/empty defaults; historical audit rows remain null instead of inventing old declarations. Existing formal catalog snapshots normalize missing fields on read. No historical game, including Masking, is inferred to be human-made or AI-generated.

The community validator, game template, bilingual submission guides and Agent Skill use the same contract. The catalog migration and PR preview workflow are unchanged. Older clients remain compatible: missing submission fields default to undeclared, and moderation requests that omit them preserve stored values. Rollback to the prior application is compatible with the additive columns but will hide the new labels.

Validation: 85 automated tests pass, including default/backfill preservation, public/private intake, invalid declarations, escaped public notes, idempotency, approval preservation, authenticated corrections, audit history and concurrent-edit conflicts. Isolated browser QA exercised approval followed by a metadata-only correction and confirmed public detail updates. Chinese/English form drafts survived language switching. Desktop layout was inspected. No synthetic reviews or submissions were written to production.

## Maintainer-confirmed declarations

After launch, the maintainer explicitly confirmed Masking as human-made and the other seven currently public games as primarily AI-generated. The six approved quick-submission records were updated with a review-version guard and before/after audit rows attributed to the authenticated maintainer (`mattheliu`, GitHub ID 102272920), using the authorized Cloudflare maintenance connection. Approval and gameplay metadata are unchanged. Dodo and NIGHTFURY declarations are recorded in the community catalog source and the local fallback catalog. New submissions still default to undeclared.

Cartridge artwork now has a dedicated creation-method strip; physical 3D cartridges use a larger separate plaque and include declaration changes in the rack refresh key. The review list and detail heading show matching textual labels and colors.
