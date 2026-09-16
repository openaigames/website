# Domain account migration · 2026-09-16

Production: https://openaigames.org/

Preview: https://preview.openaigames.org/

Both run in account `1df8f334169206788cc480fb569f1761`, which owns the domain.

| Binding | Database | ID |
|---|---|---|
| DB | openaigames-board | 329feb8e-3f08-40f3-bf64-ee2c9fc5639b |
| CATALOG | openaigames-catalog | 678c02e9-b7f7-4c32-b937-d6e1daa31f64 |

The two `lens-frontier.workers.dev` Workers in account `798cc288096e1beac5cb1611654fdf4a` are fixed reverse proxies. They have **no D1 bindings**. Production forwards to the new primary; preview forwards to the new preview. No fallback writes or dual writes exist. Old D1 instances are retained as frozen backups.

The community workflow continues using its existing publishing URL and credential. The old preview gateway checks that credential and forwards with the new account’s narrow catalog publishing credential. Existing PR preview URLs continue working. The previous Sites board relay remains supported. Gateway signing preserves per-visitor daily digests rather than sharing a single cross-account IP throttle.

## Local operations

Use `npm run cf -- deploy --config wrangler.cloudflare.json` or `wrangler.preview.json` after building and checking a release. `scripts/cloudflare-env.mjs` selects the isolated domain-account profile when present; explicit caller credentials take precedence. Never deploy the main website bundle to the old gateway Workers.

`node scripts/submissions.mjs export /tmp/intake.json --remote` exports the current primary’s intake. Review status changes now use the GitHub-authenticated `/admin` desk. Formal catalog publication still uses a reviewed community PR.

The initial migration copied asset tag `room-cabinet-pages-4` and did not push the source repository. The subsequent [community room release](RELEASE_2026-09-16.md) adds the local mobile/music work and moderation.

## Evidence and recovery

Private migration backups, SQL, exact deployed bundles, asset manifest, gateway code and cutover verification are outside this repository, in the task output folder `openaigames-domain-migration-2026-09-16`. Credentials and submission request IDs must never be committed.

Writes were paused on both old Workers during the final data copy. All table rows were compared before enabling new writes: 5 board messages, 7 submissions, 5 catalog revisions, 2 catalog heads, plus schema and throttle records. Both public endpoints were then compared. POST verification reused existing idempotency keys and did not create public test messages or submissions.

Do not roll back to writable old databases after cutover: the primary may have new submissions. For recovery, pause new writes and copy its latest data first, or keep the gateways on the new primary and roll back only application code. Saved pre-migration versions are for code recovery, not permission to reactivate stale data.

The community publish workflow was dispatched after cutover and succeeded: https://github.com/openaigames/community/actions/runs/35076496449 . Its production catalog sequence advanced only in the new database; the old catalog stayed at its pre-cutover sequence.

At verification, Cloudflare and Google public DNS resolved the new domain and HTTPS returned 200 with a valid certificate. The local corporate DNS still returned a cached NXDOMAIN from before registration (remaining negative-cache TTL roughly 17 minutes at 16:59 CST). Browser opening through that resolver was not yet possible; this is distinct from the successful origin/HTTPS and gateway checks. No system DNS settings were changed.
