# SHIFT

A self-contained HTML5 puzzle game for itch.io, desktop browsers, and touch screens. No runtime dependencies, external fonts, accounts, or remote assets.

## Run

Requires Node.js 20+ and `zip` for packaging.

```sh
npm run dev
npm test
npm run build
```

Open http://127.0.0.1:5173. The build writes `dist/` and `shift-itch.zip`.

## Play

- Drag a row horizontally; its tiles resist slightly, then snap magnetically past the detent. Wrapping tiles exit completely before re-entering from the opposite gutter.
- Match at least three equal colors/shapes in a horizontal or vertical line. Matches do not wrap across board edges.
- Q/E rotates the flat cartridge a quarter-turn, making columns into rows.
- Match cascades multiply points: 10 points per tile × chain depth.
- No timer, move limit, or penalties. Non-matching shifts stay in place.
- Mouse and touch: drag a row, tap the turn buttons.
- Keyboard: Q/E or Left/Right turn, Up/Down select a row, A/D shift, H hints, Z undoes.
- Undo restores the board and score before the last action, including cascades (up to 20 actions). Best score is kept.
- Hints mark the row, direction, and number of steps on the board and display. Short contextual prompts teach sliding and turning, then clear.
- Mechanical audio starts on the first interaction; the speaker button mutes it. Audio pauses when hidden.

## itch.io upload

Upload `shift-itch.zip` as an **HTML Game**, and mark the upload as playable in the browser. Its `index.html` is at the archive root and every asset uses a relative URL. Suggested embedded size: **1280 × 820**, with fullscreen enabled. Enable **Mobile Friendly** after testing on your target devices. Click-to-launch fullscreen is also suitable.

Official upload requirements: https://itch.io/docs/creators/html5

The game needs a web server; opening `index.html` directly with `file://` does not support JavaScript modules. Audio may be unavailable in restrictive browsers; gameplay continues. Best score uses browser-local storage when permitted. It is not synchronized across devices.

## Architecture / provenance

- `src/engine.js`: pure board generation, rotation, wrapping shifts, run detection, gravity, hints.
- `src/game.js`: pointer/keyboard input, animation state machine, DOM interface.
- `src/renderer.js`: flat cartridge, sliding bakelite tiles, printed pixel glyphs, and turn animation.
- `src/board.js`: flat board projection, pointer mapping, and turn framing.
- `src/audio.js`: feedback-event subscriber, Web Audio sample playback, short synthesized match tones.
- `assets/audio/`: original grab, tick, thunk, and whoosh samples copied from `QuasarEngine/projects/Shift`.
- `tests/engine.test.js`, `tests/board.test.js`: deterministic rules, cascades, projection, hit testing, and turn continuity tests.

The original Quasar prototype's 6×6 board, six colors, row wrapping, damped springs, quarter turns, one queued rotation, and four sounds are preserved. Match clearing, gravity, cascading, score, hints, stronger magnetic drag detents, single-instance gutter handoffs, and the retro console presentation extend that prototype.
