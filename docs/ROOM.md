# Room interactions

[Back to the project homepage](../README.md)

The room keeps featured cartridges on the left and community playtests on the right, with stable ordering. A collection stays in place until it overflows; a one-page cabinet hides paging controls. Larger collections turn only the overflowing pages, keeping the shorter side fixed.

The account popover shows the GitHub avatar and username. Game details show average rating, voter count, likes and comment count. The player toolbar opens the same room feedback panel. Each GitHub account can keep one 1–5-star rating and one like per game, update or clear its rating, undo its like, and post or delete its own comments; the public login screen has no administrator allowlist copy. This update adds migrations `0003_common_loners.sql` (comments) and `0004_famous_whiplash.sql` (ratings and likes), applied to the primary database on 2026-09-16. See [the release record](RELEASE_2026-09-16_FEEDBACK.md) and [authentication notes](AUTH_AND_MODERATION.md) for validation and persistence details.

## Touch navigation

On the room canvas, one finger rotates the view, spreading two fingers approaches their midpoint, and bringing them together returns toward the entry overview. Cabinet inspection stops at the whole row first; a fresh zoom gesture opens a closer view. In close-up, mouse or single-finger dragging pans horizontally and vertically without picking up a cartridge or changing the return point. Side-cabinet close-ups initially include the category header and lower cubbies. A tap inserts a cartridge; lifting fingers after a pinch cannot insert one. Phone taps use insertion directly instead of desktop cartridge dragging. Screen menus remain tappable and their game list can be swiped.

`scene/touch-navigation.mjs` owns touch gestures only within the room. One finger looks around (or pans an existing close-up); two fingers moving together pan, while spreading/closing zooms toward the pointed object. Modal forms keep native scrolling and browser zoom; full-window game iframes keep their own touch controls. The room does not add mobile gameplay controls to third-party games. Pointer cancellation, lost focus and orientation changes reset the gesture. Portrait starts closer to the desk with a capped field of view; phone-sized and coarse-pointer devices use a lower rendering pixel ratio and smaller shadow map. The hidden room stops rendering while a game or page panel is open.

Mobile catalog, submissions, community, notes and radio use dark bottom sheets. Pull the top handle down to dismiss; content scrolling never closes them. Visual viewport changes keep forms above the software keyboard without resetting the room camera. The top-left brand returns to the entry view. `static/mobile-room.css`, `ui/mobile-room.mjs` and `lib/sheet-gesture.mjs` contain these adaptations.

The gesture state machine, sheet dismissal and camera paths have automated regression tests. Responsive browser checks cover 320 × 740, 360 × 800, 390 × 844, 430 × 932 and 844 × 390 layouts, including the catalog, submissions, notes, community, game details and guides in Chinese and English. Full-window game framing and unloading on return are also checked. Physical iOS/Android multi-touch and software-keyboard behavior still need a real-device check before claiming device compatibility.

The full-window game toolbar includes a rotation toggle on desktop and mobile. It rotates the existing iframe by 90 degrees and exchanges its layout dimensions, preserving the game session without requiring device orientation-lock support. The toolbar stays upright and accessible. Clicking again, changing games or rotating the physical device resets the manual orientation. This does not add touch controls to games that only support a keyboard.

Reviews, game details, and the change-game picker now cover the live game without ejecting it or resetting the camera. Closing via ×, Escape, backdrop, or the mobile sheet handle returns to the same session and orientation. Choosing the same game continues it; choosing a different game unloads the old iframe. Camera/cartridge animation time stops behind panels instead of jumping ahead when they close. These interactions do not guarantee pausing a third-party game's engine or audio, and a full-page GitHub authorization still leaves the current document.

The compact review panel keeps rating stars, likes, and the comment form at the top, with unrelated room navigation hidden. Signed-in ratings save on tap and can be changed or cleared; likes toggle immediately, and comments have one send button. Local browser checks cover fullscreen return, nested panels, language switching, same/different-game selection, mobile sheet dismissal, and 320/390 px review layouts. Signed-in rating/like/comment checks use an isolated test account and database, not production player records.


### Room music and navigation

- Wheel/pinch approaches the pointed object. Drag rotates the overview and pans a close-up; desktop users can also Shift-drag or right-drag to pan. Outward scrolling returns to the entry view.
- The small music button sits next to the language switch. The physical radio is between the TV and the right cabinet, behind the featured cartridges.
- Music starts only on request. Opening a game pauses it; returning to the room resumes it only if it was playing. Switching tracks unloads the previous audio and ignores stale network results.
- Three original synthesized instrumental miniatures are included in `static/music/`. Recreate them with `node scripts/build-music.mjs`.
- Import audio files, M3U/JSON playlists, HTTPS audio URLs, and full public NetEase/QQ Music playlist links. Local audio stays in IndexedDB on the visitor's device; playlists and volume persist locally. For playlists referencing local files, select the playlist and its audio files together. Limits: 300 tracks per import, 500 MB per file batch, 30 custom playlists.
- Platform imports read public metadata and request anonymous playback URLs from the platform. Songs that require login, membership or do not permit external playback are reported as unavailable, with a link to the original platform. Short share links and authenticated private playlists are not supported. Remote M3U/JSON files need to allow browser CORS; downloading and importing the file works otherwise.

The room displays a short “滑动滚轮进入 / Scroll to enter” cue after loading. Coarse-pointer devices see the pinch/drag cue instead. It disappears on interaction or after eight seconds; reduced-motion mode keeps it still until interaction.
