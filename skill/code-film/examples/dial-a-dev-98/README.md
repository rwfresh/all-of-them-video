# Dial-A-Dev 98 (worked example)

The full picture source of the first film made with this kit: a 44-second 1998 TV infomercial taped on VHS, for the
Builder Wars weekly theme "Shipped in 1998" (Nov 2026). Drop `film/` over a fresh kit's `film/` to render it (it has
no sound until you record the voice and generate the effects from `audio/sfx.json` and `audio/music.json`).

```sh
SKILL=$(pwd)                                                  # run these from the skill's folder
bash new-film.sh ~/Work/dial-a-dev                            # a fresh scaffold
cd ~/Work/dial-a-dev
cp -R "$SKILL/examples/dial-a-dev-98/film/." film/
cp "$SKILL"/examples/dial-a-dev-98/audio/*.json audio/
node harness/render.mjs film --stills 4,14,34                 # stills in film/out/stills
```

**Sound.** The picture renders without a key. The sound needs an ElevenLabs key in `.env`. The pitchman in
`film/cues.json` (`voice.id`) is a voice designed for this film and saved in the author's ElevenLabs account, so that
id will not exist in yours. Record with your own voice id: `node tools/vo.mjs --voice <your id>`
(`node tools/eleven.mjs voices` lists yours; `eleven.mjs design` makes new ones). One line, Mom's "Hello?", names the
stock voice Matilda and keeps it. The cue sheet then retimes the film to your take. Effects and music:
`node tools/sfx.mjs --music`.

Borrow from it:

| File | What it has |
|---|---|
| `film/js/stage.js` | extruded lettering with a keyline, the sky-over-desert chrome and gold materials, the ray backdrop, star glints |
| `film/js/product.js` | compact disc with a real diffraction-grating shader, disc label art, the retail box and its shrink-wrap glare |
| `film/js/ui98.js` | a 1998 desktop toolkit on a 960x540 canvas: bevels, windows, buttons, pixel icons, crisp bitmap text |
| `film/js/crt.js` | the desktop shown on a picture tube that a virtual camera films (sharp pixels, scanlines up close) |
| `film/js/post.js` | motion-blur accumulation, bloom, lens streak, and the VHS pass |
| `film/js/supers.js` | broadcast supers, starbursts, seals, banners, text on an arc, closed captions, the phone-number lower third |
| `film/js/shots/*.js` | eleven shots; `desktop.js` shows several shots sharing one screen stage |
| `film/cues.json` | the script with recorded word timings, and shots tied to lines and words |

What the jury caught on the first full version, all fixed in this source: the product name was not on screen in the
first 2 seconds (now a lower third from frame 0); faux-bold pixel type closed up W and M; supers and captions covered
the best jokes; text ran outside title-safe; the same white flash on every hit; and the premise never paid off (now
Mom picks up the phone at the end).
