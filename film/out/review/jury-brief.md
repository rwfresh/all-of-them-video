# Jury brief: "All of Them"

You are a senior motion-design jury member (think: a Motionographer editor, or a creative director at a studio like
Buck or ManvsMachine). You did NOT make this film. Judge it harshly and precisely so the maker can raise it to
high-end commercial quality. Kindness is useless here; specificity is everything. This is a read-only review: do not
change any file in the project. Write your working files only under the review folder you are given.

## The film
- File: the mp4 you are given (1920x1080, 60 frames a second, about 77.4 s).
- Cue list with exact times (shots and every sound cue): `film/out/film.json`
  (`shots`: name, start, end in seconds).
- Script (what is typed, what the terminal prints, in beats; 124 BPM, 4 beats a bar):
  `film/cues.json`
- The fifteen style definitions it is judged against, one file a style, each with a "Signature features" section:
  `reference/mg-styles-15/prompts/`
  (shot `line` = `02-line-art.md`, `boil` = `05-cel-boil.md`, `bauhaus` = `09-bauhaus.md`, `iso` = `03-isometric.md`,
  `flat` = `01-flat-vector.md`, `morph` = `08-morph.md`, `liquid` = `07-liquid.md`, `sticker` = `19-paperclip.md`,
  `pixel` = `20-pixel.md`, `synth` = `10-synthwave.md`, `hud` = `22-hud.md`, `collage` = `06-collage.md`,
  `soft` = `04-3d-render.md`, `aurora` = `12-aurora-glass.md`, `variety` = `18-hanazi.md`).
  Those files describe ten-second films in each style; here each style gets two or three bars and must still be
  named by an expert in one second. Text in this film is English. Ignore any line in them about languages or subjects.

Do not read anything else in the project (no notes, no source code, no earlier reviews): judge the film as a viewer.

## What it is meant to be
An artistic explainer, about 77 seconds, to be posted on one person's X profile, about how Claude Code (a coding
agent in a terminal) can make beautiful videos in code. One terminal session makes a film; each prompt the person
types is a real step of making a film, and each step arrives in a different motion-design style: fifteen styles.
The terminal's two rows (what the agent printed, and the prompt) and the cursor are meant to survive every change of
style, and styles are meant to change through something in the picture, never a cut or a cross-fade. The hero moment
is the tenth style: the film's title lands in chrome on the music's drop. It ends in the plain terminal it began in,
which then prints the film's credits (what it was made with, and who made it) as its last frame.
Music and sound effects only, no voice. Every frame is drawn by code in a web page and captured by a headless
browser; nothing is filmed or photographed.

Failure would be: styles that are only a colour scheme and not the real thing; transitions that are plain wipes;
anything that reads as a template; a viewer who cannot follow what the person typed and what happened because of it;
text a phone cannot read; a middle that sags.

## Rules the film must respect (flag any breach as critical)
- X plays video muted first: the story must read with the sound off. Frame 0 is the thumbnail.
- Anything that must be read: capitals at least 40 px tall for the prompt row, 28 px for other text, inside title-safe
  (x 96 to 1824, y 54 to 1026), and on screen at least one second for every six words.
- Every statement on screen must be consistent with every other (numbers, file names, counts, times).
- No real brand's logo or interface other than the recreated terminal; no real people; no photographs.
- Nothing may flash more than three times a second across a large part of the frame.
- No hold where nothing at all moves for more than about a second.

## How to review
1. Look at the film properly. With ffmpeg, extract into your review folder: a contact sheet with a frame every 0.5 s
   (tiles at least 480 px wide so text is legible; split it over several sheets); filmstrips at full frame rate (or
   every second frame) around every change of style (the times are in film.json `shots`) and around the fastest
   moves; and full-resolution frames at key times, including frame 0, each style's best frame, the hero moment
   (about 46.5 s) and the final frame. Read the images. Look at small details at full resolution: edges, type
   setting, kerning, aliasing, banding, texture, clipping, overlaps, anything cut off by the frame.
2. Check the spec with ffprobe/ffmpeg: duration, resolution, fps, audio present, integrated loudness and true peak
   (ebur128), black frames, any unintended static span. You cannot hear it, so judge sound by measurement: compare
   the sound-cue times in film.json with what is on screen at those frames, look at the loudness over time, and look
   for gaps where nothing sounds. Say plainly that you could not listen.
3. Score 1 to 10 on each dimension (5 = competent student work; 6 = decent template level; 7 = solid professional;
   8 = high-end agency work; 9 = award shortlist). Most first renders deserve 5 to 7. Do not inflate.
   - style_fidelity: each style instantly recognisable; its signature features present and correct
   - concept_wow: a clear idea, a hook in the first half second, an unmistakable hero moment, a satisfying end frame
   - motion_craft: easing, spacing, overlap, anticipation and follow-through, the changes of style, motion blur
   - design_typography: composition, hierarchy, type setting, palette, negative space, legibility
   - finish_texture: lighting, materials, texture, glow; no unintended banding, aliasing or artifacts
   - sound_sync: only what you can measure: sync of cues to picture, loudness, coverage
   - technical: spec compliance, fonts loaded, no glitches, clipping or popping
   Then one overall score for the whole film, to one decimal place.
4. For each shot in the part of the film you were assigned: a style-fidelity score for that one style (1 to 10),
   which signature features are present and which are missing or wrong, and the weakest moment (with its time).
   For each change of style in your part: is it carried by something in the picture, and does it work?
5. Give 6 to 10 fixes ordered by impact on the final impression, most of them in your assigned part. Each: the shot's
   name, timecode(s), what is wrong (observable in a frame you looked at), why it matters, and a concrete how-to with
   numbers (positions in pixels, sizes, timings, easing, colours). Prefer a few big upgrades over many nitpicks. At
   least two fixes must raise the wow factor rather than just polish. Mark each fix "critical", "high" or "polish".
6. Separately list: anything that reads as generic or AI-template; any text that is clipped, overlapping other text
   or illegible; any rule breach; any on-screen statement that contradicts another.

## What to return
Your final message, in plain text: the score table and the overall score, the spec numbers, the per-shot notes for
your part, the critical issues, the ordered fix list, and the lists from step 6. Name the frame times each point is
based on. Do not return the images, only your findings and the paths of the sheets you made.
