# Menus and campaign — 2026-11-18

## Requested direction
User requested main menu, settings, and gameplay; clarified “take inspiration from candy crush.” Implemented progression, limited moves, collection/clearing goals, and win/retry flow while retaining SHIFT slides and free cartridge turns. Preserve console/magnetic feel, no landing shake or Undo. No commits/pushes.

## Current implementation
- `src/shell.js`: event-driven home/map/play views, settings, level briefs, goal HUD, results, replay/unlocks. Hidden gameplay is inert. Resume preserves the attempt within this session; reload keeps completion/settings but starts at home.
- `src/profile.js`: validated, storage-failure-tolerant preferences/completed IDs under `shift.profile.v1`. Existing `shift.best` retained.
- `src/levels.js`: 12 authored levels and independent `LevelRun` tracking. Score, symbol orders, brass-space clearing, mixed goals. Mark backing remains at board spaces during slides/falls and rotates with the cartridge.
- Seeded board/refill per level makes retry repeatable. One committed nonzero row shift costs one move, regardless of distance. Turns/hints/canceled/full-loop gestures are free. A/D follows a full active hint in the matching direction.
- Final outcomes wait for all cascades. Last-move success beats exhaustion; pending turns are discarded on completion. Successful levels unlock the next, and cleared levels stay replayable.
- Settings: sound, live volume, system/reduced/full motion, particles, fullscreen. Motion choice applies consistently to canvas and DOM effects. Main menu/settings pause simulation. Restart copy distinguishes campaign/free play.
- Responsive CSS fits new HUD and avoids logo/tool overlap. Main menu hides the physical controls. Settings/info use native dialogs; result Escape returns to map.

## Validation
- 28 Node tests pass, including campaign goal accounting, final-move cascade outcome, seeded retries, storage validation, and a simulated winning sequence for every authored level within its budget.
- Build regenerates dist/ and itch ZIP; git diff --check passes.
- Browser: completed level 1 at 120 points in 2 moves, saw result and level-2 brief, verified unlock and completion survive reload. Tested settings persistence, sound/motion controls, pause/resume, and collection HUD. No warning/error logs observed.
- Menu and campaign fit 1280×720, 320×568 portrait, and 844×390 landscape without document overflow. Physical touch, Safari, and hosted itch iframe remain unverified.
- A temporary stylesheet write error was caught during browser QA, corrected, and layouts rechecked. No remaining known regression from that error.
- Initial difficulty values have verified solutions but still need human playtesting before expanding the campaign. No special candies, blockers, lives, monetization, or timers were added.
