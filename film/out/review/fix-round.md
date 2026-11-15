# Fix round 1: what every shot's builder needs to know

The first full cut (`film/out/all-of-them_v1.mp4`) went to three independent jurors. Scores 7.0, 7.0, 7.2: **7.1 / 10**.
Their full findings are in `film/out/review/round1.md` (fix IDs A1 to A9, B1 to B10, C1 to C10). The frames they
looked at are in `film/out/review/jury1-a/`, `jury1-b/`, `jury1-c/` (contact sheets, filmstrips around each change of
style, full-resolution frames): look at the ones that show your shot before you change anything.

The film now prints the real numbers: `7.1 / 10 · 26 fixes` in the HUD shot and `26 fixes applied` in the collage.
So each of the 26 fixes has to really land. If one of yours does not, say so plainly in your report: the number on
screen will be corrected to what was really done.

## What changed since you finished your shot
- **Shot files are renamed** to the names the terminal prints in the film: `film/js/shots/01-line.js`, `02-boil.js`,
  `03-bauhaus.js`, `04-iso.js`, `05-flat.js`, `06-morph.js`, `07-liquid.js`, `08-sticker.js`, `09-pixel.js`,
  `10-synth.js`, `11-hud.js`, `12-collage.js`, `13-soft.js`, `14-aurora.js`, `15-variety.js`. `open.js` and `end.js`
  keep their names. Each shot's own folder (`film/js/shots/<name>/`) and `assets/<name>/` are unchanged. The tools
  still take the short name: `node tools/sheet.mjs iso`.
- **Cue sheet** (`film/cues.json`; only the lead edits it): `iso` Write lines are on sixteenths (0.5 + 0.25k, result at
  5.0); `boil`, `flat`, `morph` tool lines now name real files and commands; `liquid` result is `502 cues · -14 LUFS`
  (the real mix); `bauhaus` enters with `pre: 1` (it owns the picture from one beat before its bar line); `sticker`'s
  first sentence is at beat 0.5; `hud` result is `7.1 / 10 · 26 fixes`; `collage` has 17 `Update(...)` lines (open.js,
  01 to 15, end.js) at 0.75 + 0.25k and the result `26 fixes applied` at 5.25; `aurora` has `"file":
  "all-of-them_v2.mp4"` (`ctx.shot.file`); `music.duck` silences the music for the beat before the hero title.
- **Engine:** a shot that enters with `freeze` now keeps the frozen frame as `env.other` while the next shot takes
  over from it. `assets/thumbs/` holds real stills of all seventeen shots (`film/out/sheets/thumbs.jpg`).
- **Sound:** every sound you declared is generated (`audio/sfx/<name>.wav`, list in `audio/sfx.json`) and in the mix.
  The mixer puts a percussive sound's loudest moment on its cue. If you add, rename or re-time a sound, list it in
  your report with one line describing the sound; do not generate anything yourself.
- `node tools/joints.mjs` renders every change of style onto two sheets (`film/out/sheets/joints/`).

## Rules for this round
- Only your own shot file, its folder and its assets folder. Not the engine, the cue sheet, other shots or the docs.
  If a fix needs a cue or engine change, say exactly what in your report and build so it works once it is made.
- Do not regress anything a juror listed as present or working. Do not change your shot's `handoff()` keys or what
  they mean; a neighbour depends on them.
- Every number and name on screen still comes from the cue sheet or `ctx`.
- Stills before motion: `node tools/sheet.mjs <name> --at ...` and dense strips (`--from a --to b --n 16`) of every
  moment you changed, looked at in full size. Check your hand-overs both ways.
- Do not run `tools/thumbs.mjs`, `tools/build.sh`, `tools/mix.mjs` or `tools/joints.mjs`. No subagents, no questions
  to the user.

## Report (your final message, plain text, under 300 words)
For each fix ID you were given: applied, partly applied or skipped, and one line on what you did (a better solution
than the juror's is fine: say why). Then: sounds added, renamed or re-timed (`name | local beat | sound | seconds`);
anything you need from the lead; the paths of two stills that show the biggest change.
