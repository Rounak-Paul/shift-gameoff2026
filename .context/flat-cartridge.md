# Flat sliding cartridge

- Latest user instruction: forget the cylinder, redesign. Preserve the approved console; remove all curved geometry, caps and reel-window framing.
- Flat 6×6 cartridge: 600-unit canvas, center 300, grid origin 84, pitch 72. Outer frame x/y65..535 with corner fasteners; shallow cream tiles, colored printed pixel glyphs and horizontal row tracks.
- Dragging wraps tiles through side edges of a clipped rectangular grid. Hover/selection uses inset selector shoes on both cartridge rails, three small illuminated segments, warm brass track edges, and a subtle warmer tile face. Hover is muted; selected/dragged/hinted rows get brighter amber accents. No up/down motion or landing shake.
- Q/E rotates the complete square cartridge. Whole tiles counter-rotate to remain upright; committed tile positions agree with the rotated logical matrix. A scale factor 1/(1+.16*abs(sin(2a))) keeps corners visible at diagonal orientations.
- `src/board.js` owns geometry; `src/renderer.js` owns visuals; `src/game.js` owns input/state. Removed obsolete `src/drum.js` and cylinder tests.
- Rules and original Quasar feedback sounds unchanged. Shape/color pairing supports distinguishing all six tile kinds.

- Upright tile faces shrink temporarily to clear their neighbors during diagonal turns and return to full size at either detent.

## UI/UX pass
- Undo tracks up to 20 completed moves, including cascades. Contextual display cues and directional hints replace persistent copy. Selected rows use mechanical inset rail markers; hint includes direction/steps. Match flash holds briefly before shrink, score feedback sits above tiles. Busy/pressed/queued controls are explicit.
- No position animation on drop. Original console and flat cartridge preserved.
- Final browser checks: Undo restored a hinted match from 30 to 0 and separately undid a quarter-turn; reset confirmation defaults to Keep playing. Small portrait 320×568 and landscape 844×390 fit without document overflow. No warning/error logs observed. Utility actions have labeled 42×44px targets on small phones. Real touch hardware remains unverified.

## Row indicator refinement
- Replaced floating arrows and thin rectangular outline with recessed cartridge-mounted selector shoes, engraved lamp segments, and brass track edges. No glow cloud or movement.
- Selection persists after the pointer leaves (including touch). Hover takes priority while inside the grid; keyboard navigation clears stale hover. Hints keep their direction/step marker and reduced-motion-aware pulse.
- Keyboard focus uses the same cartridge selector (a focused board selects its first row); removed the unrelated full-canvas focus rectangle. Browser rendering checked with no warning/error logs. Build regenerated after this change.

## Row-wise wrap gutters
- User requested gutters at each row's left/right edges, with tiles visibly leaving and entering through the other side. Interpreted this as row-slide wrap feedback; Q/E still quarter-turns the whole cartridge.
- Replaced selector shoes with recessed channels x42..84 and x516..558. User corrected visibility: show channels only for the hovered/selected/sliding row, never a full bank. Hide them during quarter turns. Selected/hinted track accents remain brass/amber. Console preserved.
- Sliding tiles now render exactly one instance through a reversible exit/hidden-return/entry route. No periodic copies. The complete tile clears one play-area edge before entering the opposite gutter. Foreground side lips shade transit; there is no y displacement or landing shake. Details: `.context/magnetic-wrap.md`.
- Rotation scale increased from .14 to .16 to fit the wider gutter banks throughout both turns. Tests cover gutter symmetry, concealed resting copies, and rotated bank bounds.

- Visibility correction: side channels and their foreground lips both follow the single visible focus row. They remain locked to the sliding row until settlement. Other rows retain the original frame edges.

- Further correction: visible gutters fill the complete side margin of the play area (left x0..84, right x516..600), only on the hovered/selected/sliding row. They are hidden during Q/E turns, so gutter-bank rotation bounds are no longer applicable. Removed that obsolete geometry test; cartridge bounds remain tested.

## Magnetic handoff
- User explicitly requires the outgoing tile to be gone before opposite-side entry, and wants threshold-triggered magnetic motion. Replaced continuous resisted pointer offsets with a spring-driven hysteretic detent; replaced duplicate wrap rendering with a single reversible transit. No flick projection beyond the chosen detent. See `.context/magnetic-wrap.md`.

- Strengthened the highlighted row’s warm card-face tint. Cards and gutters use the same visible focus row.

- Fixed a missing tile-fit calculation that stopped the render loop before drawing the first tile. Verified the board in-browser at rest and after a clockwise turn. Added a renderer regression test for idle and turn frames.
