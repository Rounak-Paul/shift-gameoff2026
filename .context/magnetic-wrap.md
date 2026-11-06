# Magnetic row wrap

## User intent
- A tile must fully disappear from the outgoing side before entering from the opposite side; it should feel like the same tile travelled.
- Movement should feel magnetic: resistance before a threshold, followed by a snap to the next position.
- Preserve the console, single active-row full-width gutters, and no landing shake.

## Implementation
- `src/board.js::magneticTarget(raw,detent)`: threshold .56 cells; reverse threshold .44 creates hysteresis. Visual tension is 18% of residual distance. Detents limited to ±6 cells. Normalize negative zero.
- Pointer events update the magnetic target; the animation frame springs actual row offset toward it while held. Release settles to the selected detent, without projecting additional flick momentum. Cancellation returns to zero. Keyboard shifts keep their existing spring.
- `slidePosition(column,cells)` replaces duplicate wrap copies. Normal cells follow the row. Across the seam, the tile accelerates along its outgoing gutter, becomes entirely offscreen at center x634, stays hidden for phases .46..54, then enters at x-34. The route is reversible for left shifts and mid-gesture reversals. Endpoint tangents join resting cell positions continuously.
- `src/renderer.js` draws each source tile at most once; it never draws simultaneous outgoing/incoming copies. Gutter shading still applies, with no scale fade or y displacement on transit.

## Verification
- 14 Node tests pass, including hysteresis/jitter/clamps, full exit before entry in both directions, and periodic continuity across -18..18 cell offsets.
- Local browser drag produced one selected detent; settled normally, with no warning/error logs at the check. Real touch hardware remains unverified.
- Build regenerates dist and itch ZIP. No commits/pushes.

- A/D uses a 45 ms preload to mimic drag tension, then releases through the detent spring and commits at first arrival. This supersedes the uniformly accelerated keyboard shift.

- Row pick and release sounds were removed. Detent clicks provide row movement feedback.
