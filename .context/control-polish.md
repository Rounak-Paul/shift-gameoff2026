# Controls and feel polish — 2026-11-18

## Scope
Polish free-play before levels. Preserve approved console, magnetic detents, single-tile gutter handoff, no landing shake, and no Undo. No commits or pushes.

## Implemented
- Pointer release consumes its final coordinate, so quick swipes cannot lose their final detent. Other pointer IDs remain ignored. Capture cleanup clears the active pointer before releasing capture.
- Busy row navigation is ignored, preventing selection from disagreeing with the moving row. Keyboard selection shows a brief row/A/D cue and announces selection. Drag cue reflects intended magnetic detent.
- Hints select the highlighted row for A/D and clear stale hover; no-hint feedback also appears on the display.
- Escape cancels held drag, queued turn, or active hint; committed movement continues normally.
- Help/reset dialogs cancel held gesture and queued turn, pause simulation, and return focus to the board on close.
- Reduced-motion preference applies live: slides and turns commit without springs, falling tiles appear in place, particles stay off. Short match phases remain for feedback.
- Reset clears stale target, keyboard movement, and hover. Outside-board clicks no longer steal board focus.
- Help lists H/Escape and clarifies straight-line matches and cascade multipliers. README updated.

## Validation
- 21 Node tests pass, including six controller regression tests using real board rules and isolated DOM/clock substitutes.
- Build and git diff --check pass; regenerated dist and itch ZIP.
- Browser: hinted right shift produced 30 points, selection cue rendered, help text/close and board focus verified. No warning/error logs observed.
- Responsive DOM bounds fit 320×568 portrait and 844×390 landscape without document overflow. Physical touch hardware, Safari, and hosted itch iframe remain unverified.
- Foundation ready for level work; pacing/difficulty tuning should follow concrete level objectives.
