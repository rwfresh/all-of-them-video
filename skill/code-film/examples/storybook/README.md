# Example: "Builder Wars: A Very Simple Story" (pop-up storybook, Nov 2026)

A 42-second explainer for the Builder Wars game, told as a children's first reader in a paper pop-up book. Every frame is
code; two crops of the real homepage appear inside a paper laptop. Two jury rounds (about 6/10, then about 7/10 with
"publish after the must-fix list"); the third cut applies that list.

To run it, from the skill's folder:

```sh
SKILL=$(pwd)
bash new-film.sh ~/Work/storybook                             # a fresh scaffold
cd ~/Work/storybook
cp -R "$SKILL/examples/storybook/film/." film/
cp "$SKILL"/examples/storybook/audio/*.json audio/
mkdir -p assets/screens && cp "$SKILL"/examples/storybook/assets/screens/* assets/screens/
bash "$SKILL/examples/storybook/get-fonts.sh"                 # the book's two typefaces
node harness/render.mjs film --stills 6,18,30                 # stills in film/out/stills
```

**Fonts.** The book is set in C059 (a Century Schoolbook clone) and URW Bookman Demi. This copy of the kit does not
carry them, because their licence is the AGPL with a font exception and not an open font licence. `get-fonts.sh` copies
them from Ghostscript's fonts if your system has them, or downloads them from URW's own repository, and checks each
file against the checksum of the one the film was made with. Without them the page stops with a 404 for the font.

**Sound.** The picture renders without a key. The sound needs an ElevenLabs key in `.env`. The narrator in
`film/cues.json` (`voice.id`) is a voice designed for this film (a costumed dinosaur mascot, lively pace) and saved in
the author's ElevenLabs account, so that id will not exist in yours. Record with your own voice id:
`node tools/vo.mjs --voice <your id>` (`node tools/eleven.mjs voices` lists yours; `eleven.mjs design` makes new ones).
The cue sheet then retimes the film to your take. Effects and music: `node tools/sfx.mjs --music`.

## The paper engine (`film/js/`)

| File | What it gives you |
|---|---|
| `paper.js` | Cut paper: `piece(shape, color)` with a hand-cut outline and a lighter paper core, shape helpers (`rr`, `poly`, `circ`, `star`, `heart`), `stack()` for layered groups, `printed()` cards from a 2D canvas, fibre grain and mottle |
| `type.js` | Cut-paper lettering: `cutText`, and `cutSign` (a word fitted into a box); fonts as shapes |
| `rig.js` | Camera and lights for accumulation rendering: each of the K passes moves the lens (depth of field), the key light (soft shadows), a dome light (ambient shading) and a sub-pixel offset (antialiasing) |
| `book.js` | The book: stiff leaves on a spine, `vfold()` pop-ups whose wings follow the pages, `rise` (pop-ups stay low until a spread is nearly open), clip planes at each crease |
| `world.js` | One world posed for any time: page turns from the cue sheet, camera keys per spread, the book shutting at the end |
| `spreads/*.js` | One module per spread: `build(env)` returns `{ key, animate(lt, open), sfx, overlay, look, close }` |
| `art.js` | The cast and props (person, coin robot, terminal buddy, laptop, crown, coin) |
| `film.js` | Sentence-per-caption timing and the paper-strip caption |
| `shots/book.js` | Every paper shot is the same world at a different time; `shutter: 0` and 32 passes |

## How the work was split

The look was built first in one session (cover, one spread, the hero spread). Then the remaining spreads went to forks of
that session, one or two spreads each, each owning only its own `spreads/<name>.js`. The shared characters were written
before forking. `spreads/index.js` loads every spread module on its own, so a spread that is broken mid-edit blanks only
itself. Jury fixes were fanned out the same way.
