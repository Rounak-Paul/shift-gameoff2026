# Flat sliding cartridge

- Latest user instruction: forget the cylinder, redesign. Preserve the approved console; remove all curved geometry, caps and reel-window framing.
- Flat 6×6 cartridge: 600-unit canvas, center 300, grid origin 84, pitch 72. Outer frame x/y65..535 with corner fasteners; shallow cream tiles, colored printed pixel glyphs and horizontal row tracks.
- Dragging wraps tiles through side edges of a clipped rectangular grid. Hover/selection uses inset selector shoes on both cartridge rails, three small illuminated segments, warm brass track edges, and a subtle warmer tile face. Hover is muted; selected/dragged/hinted rows get brighter amber accents. No up/down motion or landing shake.
- Q/E rotates the complete square cartridge. Pixel glyphs counter-rotate to remain upright; committed tile positions agree with the rotated logical matrix. A scale factor 1/(1+.14*abs(sin(2a))) keeps corners visible at diagonal orientations.
- `src/board.js` owns geometry; `src/renderer.js` owns visuals; `src/game.js` owns input/state. Removed obsolete `src/drum.js` and cylinder tests.
- Rules and original Quasar feedback sounds unchanged. Shape/color pairing supports distinguishing all six tile kinds.

## UI/UX pass
- Undo tracks up to 20 completed moves, including cascades. Contextual display cues and directional hints replace persistent copy. Selected rows use mechanical inset rail markers; hint includes direction/steps. Match flash holds briefly before shrink, score feedback sits above tiles. Busy/pressed/queued controls are explicit.
- No position animation on drop. Original console and flat cartridge preserved.
- Final browser checks: Undo restored a hinted match from 30 to 0 and separately undid a quarter-turn; reset confirmation defaults to Keep playing. Small portrait 320×568 and landscape 844×390 fit without document overflow. No warning/error logs observed. Utility actions have labeled 42×44px targets on small phones. Real touch hardware remains unverified.

## Row indicator refinement
- Replaced floating arrows and thin rectangular outline with recessed cartridge-mounted selector shoes, engraved lamp segments, and brass track edges. No glow cloud or movement.
- Selection persists after the pointer leaves (including touch). Hover takes priority while inside the grid; keyboard navigation clears stale hover. Hints keep their direction/step marker and reduced-motion-aware pulse.
- Keyboard focus uses the same cartridge selector (a focused board selects its first row); removed the unrelated full-canvas focus rectangle. Browser rendering checked with no warning/error logs. Build regenerated after this change.
