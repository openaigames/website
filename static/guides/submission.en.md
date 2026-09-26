# Submissions, previews and publication

The homepage's 3D cartridge area features selected games. The catalog lists all published games. Unmerged submissions appear only in their own PR preview. New submissions use `featured: false`; maintainers decide which games to feature.

## The shortest path for people and agents

1. On a new branch, copy `templates/game.json` to `demos/<id>/game.json`. Use lowercase letters, numbers and hyphens for `id`, matching the directory name.
2. Add a `README.md` in the same directory describing gameplay, controls, feedback questions, creators and third-party credits. Store the cover beside it or use an HTTPS image URL.
3. At the repository root, run `node tooling/catalog/validate-local.mjs`, then `git diff --check`.
4. Open a pull request against `openaigames/community:main`. Describe the game, its playable URL and what you verified.
5. Check `Game catalog / Preview` and the bot comment. Open the preview and inspect the catalog entry, cover, details, playable URL and controls.
6. Further pushes to the same branch update the original comment and preview. The pinned revision link shows a specific commit. If validation fails, inspect the check and fix the problem. An older working preview does not mean the new commit passed.
7. Maintainers review and merge the PR. The main-branch workflow publishes the catalog automatically. The website shows the new game when it reloads the catalog; no manual website edit or Cloudflare login is needed.

A PR closed without merging is marked “Closed, not published”; a merged PR is marked “Merged”. `catalog/legacy.json` preserves the dodo listing that predates this workflow. Do not change it for ordinary submissions.

## game.json fields

| Field | Contents |
| --- | --- |
| `id`, `title`, `description`, `category` | Stable ID, game name, short description and category |
| `creator`, `creator_url` | Creator name and homepage |
| `preview_url`, `source_url`, `submission_url` | Playable HTTPS page, source and submission record. The record may initially link to the archive document; do not guess a PR number. |
| `cover_url` | Image filename in the same directory or HTTPS image URL. PNG / JPG / WebP / GIF; each local image must be no larger than 5 MB. |
| `gameplay_url`, `image_caption` | Optional gameplay image and accurate caption. Do not describe a concept poster as a gameplay screenshot. |
| `version_label` | Display version or date |
| `controls`, `instructions` | Controls summary and gameplay instructions |
| `feedback_questions` | 1–8 questions for players |
| `credits`, `attribution` | Creator notes and third-party credits; attribution may be empty |
| `featured` | Use `false` for new submissions. Only maintainers select featured games. |

The website embeds your playable URL; it does not build your game source. To test a code update, publish a playable build from the game repository first, then use that URL here. If the game cannot be embedded in an iframe, fix its hosting settings or tell maintainers that it only works on its original site.

## Agent entry point

Read the [game submission skill](https://github.com/openaigames/community/blob/main/skills/openaigames-submit-demo/SKILL.md). It can be installed in an agent's skill directory if the agent supports `SKILL.md`. It needs neither Cloudflare access nor website deployment credentials.

Implementation and workflows live in `tooling/catalog/` and `.github/workflows/catalog.yml`. Previews do not accept public board posts or load production analytics. If catalog publication fails, the previous published catalog remains live.

## Creation declarations

The web submission form and `game.json` share these fields:

| Field | Rule |
| --- | --- |
| `creation_method` | `undeclared` (default), `human`, `ai_assisted`, or `ai_generated` |
| `creation_note` | Optional public explanation, up to 500 characters, covering code, art, audio, writing or tools |

`human` declares that no generative AI was used; conventional engines and development tools are allowed. Use `ai_assisted` for generative AI assistance with code or assets, and `ai_generated` when generative AI produced most of the code or content. If you recommend someone else's work without knowing its process, keep `undeclared`. Never infer a declaration from appearance, hosting provider, source availability or approval. Creator submissions do not imply human-made production.

Labels appear in the catalog, details and player. They reflect declarations and supporting material, not platform certification. Older games remain Not declared until information is supplied; approval never changes the method automatically. Moderators may correct approved submissions with a review reason and an audit of previous and new values. Creation notes are public: exclude contact details, private URLs and credentials. PR records are authoritative for the published catalog; carry confirmed declarations over when promoting a quick submission.
