# All of Them: how a shot is built

The film is one Claude Code session that gets redrawn in fifteen motion-design styles. Each style is one shot: one
file in `film/js/shots/<NN>-<name>.js` (`01-line.js` to `15-variety.js`; `open.js` and `end.js` have no number). The director (`film/js/main.js`) asks shots to paint frames; the cue sheet
(`film/cues.json`) says when each shot plays and what the terminal says.

Read `film/js/shots/open.js` (a finished shot) and `film/js/shots/_placeholder.js` (the smallest possible one) first.

## The module

```js
export default async function make(ctx) {
  // load fonts, images, data; build scenes. Runs once.
  return {
    render(g, env) { /* paint the whole 1920x1080 frame for this instant onto g (a 2D canvas context) */ },
    dock(g, env, part) { /* this shot's two terminal rows in its own skin; part 'B' or 'C' draws just one */ },
    samples(env) { return 1; },          // optional: motion-blur samples for this instant (1 = none, 8-12 for fast moves)
    sfx: [{ b: 0, s: 'whoosh', g: 1, a: 'peak' }],   // optional sound cues: local beat, sound name, gain, 'peak' = loudest moment on the cue
  };
}
```

`ctx`: `W, H, fps, cues, clock, script, shot` (this shot's entry: `name, bars, beats, b0, t0, dur, ...`), `tag`
(`{ num: '07', of: '15', name: 'LIQUID' }`), `font(family, url, desc)`, `image(url)`, `makeCanvas(w, h)`, `useGL()`, `util`,
`music` (`music.at(t)` gives the real track's `{ rms, low, mid, high, bands[8] }`, each 0 to 1, at film time `t`).

What each shot shows is in `BRIEFS.md`. Stills of every shot, for shots that show the film's own frames, are in
`assets/thumbs/<shot>.png` (960x540; `node tools/thumbs.mjs` refreshes them).

`env`, new for every call: `t` (film seconds), `lt` (seconds since this shot's bar line), `ab` (absolute beat),
**`lb` (local beat, the one to use)**, `beats` (this shot's length), `spb` (seconds a beat), `frame`, `term` (the
terminal, below), `tag`, and during a hand-over `other`, `otherImpl`, `otherEnv`, `x`, `role`, `noDock`.

## Rules that keep it working

1. **A frame is a pure function of time.** No clocks, no state kept between calls, seeded randomness only
   (`util.rng`, `util.hash`). Frames are asked for in any order, on several browsers at once.
2. **Time is beats.** The film's clock is the music's and the tempo may change. Place everything with `env.lb`;
   never write seconds. Hits land on beats and half-beats. For styles on a low frame rate, hold time yourself
   (for 12 pictures a second: `Math.floor(env.lt * 12) / 12`).
3. **Paint the whole frame, every call.** The canvas arrives cleared and in its default state.
4. **`lb` runs outside the shot.** During hand-overs you are asked for `lb < 0` (before your bar line) and
   `lb > beats` (after the next one). Both must give a sensible picture: hold or keep moving, never blank.
5. **One WebGL context.** If you need the GPU: `const R = ctx.useGL()` at the start of each render (it resets the
   shared three.js renderer), draw to its canvas, then `ctx.blitGL(g, R)` (add `{ alpha: true }` for a see-through
   layer). Never create your own WebGL canvas, and never copy with `g.drawImage(R.domElement)`: now and then it
   returns the frame before. `film/js/gl.js` has a full-frame shader helper; `film/js/post.js` and `stage.js` are
   the 1998 film's bloom, tape pass and chrome letters. `synth.js` is a finished GPU shot to read. The first frame
   through a new shader chain can come out black: draw one or two throwaway frames in `make()`.
6. **Only your own files.** Your shot file, plus `film/js/shots/<name>/` and `assets/<name>/` if you need more.
   Do not edit the engine, `cues.json`, other shots, `index.html` or `CREDITS.md`: say what you need changed in
   your report (new cue beats, a different hand-over length, a licence row).
7. **Fonts and assets are local files** with licences that allow commercial use (OFL, CC0, public domain, Apache,
   MIT). Load fonts with `ctx.font`. No photographs: where a style wants photos, use this film's own frames.
8. **Budget:** about 0.15 s a frame at most. Precompute in `make()`.

## The terminal

Every shot shows the same two rows, on the same grid, in its own skin (`film/js/term.js`):

- **Row C, the prompt** (baseline `DOCK.rowC` = 960): `>` at `DOCK.x` = 168, letters from two columns in, one letter
  every `DOCK.adv` = 36 px, sized like 60 px monospace. `env.term.rowC` = `{ mode, text, n, cursor, keyAge(i) }`:
  `cmd` (the command that started this shot), then `typing` (the next prompt, `n` letters so far; `keyAge(i)` is
  beats since letter `i` was struck, for a pop on each keystroke), or `idle`.
- **Row B, what Claude printed** (baseline `DOCK.rowB` = 850): `env.term.last` = `{ kind: say|tool|result|spin,
  text, age, chars }`; `env.term.out` has all of them so far.
- `env.term.blink`: the cursor's lit half. It blinks on the beat and stays lit while typing.

The letters must stay on the grid (centre a letter of any font in its 36 px cell). What carries them is yours: a
strip of paper, a dialogue box, a glass card, a neon tube, a HUD read-out. The cursor is the film's hero: between
prompts it may leave the row and act in your world, as long as it is back when typing starts.
Prompt letters at least 40 px tall for capitals; anything else that must be read at least 28 px. Reading time: one
second for every six words. Title-safe: x 96 to 1824, y 54 to 1026.

Also draw the style tag (`env.tag`: "07/15 LIQUID") in your own lettering near the top left (about x 168, y 150).

## Hand-overs

Finished examples: `line.js` (takes the real terminal apart with `layers()`), `synth.js` (takes any picture as a texture).

`cues.json` gives each shot `enter: { owner, pre, post }`: who paints the change at its bar line and for how many
beats before and after it. The owner is painted second and receives:

- `env.other`: a canvas with the other shot's picture at this instant (it keeps running, so it is alive).
- `env.x`: progress 0 to 1 across the window. `env.role`: `'in'` (you are arriving) or `'out'` (you are leaving).
- `env.otherImpl`, `env.otherEnv`: the other shot itself, for its `dock()` or its `layers()` if it has them.
- With `"freeze": true` in `enter` (owner "in"), `env.other` is the outgoing shot's last frame, held still.

**Changes are carried by something in the picture, never a cross-fade or a plain wipe.** The arriving style does
what it does to the picture before it: floods it, cuts it up, pixelates it, draws over it, freezes it.

The prompt row has its own hand-over: `swapDock(g, env, dock)` (term.js) changes the letters from the old skin to the
new one column at a time. When both shots have `dock()`, the other shot is told `env.noDock` and leaves its rows
out; the owner calls `swapDock`. So: honour `env.noDock` in `render`, and give your shot a `dock()`.

## Joints: what one shot passes to the next

So the arriving shot can take hold of real objects and not only pixels, every shot also returns
`handoff(env)`: the things on screen at that instant, in frame pixels. It must work for any `lb`, also past the
shot's end. The arriving shot reads `env.otherImpl.handoff?.(env.otherEnv)` and must fall back to its own made-up
values when the neighbour is a placeholder card (no `handoff`).

| joint | the leaving shot's `handoff(env)` | if the neighbour is not built |
|---|---|---|
| line to boil | `line.geometry` (fixed: `curve, sun, labels, lineWidth`) | built |
| boil to bauhaus | `{ panels: [{x,y,w,h} x3], flame: {x,y,r}, paper, ink }` | |
| bauhaus to iso | `{ modules: [{x,y,w,h,color}, at least 15], paper }`: the final poster's squares, on the 240 px grid | iso makes up a poster on that grid |
| iso to flat | `{ buildings: [{x,y,w,h,color,num} x15], ground }`: each building's box on screen | |
| flat to morph | `{ dot: {x,y,r,color}, bg }` | dot at (960, 440), r 120, coral #FF5A4E on cream #FFF6E9 |
| morph to liquid | `{ drop: {x,y,r,color}, bg }` | |
| liquid to sticker | liquid paints this one itself (owner "out") | |
| sticker to pixel | `{ tiles: [{x,y,w,h}], bg }`: the frame tiles in view | |
| pixel to synth | nothing: the tape takes any picture | |
| synth to hud | the frozen last frame; read `synth.js` for where things are | built |
| hud to collage | `{ brackets: [{x,y,w,h,label}], color }` | |
| collage to soft | `{ pieces: [{x,y,w,h,rot,color}], paper }` | soft makes up nine pieces on kraft #C9A77A |
| soft to aurora | `{ lights: [{x,y,r,color}] }`: the brightest out-of-focus highlights | |
| aurora to variety | `{ card: {x,y,w,h,r} }`: the main glass card | 760x428 centred on (960, 420), r 40 |
| variety to end | `{ phone: {x,y,w,h,r} }` | |

## Looking at your work

```sh
node tools/sheet.mjs <shot>                      # 12 stills across the shot -> film/out/sheets/<shot>/sheet.jpg
node tools/sheet.mjs <shot> --from -2 --to 4     # around the hand-over in
node tools/sheet.mjs <shot> --at 0.5,3,7 --solo  # full-size PNGs at exact beats, without neighbours
node harness/render.mjs film --from 3.5 --to 10 --out film/out/clips/<shot>.mp4    # a clip (seconds; see film.json)
node harness/render.mjs film --info film/out/film.json   # shot times in seconds, every sound cue
```

`sheet.mjs <shot>` builds only that shot and its two neighbours (the rest show placeholder cards), so another shot's
bug or slow start cannot hurt you; add `--film` to build every shot. For a clip, do the same by hand and keep to two
browsers, because several agents render at once: `--workers 2 --query shots=flat,morph,liquid`.
Do not run `tools/thumbs.mjs`, `tools/build.sh` or `tools/mix.mjs`: they write files every shot shares.

Look at full-size stills, not only sheets. A frame that is not poster-worthy is not ready to animate.

## The bar

Each style follows its prompt in github.com/Vincentwei1021/mg-styles-15 (`prompts/<nn>-<name>.md`): hit every one of
its signature features, and an expert should name the style in one second. Things past reviews caught, so check
them first:

- Text outside title-safe after a camera move; text too small for a phone; a label covering the best thing on screen.
- A hold where nothing moves. Keep something alive through every hold.
- Anything that reads as a template: the same entrance twice, a grid of tiles, a row of boxes.
- A key action too small to see on a phone. Scale it up and push in.
- Numbers that disagree between shots. Every number on screen comes from `cues.json` or from the film's real build.
- Sound hits belong on the picture's hits: list them in `sfx` at the beat they happen, named `<shot>_<what>`. The
  sounds are generated afterwards from one line of description each, so give that line in your report.
