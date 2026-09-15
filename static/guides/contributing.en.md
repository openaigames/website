# Let’s build games together

Start with an idea, a playable mechanic or thoughtful playtest feedback. You can contribute programming, art, narrative or sound, or simply playtest.

## Keep a record through pull requests

If you already have an organized idea, demo or tool request, open a PR directly. An issue is not required first. Write in Chinese or English.

1. Use your fork or a working branch to add a record.
2. Copy the appropriate template to the location below. Replace `<short-name>` with a short, stable lowercase name, using hyphens between words. Remove unused placeholder instructions.
3. Fill in creators, content and relevant links. Link any related issue or earlier PR.
4. Open a PR against this repository's `main` branch, explaining what you added or changed. You can start with a draft PR and mark it ready once the work is ready for review.
5. Maintainers check the content, links and credits before merging. Update the same record for later versions, keeping the file history and PR discussion.

| Content | Template | Location |
| --- | --- | --- |
| Game idea | `templates/idea.md` | `ideas/<short-name>/README.md` |
| Playable demo | `templates/demo.md` | `demos/<short-name>/README.md` |
| Tool need | `templates/tool-need.md` | `tooling/<short-name>/README.md` |

Keep screenshots and supporting assets beside the record and use relative links. Link to game executables, full source and tool implementations in their own projects. This repository stores collaboration records and their index.

When archiving a demo, you may update `SHOWCASE.md` in the same PR with links to the record, playable game and related discussions.

## Bring an idea

[Open a game idea](https://github.com/openaigames/community/issues/new?template=01-game-idea.yml). Describe what players do, why it is interesting and the smallest first version. If you want collaborators, explain what you can already do and where you need help.

## Submit a demo

[Submit a playable demo](https://github.com/openaigames/community/issues/new?template=02-game-demo.yml) with its play link, controls and the questions you most want to test. A directly playable link is ideal. If installation or setup is needed, explain the steps.

Include source and dev notes in the same submission. Preserve credits for creators, collaborators and assets. Confirm that you have permission before sharing someone else's work or assets.

## Playtest and iterate together

Leave feedback on the demo's issue or PR: what you tried, where you got stuck, a moment you enjoyed and one concrete suggestion. Creators follow up in the same discussion and use PRs to update the archived record with versions and changes.

## Discover tool needs through creation

[Record a tool need](https://github.com/openaigames/community/issues/new?template=03-tool-need.yml). Start with a recurring problem in real production, then discuss whether it deserves a tool. Describe the steps, time spent and desired improvement. Include reproduction materials if available. Once the discussion is clear, split the work into implementation tasks.

Keep one main discussion per idea or demo. When picking up work, leave a comment explaining your scope. A PR can link to a discussion, but opening an issue first is optional. When editing community documentation, check both Chinese and English versions.

If a demo grew from an earlier idea, link the original issue or archived document. Once play links and credits are complete, use a PR to update `SHOWCASE.md`.

## Submission previews and automatic publication

See `docs/GAME_SUBMISSION.md`, `templates/game.json` and `skills/openaigames-submit-demo/SKILL.md` in the community repository. A PR receives an automatic exhibition preview. Merging updates the game catalog automatically. New games are not featured by default.
