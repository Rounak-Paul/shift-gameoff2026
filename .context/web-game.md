# SHIFT web game

## Scope / source
- itch.io-first HTML5 puzzle game with mouse, keyboard and touch. No commits/pushes.
- Adapted `/Users/duke/Code/QuasarEngine/projects/Shift/assets/scripts/board.lua` and `board_audio.lua`: 6×6 board, six kinds, initial board without runs, cyclic row shifts, detent .65, flick .14s, spring 420/25, quarter-turns, queued rotation, four WAV samples.
- Web additions: nonwrapping match-three runs, gravity/refill, cascade multipliers, endless free moves, hints and browser-local best.

## Current direction
- User approved the cream retro console. Keep its enclosure, logo, dark screen, physical orange turn buttons, and minimal UI.
- User explicitly discarded the cylinder after several revisions. Current board is a flat 6×6 sliding cartridge. Do not reintroduce curved reels or unrolling transitions.
- User explicitly rejected up/down shake on drop. Removed thunk layout pulse and landing CSS animation. No board translation on landing.
- Earlier marketing text, cozy theme, sidebars, progress meter, and looping ambient music were rejected/removed. Keep gameplay central.

## Architecture
- Dependency-free HTML/CSS/Canvas with native ES modules. `npm run dev` serves port 5173. `npm run build` generates `dist/` and `shift-itch.zip` using system zip; relative URLs and root index.html.
- `src/engine.js`: pure board rules, wrapping, rotation, run detection, gravity, hints.
- `src/game.js`: interaction state machine idle/drag/settle/rotate/clear/fall, DOM interface, feedback events.
- `src/board.js`: flat projection and pointer mapping. `src/renderer.js`: raised printed tiles, horizontal row tracks, square cartridge frame and quarter-turns. Detailed geometry in `.context/flat-cartridge.md`.
- `src/audio.js`: event observer for original WAV samples plus short match tones. Unlocks on first input unless muted, pauses when hidden. Audio/storage/fullscreen failures degrade safely.
- Pointer capture; cancel/blur/lost capture settle safely. Q/E or Left/Right rotates; Up/Down selects row; A/D shifts; H hints; Z undoes. No timer or penalties.

## Validation / delivery
- 11 deterministic Node tests: rules, initial no-run boards, gravity, cascades, hints, flat projection inversion, turn continuity, both-turn framing bounds, and outside input.
- Build is fully local; no hosted deployment. Actual mobile touch hardware, Safari, and itch-hosted iframe remain unverified.

## UI/UX refinement
- User approved flat board and requested further UI/UX work. Preserve this design.
- Added bounded 20-action undo restoring the full pre-action board/score, including cascades. Moves snapshot on grab and commit only for real shifts; canceled/full-loop drags do not consume history. Turns snapshot before animation. Undo is disabled while busy, keeps best, clears hints/particles, and returns keyboard focus to board. New game clears history; its dialog defaults to Keep playing.
- Hint now pulses the relevant row with a direction/step marker plus a compact display cue. Navigating rows or starting a move clears the hint. Onboarding shows drag then turn, then leaves the display blank; drag displays row and detent count, matches/undo show brief feedback.
- Turn buttons show pressed/queued state; hint/undo reflect busy/availability. Added visible HINT/UNDO/RESET labels and larger utility hit areas, mute slash, named dialogs and Z help.
- Match tiles briefly highlight before shrinking; score pop moved above grid and reduced to avoid covering play. No landing shake. Flick projection capped to one extra cell to prevent accidental full-loop gestures.
- Browser checked a hinted 30-point match followed by Undo restoring 0, 320×568 fitting without overflow, reset dialog focused on Keep playing. Landscape fit adjusted from 79svh to 77svh after a 2px overflow at 844×390.

## Latest interaction correction
- Magnetic row detents and sequential single-instance gutter transit supersede prior flick/duplicate-wrap behavior. See `.context/magnetic-wrap.md`. Current suite is 14 tests.
