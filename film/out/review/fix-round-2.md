# Final fix pass: notes for an agent fixing one shot

You are fixing one named fault in one shot of a finished short film, "All of Them" (77.4 s, 1920x1080, 60 frames a
second). You did not build the shot. Read this page, then `SHOTS.md` in the project root (how every shot is built: the
module contract, the terminal's two rows, hand-overs, `handoff()`, the tools), then the shot's own file.

## The film in one paragraph
One Claude Code terminal session makes a film, and each step of the making is drawn in a different motion-design
style: fifteen styles, one shot each (`film/js/shots/01-line.js` to `15-variety.js`, plus `open.js` and `end.js`).
Every frame is a pure function of time, painted on a canvas by the shot's `render(g, env)`. The terminal's two rows
(what the agent printed, and the prompt) survive every style. Styles never cut or cross-fade: at each bar line the
arriving shot does something to the live picture of the shot before it (`env.other`). The cue sheet `film/cues.json`
holds the timing (124 BPM, positions in beats) and every word the terminal prints.

## What you may touch
- Only the shot file(s) named in your task, that shot's own folder under `film/js/shots/`, and its assets folder.
- Not the engine (`film/js/main.js`, `term.js`, `clock.js`, `gl.js`, `util.js`), not `film/cues.json`, not other shots,
  not the tools, not the docs. If the fix truly needs one of those changed, build so it works either way and say
  exactly what you need in your report.
- Do not change the keys your shot's `handoff(env)` returns or what they mean, its `dock()`, or the beats of its sound
  cues unless your task says so (if a sound's beat must move, report the new beat).
- Do not change anything that already works: this is a repair, not a redesign. Every number and name on screen must
  still come from the cue sheet or from `ctx`.

## How to look at your work (from the project root)
```sh
node tools/sheet.mjs <shot> --at 0.5,3,7            # full-size stills at local beats -> film/out/sheets/<shot>/b*.png
node tools/sheet.mjs <shot> --from -0.5 --to 1.5 --n 24 --cols 6    # a dense strip around the way in (sheet.jpg + stills)
node harness/render.mjs film --from 40.4 --to 41.6 --workers 2 --query shots=sticker,pixel,synth --out film/out/clips/x.mp4
ffmpeg -v error -i film/out/clips/x.mp4 -vf "signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null -   # mean brightness of every frame
```
`sheet.mjs` builds the shot with its two neighbours. Shot times in seconds are in `film/out/film.json` (`shots`).
Look at full-size stills, not only sheets, and at every frame of the moment you changed. The jurors' own frames of
the fault are under `film/out/review/jury2-a/`, `jury2-b/`, `jury2-c/` (images only: open the ones your task names).
Do not run `tools/thumbs.mjs`, `tools/build.sh`, `tools/mix.mjs` or `tools/joints.mjs`. No subagents. Do not ask the
user anything.

## Report (your final message, plain text, under 250 words)
For each fault in your task: fixed, partly fixed or not fixed, with one line on what you did and how you checked it
(name the frames or measurements). Then any sound cue whose beat changed, anything you need changed outside your
files, and the paths of two stills that show the result.
