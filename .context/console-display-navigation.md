# Console display navigation — 2026-11-21

## User requirements
- Main menu should feel retro, not bland or literally say Main menu.
- No promotional/filler copy.
- Entire experience inside one constant console. Settings, help, briefs, results, restart confirmation must be display pages, not popup panels.
- Console dimensions vary only with responsive screen sizes, not current view or run type.

## Implementation
- Shared existing pixel SHIFT mark, static strip of the actual tile glyphs/palette, phosphor selection rows, arrow keyboard navigation; no new slogan.
- Replace native dialogs with sections within `.screen`. `GameShell.show/open/back` own view visibility, previous-view/focus history, and Escape navigation. View-change event resets frame clock; hidden gameplay remains inert and paused.
- Fixed display dimensions per breakpoint; gameplay uses its reserved space with a square canvas. Physical controls retain their space/appearance and become inert outside play.
- Decorative SVG packaged locally; dev server serves SVG MIME type.

## Validation
- 32 tests pass, including nested page Back/focus restoration, repeated-page protection, inert gameplay, Escape from results/briefs, and controller pause/resume.
- Browser checked home/settings/help/free play/restart/map/brief/campaign. All sections are inside `.screen`; no dialog elements remain.
- Measured identical cabinet bounds between home/settings/help/free play and campaign at a given viewport. Portrait 320×568 and landscape 844×390 fit without document overflow; square canvas fits its stage in both modes.
- Dev preview restarted to enable SVG MIME support; build and diff checks pass.
- Native touch hardware remains untested.
