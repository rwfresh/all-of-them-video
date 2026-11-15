---
name: code-film
description: "Make a promo, demo, launch or trailer video entirely in code, with real sound. A web page draws every frame as a function of time, headless Chromium renders it on the GPU, ElevenLabs supplies voice, sound effects and music from one cue sheet, and an independent jury review drives a revision round. Use when asked to make or fix a promo video, demo film, product trailer, motion-design piece or Builder Wars release video, or when the user mentions code-film, the film kit, or a demo like the 1998 one."
---

# Code film

A film here is a web page that can draw any moment on request (`window.renderAt(t)`). A small harness asks for every
frame in headless Chromium, on the GPU, and ffmpeg joins the frames and the soundtrack. Nothing is filmed or generated
as video, so the picture is exactly what the code says, at any resolution, every time.

The kit in this folder was proven on "Dial-A-Dev 98" (Builder Wars weekly theme "Shipped in 1998", Nov 2026): 44 s,
1920x1080, eleven shots, 1,326 frames rendered in about 45 s. That film's full source is in `examples/dial-a-dev-98/`.
The pattern follows github.com/Vincentwei1021/mg-styles-15 (MIT), which is also a good primer on motion-design styles.

## Start a film

```sh
bash ~/.claude/skills/code-film/new-film.sh ~/Work/<film-folder>     # copies the kit, installs two local packages
cd ~/Work/<film-folder>
# sound needs an ElevenLabs key: the user saves ELEVENLABS_API_KEY=... in ./.env themselves (never ask for it in chat)
node harness/render.mjs film --stills 0,1,2        # PNG stills -> film/out/stills/
bash tools/build.sh v1                              # cue list, mix, render, X encode -> film/out/<filmName>_v1.mp4
```

Keep the film in its own folder outside any product repository. Ask before installing anything global.

## Order of work

1. **Brief.** Product, audience, where it will be posted, length, shape (16:9, 9:16, 1:1). For Builder Wars, call
   `get_video_guide` and follow its rules (they win over this file).
2. **Treatment.** One idea, a hook in the first half second, an escalation, one hero moment at about 60-75 % of the
   runtime, and a composed end frame. Pick one style and write down its signature features as testable statements.
3. **Cue sheet first** (`film/cues.json`). Write the voice script as lines, with estimated durations. Shots are tied
   to lines and spoken words, never to hard-coded seconds, so a new voice take retimes the whole film.
4. **Stills before motion.** Build the look of the two or three hardest frames and look at them at full size.
   Do not animate a frame that is not yet poster-worthy.
5. **Shots.** One module per shot (contract below). Check each with stills and small contact sheets.
6. **Voice.** Audition (stock voices and three designed ones), record every line with word timings, then let the
   cue sheet move the cuts: `node tools/vo.mjs --voice <id>`, then `--reuse --tempo 1.12` to tighten the read.
7. **Sound effects and music.** List them in `audio/sfx.json` and `audio/music.json`, generate with
   `node tools/sfx.mjs --music`. Each shot declares its own sound cues, so hits stay glued to the picture.
8. **Build** (`tools/build.sh`), then read the contact sheet yourself and fix what you see.
9. **Jury.** Give an independent agent `rubric.md`, the file and the brief. It did not make the film; it scores and
   returns ordered fixes. Apply them, rebuild, and only then show the user. Two rounds if time allows.
10. **Finish and hand off.** `tools/finish.sh` encodes for X and makes the poster and contact sheet. Run the
    destination's own checker. The user posts; never post for them.

## The page contract

- `window.FILM = { width, height, fps, duration, shots, lines, sfx }`, `window.renderAt = async (t) => {...}`,
  then `window.__ready = true`.
- Every frame is a pure function of `t`: seeded randomness only, no clocks, no CSS transitions, no state carried
  from one frame to the next. The harness may ask for frames in any order and on several browsers at once.
- A shot is `{ name, samples(lt), render(lt, post, renderer), overlay(g, lt), look(lt), sfx: [...] }`:
  - `render` draws linear HDR into `post.scene`; `overlay` draws 2D supers on a 1920x1080 canvas (return true if it drew);
  - `samples` is the motion-blur sample count for that moment (3 when calm, 12-20 during fast moves);
  - `look` returns post settings (bloom, flash, tape amount, glitch);
  - `sfx` lists `{ t, s, g, a, len }`: local time, sound name, gain, `a: 'peak'` to land the sound's loudest moment
    on the cue, and an optional cut length.
- `film/js/film.js` maps shot names to factories and draws anything that sits over every shot.
- Query switches for look development: `?clean` (no tape pass), `?nocc` (no captions), `?mb=1`, `?rs=0.5`.
- `render` also receives the pass number and count (`render(lt, post, renderer, i, K)`), and a shot may set
  `shutter: 0`. With no motion blur the K passes are free for other things: move the lens for depth of field, the key
  light for soft shadows, and the pixel grid for antialiasing (the storybook's `rig.js`). `look()` may return
  `paper: true` for a clean finish (colour-true tone curve, grain, vignette) in place of the tape pass.
- `film.js` may export `loadFonts` (anything async that must finish before the first frame), `buildCaptions` and
  `caption`.

## This machine (checked 2026-11-11)

- Chromium 155 at `/usr/bin/chromium`, RTX 4070 Ti SUPER. Hardware WebGL2 needs `--use-gl=angle --use-angle=gl-egl`
  (the harness passes them and warns if it falls back to software). WebGPU falls back to software: use WebGL2.
- ffmpeg 9 with libx264 and NVENC; ImageMagick for contact sheets; no Blender, no numpy outside a venv.
- Full 1080p render: about 0.03 s per frame with three workers.

## ElevenLabs notes (checked 2026-11-11)

- The key lives in the film folder's `.env`. A key can lack `user_read`, so the plan and remaining credits may not
  be readable; say so rather than guess.
- The plan in use allows `mp3_44100_128` at most (higher formats need the Creator plan). Speech model `eleven_v4`
  works and takes audio tags such as `[excited]`; the tags come back in the alignment and are stripped by `vo.mjs`.
- Stock voices read slowly for a hard sell. A designed voice (`eleven.mjs design`, then `voice-save.mjs`, which uses
  one voice slot) plus `--tempo 1.12` gave the infomercial pace. The `speed` setting barely changed the timing.
- Sound effects vary wildly in level and one came back silent: `mix.mjs` peak-normalises every file, skips
  near-silent ones and says so. Regenerate those with a plainer prompt ("One loud hand clap" worked where a
  described clapperboard came back silent three times).
- A storyteller voice reads slowly: the stock voice George measured 2.25 words a second. `--tempo 1.25` brought it
  to 2.7, an ordinary speaking pace. Decide the length from the recorded lines, not from a word count.
- Generated music ends before its stated length. `mix.mjs` finds where the level really ends and lines that up
  with the end of the film.
- A character voice (say, a kids' TV mascot) reads at the pace its description gives it: the same text took 31 s
  with "speaks slowly to toddlers" and 24 s with "lively, brisk pace". Put the pace in the description, design two
  or three descriptions (three previews each), measure them with `tools/audition-stats.mjs` (length, median pitch,
  pitch range) and expect `--tempo 1.3` on top. Describe a type; never name a real character or person.
- A voice the user picked from an audition can sound higher in the film although it measures the same pitch and
  brightness: the model reads single lines about 1.3 times faster than a long audition passage, and `--tempo` on top
  makes the voice sound higher and smaller. `vo.mjs --reuse --tempo 1.38 --pitch -2` lowers it at the same speed
  (the timings do not change, so re-mix and re-run `finish.sh` on the old master; no render). Make comparison clips
  at 0, -1, -2, -3 semitones for the user's ear, and re-check the voice stem level afterwards (`mix.vo`).
- `voice-save.mjs <generated id> "<name>" "<description>"` saves a preview to the account (one voice slot). Keep the
  previous narrator's takes (`cp -r audio/vo audio/vo_<name>`) before recording a new one.
- Free plans are not licensed for commercial posts. If the plan is unknown, tell the user.

## What went wrong, so it does not again

Picture and code:
- Estimating when a word is spoken from its position in the text is wrong by up to a second ("98" is spoken as
  "ninety-eight"). Use the recorded word timings (`mark(line, word)`).
- three.js sizes extruded text larger than the nominal size. Fit words to a target width; never trust the number.
- A flat mirror lit by a directional light goes uniformly white. Give discs and chrome point lights or a varied
  environment so the highlight is a hotspot.
- Overlapping tilted discs intersect. Shingle them in depth and limit the tilt.
- Blurred floor reflections turn backdrop sparkles into dot grids: switch the sparkles off in the mirror pass.
- Faux-bold bitmap type (drawing the text twice, one pixel apart) fills in W and M. `ui98.js` thickens a stroke only
  where the gap to the next stroke stays open.
- A logo whose top half is close to the backdrop colour disappears. Give extruded letters a dark keyline
  (`outline` in `makeLetters`) and keep their side walls near black.
- Tape noise is expensive to encode. Render lossless (`--lossless`), then encode once with a bitrate cap.

What the first jury round found on a film I thought was done (score about 6/10). Check these before the jury does:
- The product name must be on screen by about 2 seconds and frame 0 is the thumbnail. A standing lower third with
  the name, from the first frame, solved both.
- Supers and captions covered the best jokes. After placing any super, look at what is underneath it.
- Text ran outside title-safe after camera pushes. Check the last frame of every push, not the first.
- The same white flash and glitch on every cut reads as a template, as does one backdrop for four shots and five
  identical starbursts. Vary them; keep the big flash for one or two hits.
- Captions that look fine at 1080p are too small on a phone: letters about 40 px tall, in their own band.
- A premise that never pays off. The film says "unless someone picks up the phone", so someone has to.
- Sound hits that land under a spoken word are inaudible. Move the hit after the word and raise it.

What two jury rounds found on the paper storybook film (about 6/10, then about 7/10). Check these first next time:
- Real product screens shown full-frame read as a screen recording and break the world. Keep them inside the scene
  (a laptop in the set), as two large crops with big type, changed with an in-world wipe of 16 frames or more. Crop
  out any border so the screen's sides have no seam, and label in-game money as pretend.
- Numbers must agree across shots. "Pretend millionaire" followed by a board showing $9,100 undid the hero line.
- The hero shot went still for 1.4 s. Keep something moving through every hold (coins pouring, lights blinking,
  a second burst when the line ends), and frame it wide from its first frame.
- A voice gap longer than a second with only a faint bed reads as dead air. Shorten it or put a gag and a sound in it.
- Flat shapes with clean edges read as vector art even with grain on top. A slightly wandering cut line and a
  lighter paper core along the edge (`piece()` in the storybook's `paper.js`) fixed that. Signs should be cut letters
  (`cutSign`), not printed type.
- Anything that floats needs a visible support (a stalk, a spring, a tab). Light beams must be opaque paper.
- Key actions were too small for a phone: a coin flip, a crown changing heads, a button press. Scale the action and
  push the camera in for it.
- Pop-ups passed through each other and through turning pages. True fold geometry makes reader-facing folds lie
  back the instant a spread starts to close. Keep those folds upright, make every pop-up stay low until its spread
  is nearly open (`rise` in `book.js`), and hide pieces that lie flat inside the shut book.
- A page must not start turning before its sentence ends: a shot's `lead` must not be longer than the `gap` before it.
- A caption that repeats a punchline the picture delivers spoils it. `cc` on a line may hold just its opening words;
  the caption then leaves when the rest is spoken.
- End on the first frame: the book shuts onto its cover with the address on a band. It also loops cleanly.

What the user changed after watching that film (cut v4):
- A joke at another character's expense ("Sam hates Kim", a storm cloud) read as mean. He asked for the joke to be on
  the hero: Sam sheds a tear, then daydreams of being first ("Dream, Sam, dream."). Aim gags at the hero.
- A slogan copied from the product ("Highest monthly income wins") made him ask what is won; nothing was. Check every
  claim in the script against what the product really does before recording it.
- A thought cloud is taller than the frame: raise the camera with it, keep the thing it mirrors in frame (the real
  board under the dream board), and burst it a few frames before the page turns so nothing tall rides the leaf.

Splitting the work:
- Build the look and the engine in one session first (two or three frames the user approves), and write the shot
  contract and a brief for every shot to files (`SHOTS.md`, `BRIEFS.md`). Then fan the shots out to fresh agents,
  one or two shots each, with `model: "opus"` and those files as the brief. Do not use forks for this: a fork always
  runs on the session's own model and effort and cannot be given a cheaper one (on the styles film, forks were 55%
  of the usage). Each agent owns only its own shot file; write shared characters first; load shot modules one by one
  so a file broken mid-edit blanks only its own shot. Fan jury fixes out the same way, to fresh agents given the
  shot file and the fix list, not by resuming the builders; keep engine files for the main session.
- Give the jury to a fresh agent each round and tell the second one not to read the first one's notes.

Process:
- `pkill -f <pattern>` matches the shell running it. Write the pattern as `[p]attern`.
- A page error leaves the harness waiting. It gives up after 45 s and prints page errors; do not pipe it through
  `tail` while debugging, or the errors arrive only at the end.
- Refactors are safe to verify: render the same still before and after and compare checksums. Frames are
  deterministic, so they must match exactly.
- I cannot hear. Voice choice, music and effects are judged by measurement only, so say that and give the user
  auditions to pick from by ear.

## Mix directions in the cue sheet

- `"music": { "from": "<shot>" }` in `cues.json`: the music enters with that shot, so an opening can play dry.
- A shot sound cue `{ t, s: '__music_stop' }` cuts the music dead at that moment (for a punchline).
- `"hiss": 0` for a clean track; the default adds a breath of tape hiss.
- `filmName` in `package.json` names the output files.
- `"mix": { "vo": 1, "sfx": 0.7, "music": 0.8 }` sets the bus levels. The default music level sat 14 dB under the
  voice; 0.8 put it about 10 dB under.
- `"music": { "endLevel": 0.1, "endPad": 0.25 }` ends the film while the music is still up, with a short fade,
  when a generated track's last note dies away early.

## Files here

- `kit/`: the harness, the tools, the generic director (`film/js/main.js`), post chain, timeline, supers and a
  one-shot starter film.
- `examples/dial-a-dev-98/`: the complete 1998 film: chrome type, diffraction discs, box art, the bevelled desktop
  toolkit, the picture-tube screen and the VHS pass. Borrow from it.
- `examples/storybook/`: the paper pop-up film: cut-paper pieces, accumulation rendering for depth of field and soft
  shadows, a book with page turns and pop-ups, one module per spread, paper-strip captions. Its README maps the files.
- `rubric.md`: the jury prompt. `new-film.sh`: scaffolds a film folder.
