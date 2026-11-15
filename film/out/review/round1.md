# Jury round 1 (on all-of-them_v1.mp4, Nov 14 2026)

Three independent jurors (fresh agents, Opus, high effort), each scoring the whole film and deep-diving a third.
Their sheets and frames are in `jury1-a/`, `jury1-b/`, `jury1-c/`. None could hear the film; sound was measured.

## Juror A (deep dive: open to flat, 0 to 27.1 s). OVERALL 7.0
style_fidelity 7.0 · concept_wow 7.5 · motion_craft 6.5 · design_typography 7.0 · finish_texture 7.0 · sound_sync 7.0 · technical 8.0
Per-style: line 7.5, boil 8.0, bauhaus 7.0, iso 7.5, flat 6.5.
Spec: 1920x1080, 60 fps, 73.55 s, -14.0 LUFS, -2.1 dBTP, no black frames. Still picture from 70.65 s; silence from
70.89 s (2.66 s). Opening 3.87 s is key clicks only (about -28 LUFS). Cue sync within 10 ms at every bar line.
No contradictions found between on-screen statements (it checked bars, beats, frames, cues, LUFS, 15 shots, 9 fixes).

Changes of style: open to line works (best in its part); line to boil half works (sheet pops on in one frame at
9.683 s, then 0.3 s of grey mud); **boil to bauhaus fails: reads as a hard cut at 15.483 s**, and a second one-frame
swap at 15.946 to 15.980 s; bauhaus to iso works very well; iso to flat works (a little busy; city arrives at once).

Critical:
1. Hard cut at 15.483 s (boil to bauhaus), second snap at 15.98 s.
2. Frame 0 (the thumbnail) is an empty welcome screen; it does not sell the film.
3. End: still from 70.65 s, silent from 70.89 s to 73.55 s.

Fixes, by impact:
A1 [critical] boil to bauhaus, 15.0 to 15.75 s: from one beat before the bar, ramp the boil amplitude 3 px to 0 over 8
   frames so the lines visibly straighten; panels move to the 240 px grid by whole modules (easeInOutQuad, 12 frames);
   the flame squashes to a red disc and lands exactly on the Bauhaus circle on the bar line; paper grain fades while
   cross marks stamp on, one per sixteenth. Replace the 15.98 s snap with fills that wipe on per module each eighth
   note, with a tick per fill.
A2 [high, wow] line, 4.1 to 9.68 s: camera locked, 7.7 to 9.5 s static. Camera follows the tip (scale 1.00 to 1.15,
   tip kept between x 720 and 1200 until 7.74 s), then dolly out 1.15 to 0.95 over 1.2 s to reveal the poster. Let the
   line keep going from END (1750, 487): drop and run left to become the prompt row's top rule and the cursor at
   8.40 s when "sketch it first." starts typing. Cut the orphan stub at x=130, y 625 to 650.
A3 [high] line to boil, 9.60 to 10.0 s: slide the tracing sheet in from y=-1100 over 10 frames (easeOutCubic,
   rotating -1.5 deg to 0), peg holes leading; keep the navy line visible through it at 60% until it lands on 9.68;
   then flick the light-table on in 2 steps on twos (luma 34, 150, 205), not a fade.
A4 [high, wow] frame 0 and the open, 0 to 0.4 s: make frame 0 the hook (the three lines already typed, "all of them."
   with each letter in a different style), then rewind it in 6 frames and start typing at 0.12 s.
A5 [high] flat, 23.75 to 24.6 s and 25.65 to 27.1 s: stagger the 15 skyline buildings left to right at 3 frames each,
   each scaleY 0, 1.08, 0.97, 1.00 over 14 frames with a pop; replace the zoom blur with a shape wipe (the "05"
   building's window rectangle scales to full frame in 10 frames, no navy frame between); give the character a
   reaction in the room (26.0 head turns to the window with anticipation, 26.25 blink, 26.5 lean in 20 px, hands on
   eighths, the monitor shows "don't cut. morph." being typed).
A6 [high] iso, 19.6 to 23.2 s: remove the milky white overlay or cap at 8% (luma sd 28, darkest 54; aim sd 45 to 55,
   darkest 30 to 40; #4A3F8F shade on side faces, 20% contact shadows). The 15 Write rows show 0.12 s each and cannot
   be read: one row held 1.9 s, "Write(shots/NN-name.js) x 15" with NN-name ticking, counter 01 to 15 in the label pill.
A7 [high, wow] bauhaus, 18.39 s title: "CUES" is crammed in a 110 px gap; clear a full 240 px column (x 1440 to 1680),
   cap height about 300 px, "38 BARS · 152 BEATS" in small caps at 28 to 32 px; a phase-shifted cascade across the
   modules on the hit (corner, frame centre, own centre in turn); draw the grid lines on during 15.48 to 15.97 s.
   It reads as a 5x2 sheet of specimen tiles, not an assembled poster.
A8 [polish] boil: smear held 5 frames, cut to 2, stretched 250%; boil_strike only +1.6 dB over the bed at 12.097 s
   (raise 5 dB or duck music 6 dB for 150 ms); boil_burst lands 66 ms early (move to 14.516 s); burst rays cut by the
   top edge at 14.6 s (keep below y=54); 9.68 to 10.0 s is a muddy mid-grey sheet.
A9 [polish] end: fill 70.9 to 73.55 s with a ring-out or room tone and a slow 1 to 2% breathing push; hero flare at
   46.46 to 46.60 s blows out "OF TH" (cap flare at 85% white).
Also: iso_title only +1.8 dB over the bed; line static 7.7 to 9.5 s; bauhaus static 18.5 to 19.0 s; flat near-static
26.0 to 27.1 s; "? for shortcuts" 20 px outside title-safe (decorative); bauhaus timeline has 17 blocks while the film
says 15 shots (consistent, could be miscounted). Generic: flat skyline and desk character, bauhaus tile sheet, iso city.

## Juror B (deep dive: morph to synth, 27.1 to 50.3 s). OVERALL 7.0
style_fidelity 7.0 · concept_wow 7.0 · motion_craft 6.5 · design_typography 7.0 · finish_texture 7.0 · sound_sync 7.0 · technical 7.5
Per-style: morph 6.5, liquid 7.0, sticker 7.5, pixel 7.5, synth 7.5.
Spec as juror A. Loudness: quiet first 30 s (momentary -20 to -28), dense 31 to 69 s (-10 to -13), a breath before the
drop at 45.5 s (-18). **The drop is weak: -9.9 at 46.5 s, only about 2 LU above the pixel shot.** Silent tail from
about 70.5 s. Cue timing within 10 ms except liquid_drain (+35 ms), neon_strike (+31 ms), whoosh_in (+66 ms). Buried:
2nd and 3rd pixel_crush (40.77, 40.89); chrome_slam only 7.9 dB over the bed. Prompt-row letters 42 to 47 px everywhere.

Changes of style: flat to morph yes (best, 8/10); morph to liquid yes in idea (flood edge is a blurred iris; the drop
crosses "geo.js" in row B at 30.92; 7/10); liquid to sticker yes (about 10 frames of flat purple 34.55 to 34.72, heavy
blur; 7/10); **sticker to pixel weak: a sepia wash then a checkerboard dissolve, effectively a dissolve (5.5/10)**;
pixel to synth yes but reads as a stock glitch preset (6.5/10).

Critical: none of the rules clearly broken. Closest: the hero lacks impact (title mis-set at 48.3, drop barely louder).
**Contradiction: aurora (63.0 to 65.8) still shows "all-of-them_v1.mp4" after "9 fixes applied" (57.0): it should be v2.**

Fixes, by impact:
B1 [critical, wow] synth 46.45 to 50.3: re-set the title with equal word spaces (OF to THEM gap should match ALL to OF,
   add about 55 px; it reads "ALL OFTHEM" at 48.3); raise the title about 40 px and drop "in code" 25 px so the script's
   "d" clears the base of THEM; sun a three-stop gradient (#FFE45C top, #FF8A3D at 55%, #FF2E88 bottom) instead of flat
   pale yellow; add a floor reflection of the title (flipped, 25%, fading over 120 px, slight horizontal blur) and two
   palm silhouettes at x about 180 and 1740; sound: cut the bed to silence for 1 beat before 46.45 so the slam arrives
   about 8 LU above its surroundings instead of 2.
B2 [high, wow] pixel entry 40.65 to 41.30: a real pixelation: over 4 frames each, block sizes 2, 4, 8, 16 px nearest
   neighbour, snap to the 16-colour palette with ordered dither, so the giant 4,413 visibly becomes the FRAME counter
   (moving to x 1370, y 100); remove the floating 4,413 by 41.10 (it sits over the FRAME box at 41.25); then hold
   "DONE! 4413/4413" clean for 0.25 s (44.27 to 44.52) before the tape engages (the payoff never gets a clean frame).
B3 [high] morph 27.58 to 30.48: morphs take 4 to 6 frames and read as pops: give each 18 to 20 frames (8 to a circle, 3
   held, 8 out), cubic-bezier(0.7,0,0.3,1), 12% squash, 20 to 30 deg rotation; start each 10 frames before its beat so
   the ring pulse stays on the beat; drop the vertical wipe on braces to film (28.83) and morph the path; lumpy
   in-betweens at 28.333 and 28.367; a lone dot on navy 27.43 to 27.87 with nothing happening.
B4 [high, wow] liquid 31.0 to 34.3: the same symmetric crown holds 3.9 s and reads as a loop: from about 32.0 run the
   crown as the sound (15 tendril heights driven by loudness per beat); at 33.46 let drops fall and merge into the
   glyphs "502 cues · -14 LUFS" 70 px high at y about 560; replace the entry iris (30.98) with a wave front with 4
   bulges; 31.08 to 31.50 the strings of dots in row B look like garbled text; 33.7 to 34.3 the crown sags.
B5 [high] sticker 34.95 to 35.40 and 39.6 to 40.65: left two-thirds empty dashed placeholders at the start: start
   typing "A film is" at 34.95 and slide the browser card in with overshoot; in the pull-back the badge overlaps the
   browser card (move badge to y 60 or shift the card 40 px right, 20 px down; keep 12 px to the headline); raise the
   "all-of-them_v1.mp4" label to #6B7480 at 26 px or more; labels under 28 px at 40.3.
B6 [high] synth rows 44.6 to 50.3: rows sit on the brightest part of the grid with no backing: a soft dark band
   (#12051F 70%, y 800 to 990, feathered 60 px) or fade the grid to 30% under the text; RGB split on text at most 1 px.
B7 [polish] cut the 44.52 tape roll from 0.45 s to 0.30 s and keep the pixel scene readable inside it; remove the
   whole-frame brightness flash at 40.65.
B8 [polish] aurora file name must be v2.
B9 [polish] end: fill the 2.5 s of silence with a ring-out to -30 LUFS; one live element on the end frame (a ghost
   suggestion typing slowly); frame 0 has no hook (start with "make me a video." already typed).
B10 [polish] sticker 40.32 to 40.40: the cursor block covers the newly typed glyph for about 2 frames per keystroke.
Also: first sticker sentence fully on screen about 1.15 s (needs 1.67); 60.3 the lilac "1080p60 · poster · contact
sheet" row is low-contrast on pink; generic: VHS glitch, Material-style icons, lone-dot hold, looping crown, HUD and
aurora dashboard look.

## Juror C (deep dive: hud to end, 50.3 to 73.55 s). OVERALL 7.2
style_fidelity 7.5 · concept_wow 7.0 · motion_craft 7.0 · design_typography 7.0 · finish_texture 7.0 · sound_sync 7.0 · technical 7.5
Per-style: hud 8, collage 8, soft 6.5, aurora 8, variety 8.5; end 6.
Spec as the others. Sync in its part within 15 ms. aurora_score (64.36) rises only +0.6 dB over the bed (buried).
HUD counters accurate. All numbers consistent (6.0 and 9 fixes match 9 FLAG lines, 9 Update calls, the mascot's count,
"9 fixes applied"; 4,413; 502; -14; 1080p60; 1:13).

Changes of style: synth to hud carried, conceptually right but rushed (the scan beam crosses in 10 frames and reads as
a line wipe); hud to collage the best in its part; collage to soft carried (soft edge reads a little like a blurred
iris); **soft to aurora weakest: a blur dissolve, 0.35 s with nothing sharp; prompt doubled in two fonts 62.12 to
62.18**; aurora to variety carried and energetic, marred by an orphan bar; variety to end works.

Critical:
1. End 70.65 to 73.55: only the cursor changes for 2.9 s; digital silence 70.89 to 73.55. The loop seam jumps (the last
   frame has "Your turn.", frame 0 does not).
2. Frame 0: empty terminal, weak thumbnail; first 3.9 s about 11 LU below the programme.

Fixes, by impact:
C1 [critical, wow] end 70.40 to 73.55: let end_land ring out with a pad or room tone at about -22 LUFS to the end,
   fading over the last 0.4 s; at 71.0 ghost-type a dim suggestion (#6B6B6B) "make me a video." in the prompt, 0.125
   beats a character, so the loop is seamless and the film says "it starts again, with you". Or cut the hold to 1.2 s.
C2 [high, wow] hud 50.70 to 54.19: no central hologram; the frozen frame graded teal is a muddy smear (52.30). Turn it
   into a hologram: luminance to 30%, an edge pass so the title and mountains become 1.5 px #00E5FF lines at 70%, 2 px
   scanlines every 4 px, slow perspective rotation (rotateY -8 to +8 deg over the shot), 1-frame RGB split on each lock.
C3 [high] soft 58.06 to 61.94 (weakest style in its part): effector waves (radial wave at 59.03, 40 px lift, 900 px/s,
   0.6 s decay; a second at 60.48 at half amplitude); camera 6% push-in 58.5 to 61.9 with long-tail ease; subsurface
   look (rim +18% within 6 px of each silhouette, warm transmitted tint, 12 px blurred contact shadow at 35%); **put
   the ">" glyph back in the prompt row (missing 58.3 to 61.9)**; reset the status row (purple condensed bevel looks
   cheap, low contrast on pills at 60.30): the film's mono or a rounded sans 600, #4A2B5E on a cream plate at 85%.
C4 [high] hud 50.45 to 50.75: slow the beam to 27 frames (easeInOutCubic), 4 px white core plus 120 px cyan falloff;
   draw the HUD chrome on in its wake, staggered 40 ms; fade "10/15 SYNTHWAVE" out over 4 frames before the label box
   arrives (reads "SYNTHHWAVE" at 50.50); glitch "PAUSE" off over 3 frames instead of popping at 50.616.
C5 [high, wow] collage 56.61 to 58.06: no surreal hero beat, ends on a static board: on the slam at 56.61 flip the
   mascot's head open like a lid (hinge top-left, -70 deg over 6 frames, stepped at 12 fps) and spill the checked
   polaroids out in an arc, one per 0.08 s, before AGAIN. slaps down; lock everything to 12 fps steps with seeded
   2 px jitter; add a visible grain layer.
C6 [high] soft to aurora 61.94 to 62.60: make it a "deflate": the play button exhales (scale 1 to 0.85, 10 frames),
   pills sink 60 px into the floor staggered 20 ms from the centre outward, the camera racks focus so the peach and
   pink highlights bloom into the aurora blobs; first glass card in by 62.35; featureless span 8 frames at most.
C7 [polish, visible bug] variety 65.85 to 66.30: an orphan pink prompt bar with no text at x 850 to 1790, y 890 to
   1005: collapse the aurora prompt bar into the new prompt (scale X to 0.25 anchored left, 8 frames, easeInBack).
C8 [polish] variety 66.30 to 67.50 and 68.97 to 69.68: the phone feed hard-cuts dark and light screens 4.1 times a
   second (flirts with the flash rule): swap once a beat as a 0.15 s vertical scroll; keep the phone clear of the say
   row 69.6 to 70.0 (it eats letters: "That part us yours", 69.72 to 69.95).
C9 [polish] hud 51.78 to 52.85: rolling readouts show impossible values (big score reads 8.2 / 10 at 52.80 while the
   result row types 6.0; BAR 72/38, BEAT 946/152): limit roll digits to valid ranges, settle within 4 frames, start
   the result row after the big readout has settled.
C10 [high] open frame 0: make it the typed prompt "> make me a video." with a faint 15-swatch strip of the styles.
Also: hud checklist and bottom counters about 22 px (unreadable); aurora card labels 24 to 27 px; a hard vertical edge
inside the aurora lens where the thumbnail ends (63.70, x about 1045); aurora 62.25 to 62.60 blob-only frames; generic:
the HUD display face, the soft shot's purple bevel font, the aurora dashboard layout.

## Round 1 result
Scores 7.0, 7.0, 7.2: **average 7.1 / 10**.
Distinct fixes after merging the three lists (frame 0: A4+B9+C10; end tail: A9+B9+C1; flare: A9 into B1):
A1 A2 A3 A4 A5 A6 A7 A8 A9 · B1 B2 B3 B4 B5 B6 B7 B8 B10 · C2 C3 C4 C5 C6 C7 C8 C9 = **26 fixes**.
Files they touch: all fifteen numbered shots plus open.js and end.js (17 files), and the mix.
