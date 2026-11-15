# All of Them: the shots

One Claude Code session, redrawn in fifteen styles. The film follows the real making of a film, one step a style;
each prompt is something you would really type, and it triggers the style that embodies it. 38 bars at 124 BPM,
73.55 s, 1920x1080, 60 fps, music only. Posted on X, where video starts muted: the story must read without sound.

Through-line: **the terminal's two rows and the cursor survive every change.** The prompt that starts a shot is typed
in the skin of the shot before it; Enter lands on the bar line; the arriving style then does what it does to the
picture before it. The cursor is the hero object: in each world it becomes that world's thing (a pen tip, a match, a
dot, a drop, a sprite) and is back on the prompt row when typing starts.

Each style's reference prompt, with its signature features (the checklist a jury will use), is in
`reference/mg-styles-15/prompts/` and at
github.com/Vincentwei1021/mg-styles-15 (`prompts/`, `demos/`, MIT). Our copy is English and our subject is this film.

Music shape (cut A, chosen by Rich by ear on Nov 14): bars 1-15 quiet and gentle, no drums (the typing is the
percussion there, and so are your sound hits); bar 16 swells; **bar 17 the full beat enters** (the biggest rise in the
track, about 12 dB); bars 17-23 full; bar 24 dips a little; **bar 25 the drop** (the hero title); bars 25-32 full;
bars 33-34 the music falls away; bars 35-36 the beat returns; bar 37 a tail, bar 38 silence.
`ctx.music.at(t)` gives the track's real level and eight bands for any moment.

Beats below are local to the shot (`env.lb`). "Row B" is what Claude prints; "row C" is the prompt.

---

## open (bars 1-2) — the real terminal. Built.
`> make me a video.` / `● In what style?` / `> all of them.` Each letter of "all of them." flickers through other
styles' lettering as it is typed.

## 01 line — Line Art — the idea (bars 3-5, 12 beats). With a fork.
Enter on `all of them.` The welcome box's border turns champagne gold on midnight blue and unravels into ONE line
that draws the film's own energy curve, peak where the hero shot will be. Camera follows the pen tip (the cursor),
pulls out to a poster. Row B: `● Write(treatment.md)`, `⎿ one idea, one line`. Next prompt: `sketch it first.`

## 02 boil — Frame-by-Frame / Line Boil — stills first (bars 6-8, 12 beats)
**In (yours):** the gold line is redrawn by hand. Over a few pictures on twos it roughens into wobbling ink while the
ground warms from midnight to cream paper: the same drawing, traced again and again, each tracing rougher.
**Shot:** warm paper, ink line that boils (3-4 redrawn variants cycling every 2 frames of 24), fills slightly off
register, paper grain. Three storyboard frames are sketched in by hand at about beats 2, 3 and 4: thumbnails of this
film's own hardest frames (the isometric city, the chrome title, the phone with captions), drawn, not pasted. The
cursor is a matchstick: it strikes (a smear frame, on ones), a flame spirit jumps out (anticipation, squash) and hops
panel to panel on beats 6, 7, 8; each sketch starts moving as the flame lands on it. Stills, then motion. A burst of
cel effects (smoke puffs, sparks, star bursts, speed lines) at about beat 10. On twos at 24 a second; ones for the
fast action; threes for holds. Palette: ink black, tomato red, sunny yellow, cream.
**Rows:** hand lettering that boils, on the grid. Row B: `● Bash(node harness/render.mjs --stills)` at 1.5, `⎿ 3 stills`
at 6. Next prompt `put it on the beat.` typed about 9.1 to 11.5.
**Out:** Bauhaus snaps your wobbling lines dead straight; the paper stays.

## 03 bauhaus — Geometric Bauhaus — the cue sheet (bars 9-10, 8 beats)
The music is still quiet here, with no drums: your moves ARE the beat. One sound hit for every move (list them in
`sfx`), so the cue sheet is heard being put on the beat.
**In (yours):** the boiling lines snap straight in one frame-accurate move on the downbeat; the three storyboard
frames square up into modules; the flame becomes the red circle. Paper stays cream.
**Shot:** cream paper #F1E9DA; red #E03C31, yellow #F2B705, blue #1E4FA3, black #111; a strict modular grid (240 px);
every move a whole number of modules, every landing on a grid line; **one move a beat or half-beat**, exactly on it:
quarter circles turn 90 degrees about a corner, semicircles slide one module, triangles flip, squares split; pivots
alternate (own centre, a corner, the frame centre). Easing in-out or linear, NO overshoot. The composition assembles
into a kinetic poster that is also the film's cue sheet: 38 bars as a strip of modules with a playhead, the hero bar
marked. Beats 4-6 a phase-shifted cascade across the grid; beats 6-8 freeze into the poster with Swiss typography set
vertically (heavy geometric sans: `CUES`, small caps `38 BARS · 152 BEATS`). Slight print misregistration, paper tooth.
**Rows:** geometric sans on the grid; the cursor is a red square module. Row B: `● Write(film/cues.json)` at 1,
`⎿ 38 bars · 152 beats` at 4. Next prompt `build the shots.` typed about 5.4 to 7.5.
**Out:** Isometric tips your flat modules back and extrudes them.

## 04 iso — Isometric 2.5D — the shots (bars 11-12, 8 beats)
**In (yours):** the poster's plane tips back from flat-on to true isometric (35.264 degrees elevation, 45 azimuth, no
perspective) and its squares rise into buildings; primaries on cream soften to a pastel studio palette (lavender
ground, mint, peach, sky blue, white) with soft shadows and ambient occlusion.
**Shot:** a miniature city of fifteen buildings, one a shot, each growing exactly as its `Write(shots/NN-name.js)` line
appears in row B (fifteen lines from beat 0.5, one every 0.3 beats): base lands, walls scale up with overshoot, the roof
caps 2-3 frames later, windows light in sequence, its number on the roof. Life between them: packets pulsing along
roads, a tiny train, drones, a turbine. Parallel-slide camera (no rotation) with parallax clouds at 1 : 0.8 : 0.6. From
about beat 5.4 (`⎿ 15 shots`) pull back to the whole island floating in a pastel void, title lying on the isometric
plane: `15 SHOTS`.
**Rows:** a clean label plate with soft shadow; the cursor is a small cube. Next prompt `give it some bounce.` typed
about 5.0 to 7.5.
**Out:** Flat Vector drops your shading and flattens the city to a front view.

## 05 flat — Flat Vector — motion (bars 13-14, 8 beats)
**In (yours):** shadows and side faces collapse; the city becomes strictly flat colour seen from the front and
everything re-enters with anticipation, overshoot, settle (cubic-bezier(0.34,1.56,0.64,1)), staggered 2-4 frames, one
hero moving at a time.
**Shot:** ultramarine #2B2BFF, coral #FF5A4E, sunflower #FFC62B, mint #2EE6A8, cream #FFF6E9, ink #151433; no gradients.
The cursor rounds into ONE DOT and drops in with stretch, squash, overshoot, settle. Row B's result
`+ overshoot  + squash  + settle` (beat 3.5): the dot demonstrates each word as it appears. The dot becomes the sun;
the camera pushes into one window to a geometric character at a desk typing at a tiny terminal (limbs on anchor
rotations, head bob, blink): that is you. Squash and stretch about 10%; secondary action and follow-through.
**Rows:** bold rounded sans, ink on a cream band; the cursor is the coral dot. Row B: `● Update(film/js/ease.js)` at 1.
Next prompt `don't cut. morph.` typed about 5.0 to 7.5.
**Out:** Shape Morph takes the dot as its hero shape.

## 06 morph — Shape Morph — transitions (bars 15-16, 8 beats)
Still the quiet part of the music; your second bar swells toward the beat's entry at the next bar line. Build to it:
the drop forms, hangs, and falls exactly as the beat arrives.
**In (yours):** the dot swells into a colour field that wipes the frame (a shape wipe), then shrinks back as the hero.
**Shot:** one shape becomes a new icon exactly on each beat: dot, camera, code braces `{ }`, film frame, play button,
speaker, and last a drop. Every change goes through a simple in-between (circle or capsule) with rotation and 10-15%
squash and stretch; parts change together (the lens becomes a brace's point; the speaker's waves become the drop's
shine). The ground is a flat colour field that changes with each morph by a clean colour-block wipe. Ease
cubic-bezier(0.7,0,0.3,1) with 3-frame cushions; outlines never knot (check the midpoint of every morph in stills).
The camera icon is the joke: it is the one thing this film never used, and it is gone in a beat.
**Rows:** clean geometric lettering on the colour field; the cursor is the small circle the shape grows from.
Row B: `● Write(film/js/morph.js)` at 1. Next prompt `pour in the sound.` typed about 5.0 to 7.5.
**Out:** the drop falls on the bar line into Liquid.

## 07 liquid — Liquid Motion — sound (bars 17-18, 8 beats)
**The music's full beat enters on your first beat**, the biggest rise in the track: "pour in the sound" is literal.
The splash is the film's first big hit; nothing before it was loud.
**In (yours):** the drop lands and splashes on the downbeat; the flat field turns deep plum and everything becomes
thick glossy liquid.
**Shot:** a WebGL shader of 2D metaballs (smooth-min) lit from the field's own gradient (specular highlights, fresnel
rim) in hot orange, pink and violet. It moves to the film's real soundtrack: read `ctx.music.at(env.t)` and let the
bands drive a row of liquid columns, a living spectrum, with necks that stretch, snap and rebound 2-3 frames, and
droplets that follow 2-3 frames late. Liquid is flung, never even: cubic-bezier(0.22,1,0.36,1).
**Rows:** liquid lettering (letters as blobs that settle into shape); the cursor is a drop. Row B:
`● Bash(node tools/sfx.mjs --music)` at 0.75, `● Bash(node tools/mix.mjs)` at 3, `⎿ 96 cues · -14 LUFS` at 4.5.
Next prompt `wait. how does this work?` typed about 3.6 to 7.5 (it is long).
**Out (yours, owner "out", from 1.5 beats before the bar line to 1 after):** a wave of liquid with 3-5 out-of-phase
bulges floods the frame and, as its trailing edge passes, uncovers the next shot (`env.other`).

## 08 sticker — Sticker Explainer — how it works (bars 19-21, 12 beats)
The one place Claude answers in words. Calm after the liquid.
**Shot:** a calm blue-grey canvas (#E9EEF2, slate type), one accent (#FF5A36), even-weight sans, strict alignment.
One continuous camera move with long eases across a canvas several screens wide. Each sentence appears large on the
canvas as the camera reaches its part (they are too long for row B):
beat 1 `A film is a web page that can draw any moment.` a browser-page sticker (white 10 px outline, soft shadow)
labelled `renderAt(t)` with a scrubber moving;
beat 4.5 `Chromium photographs every frame.` a wall of frame tiles lighting up, a counter running to the film's real
frame count (4,413 until the final build), leader lines, exact numbers;
beat 7.5 `ffmpeg joins them to the sound.` the frames and a waveform zip together into one `.mp4` sticker.
Then pull out to a bold title card: a huge number, a small caption (`4,413 frames · every one drawn in code`).
Stickers are this film's own frames, never photographs: `assets/thumbs/<shot>.png` (960x540, one a shot).
**Rows:** a label sticker; the cursor is an accent-orange block. Next prompt `render it.` typed about 10.1 to 11.5.
**In:** Liquid owns it (you are uncovered behind its wave). **Out:** Pixel Art shrinks your frame tiles to pixels.

## 09 pixel — Pixel Art — the render (bars 22-23, 8 beats)
The music is full under both your bars (its small dip is the bar after you, as the tape rolls in before the drop).
Build the tension yourself: the run speeds up, the counter races.
**In (yours):** the picture before you pixelates in steps (nearest-neighbour blocks doubling in size, palette cut to
16-32 colours, dither) until it is 320x180, then it is your world.
**Shot:** 320x180 drawn at x6, nearest neighbour, whole-pixel positions, stepped timing, a PICO-8-like palette, a
dithered sky, 3-4 parallax layers. The hero sprite is Claude Code's own block mascot (it is already pixel art:
`mascot()` in term.js), running on a film-strip ground (6-8 frame cycle at 10-12 a second), collecting frames like
coins while a counter races (`FRAME 0001` to the real frame count) beside row B's `✻ Rendering…`. Day turns to sunset;
the run speeds up through the second bar. An optional CRT pass (scanlines, slight barrel, phosphor glow) that does not
smear the pixels.
**Rows:** a classic dialogue box with a pixel font; the cursor is a blinking pixel block. Row B:
`● Bash(bash tools/build.sh v1)` at 0.5, `✻ Rendering…` from 1.5. Next prompt `play it.` typed slowly, about 5.25 to 7,
then one beat of waiting.
**Out:** Synthwave's tape takes your picture.

## 10 synth — 80s Synthwave / VHS — playback, the hero (bars 24-26, 12 beats). With a fork.
Enter starts the tape: tracking noise, `PLAY ▶` (the prompt's `>` becomes the ▶), a low flight over a neon grid toward a
striped sun. **Beat 4 is the music's drop: the chrome title ALL OF THEM slams in.** Neon script under it. Row B:
`● Bash(mpv all-of-them_v1.mp4)`. Next prompt `find what's wrong.`

## 11 hud — Cyberpunk HUD / FUI — the review (bars 27-28, 8 beats)
**In (yours, with `"freeze": true` in your cue entry):** the tape pauses. `env.other` is the Synthwave shot's last
frame, held still. Give it pause jitter for a few frames, then your linework draws on over it.
**Shot:** deep teal-black over the frozen frame; cyan #00E5FF linework, orange-red #FF6A00 for alert. Hex grid,
concentric rings with ticks, a radar sweep with blips, columns of monospace numbers that roll 3-5 frames and settle,
typewriter status lines, sparklines. Built up in layers, staggered. Then targets: lock brackets snap from 1.4 to 1.0
(fast out, slow in) onto real flaws in the frozen frame, each labelled in plain words (`CAPTION 28 PX · TOO SMALL`,
`DEAD AIR 1.4 S`, `OUTSIDE TITLE-SAFE`: stand-ins until this film's real jury reports). At beat 5 everything flips to
alert orange with the score. Glow, slight colour fringing, scanlines, restrained glitches.
**Rows:** HUD typewriter read-outs (native here); the cursor is the reticle that hunts. Row B:
`● Agent(jury: score against rubric.md)` at 0.75, `⎿ 6.0 / 10 · 9 fixes` at 5. Next prompt `cut what's boring.` typed
about 5.1 to 7.5.
**Out:** Collage turns your brackets into cut lines.

## 12 collage — Collage / Cut-out — the fixes (bars 29-30, 8 beats)
**In (yours):** the lock brackets become dashed cut lines; scissors snip along them on a 12-a-second step and the
picture before you (`env.other`) falls apart into paper pieces with a rough white scissor edge and halftone dots.
**Shot:** kraft and newsprint ground; pieces are halftoned stills of this film's own earlier shots
(`assets/thumbs/<shot>.png`), never photographs; cut-out hands (drawn, engraving style) slap pieces down in a new
order, one for each `Update(shots/…)` line in row B (nine of them from beat 0.75, one every 0.45 beats); torn strips;
bold red and black diagonal constructivist type (`CUT.` `FIX.` `AGAIN.`). Motion on a 12-a-second step, some holds at 6,
positions jittering by 2 px as if placed by hand. Layers: paper, big colour shapes, cut-outs, tape and scribble, grain.
**Rows:** ransom-note letters, each on its own scrap, on the grid; the cursor is a red paper block. Row B result
`⎿ 9 fixes applied` at 5.25. Next prompt `now polish it.` typed about 5.6 to 7.5.
**Out:** 3D Render inflates your flat pieces.

## 13 soft — 3D Render — the polish (bars 31-32, 8 beats)
**In (yours):** the flat paper pieces puff up into thick, soft, glossy forms; kraft becomes a pastel studio sweep.
**Shot:** three.js on the shared renderer (no Blender). A field of glossy rounded pills, an array of cursors, ripples
with a travelling wave; a puffy play button drops in, jiggles on a damped spring and pushes the field aside. Three
materials: gummy with a subsurface glow (candy pink, peach), glossy plastic (cream, lilac), a frosted glass or chrome
accent. Big soft lights, ambient occlusion, soft reflections, shallow depth of field, real motion blur, held to a
24-a-second cadence. Camera on a long-tail ease (80% of the move in the first 20% of the time) to a clean hero frame
held about a second. The storybook film's `rig.js` (in `~/.claude/skills/code-film/examples/storybook/`) shows depth
of field and soft shadows by accumulation.
**Rows:** a glossy plate with embossed letters; the cursor is one of the pills. Row B: `● Bash(bash tools/finish.sh)`
at 1, `⎿ 1080p60 · poster · contact sheet` at 4. Next prompt `slower. let it breathe.` typed about 3.9 to 7.5.
**Out:** Aurora swells your out-of-focus highlights into light.

## 14 aurora — Aurora & Glassmorphism — the final cut (bars 33-34, 8 beats)
The music falls away on your first beat. The film's quietest moment: nothing fast.
**In (yours):** the picture before you blurs wide (80-150 px) and its colours drift into your aurora.
**Shot:** indigo-black base; 4-5 aurora blobs in neighbouring hues (violet, blue, cyan, magenta) drifting on curved
paths, 3-5% noise so nothing bands. Frosted glass cards (blur about 30 px behind, 5-10% white fill, a 1 px inner
highlight, large radius) float in with depth and a slight tilt. The main card holds the finished film: file name,
length, `1080p60`, and the second jury score, with small interface details arriving by opacity and an 8 px rise. One
wow: a liquid-glass lens (real refraction, colour dispersion at its rim, a bright edge) glides across and magnifies
what is under it. Light, elegant sans. Sine and breathing eases.
**Rows:** the prompt sits in a frosted glass field (native here); the cursor is a soft glowing caret. Row B:
`● Agent(jury, round 2)` at 1.5, `⎿ 8.2 / 10` at 5. Next prompt `post it.` typed about 5.75 to 7.5.
**Out:** Variety Captions stands your main card up into a phone.

## 15 variety — Variety Captions — posting (bars 35-36, 8 beats)
The beat returns on your first beat. The comic release.
**In (yours):** the main glass card stands up into a vertical phone in the middle of the wide frame (this style's
home is 9:16), and the calm is over.
**Shot:** the phone plays this film (cut between `assets/thumbs/<shot>.png` with snap punch-ins and a little handheld
shake). Around it, loud variety-show captions pop on the beat, each arriving 2-3 frames after the moment it reacts to:
`WAIT—`, a row of bouncing `???`, `IT'S ALL CODE?!` in a radial burst with speed lines, a small aside `(no camera)`,
sparkles, sweat drops, and a stamp `MADE IN A TERMINAL`. Lettering in three layers (fill, thick white stroke, coloured
outer stroke and shadow), a heavy rounded face, pink, yellow and cyan. Pop from 0 to 1.15 to 1.0 in about eight
frames of 30, letters bouncing two frames apart, a slight tilt, a gentle wiggle while they hold.
**Rows:** the same layered lettering, on the grid; the cursor is a bouncing heart-coloured block. Row B:
`● That part is yours.` at 1. No next prompt.
**Out:** to the real terminal (the ending owns it for now).

## end (bars 37-38) — the real terminal. Built.
`● Your turn.` and an empty prompt, blinking on the beat.
