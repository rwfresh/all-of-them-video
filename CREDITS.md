# Credits and licences

## Made with

The last frame of the film prints this list (`Read(CREDITS.md)`).

- **Claude Code** (v2.1.319) with the **code-film** skill.
- Models, as recorded in the session's logs: **Claude Fable 5.2** at `xhigh` effort for the lead session and the
  fifteen shot builders; **Claude Opus 5.5** at `high` effort for the independent jury (three jurors a round) and
  for the six agents of the last fix pass.
- **Node** 26, headless **Chromium** 155 driven by `puppeteer-core`, **three.js**, the browser's Canvas 2D and WebGL.
- **ffmpeg** (encode, loudness, analysis) and **ImageMagick** (contact sheets).
- **ElevenLabs** for the music and every sound effect.
- **mg-styles-15** by Vincentwei1021 for the fifteen style definitions (MIT; link: vincentwei1021.github.io/mg-styles-15).
- **Google Fonts** families under the SIL Open Font License and Apache 2.0 (listed below).

Made by Rich Williams: @engineerforai · builderwars.ai

## Assets and licences

Record every asset here as you add it: what it is, where it came from, its licence.

| What | Source | Licence |
|---|---|---|
| Anton, Archivo Black, VT323 (the opening's and ending's borrowed lettering, `assets/fonts/`, licence texts beside them) | github.com/google/fonts | SIL Open Font License 1.1 |
| Liberation Serif (borrowed lettering, `assets/fonts/`) | system package `ttf-liberation` | SIL Open Font License 1.1 |
| three.js | npm `three` | MIT |
| puppeteer-core | npm `puppeteer-core` | Apache-2.0 |
| Render pattern (a page with `renderAt(t)`, captured frame by frame) | github.com/Vincentwei1021/mg-styles-15 | MIT (pattern only) |
| JetBrains Mono (the terminal's face; Regular and Bold copied from the system's Nerd Font build, Thin to Light in `assets/line/`) | github.com/JetBrains/JetBrainsMono, system package | SIL Open Font License 1.1 |
| Racing Sans One, Mr Dafoe (the Synthwave title and neon script, `assets/synth/`) | github.com/google/fonts | SIL Open Font License 1.1 |
| Space Mono, Jost (Bauhaus, `assets/bauhaus/`) | github.com/google/fonts | SIL Open Font License 1.1 |
| DM Mono, Outfit (Isometric, `assets/iso/`) | github.com/google/fonts | SIL Open Font License 1.1 |
| Sono (Flat Vector, `assets/flat/`) | github.com/google/fonts | SIL Open Font License 1.1 |
| Red Hat Mono (Shape Morph, `assets/morph/`) | github.com/google/fonts | SIL Open Font License 1.1 |
| Fredoka (Liquid, `assets/liquid/`) | github.com/google/fonts | SIL Open Font License 1.1 |
| Inter (Sticker Explainer, `assets/sticker/`) | github.com/google/fonts | SIL Open Font License 1.1 |
| Share Tech Mono, Michroma (HUD, `assets/hud/`) | github.com/google/fonts | SIL Open Font License 1.1 |
| Abril Fatface, Alfa Slab One (Collage, `assets/collage/`) | github.com/google/fonts | SIL Open Font License 1.1 |
| Special Elite (Collage, `assets/collage/`) | github.com/google/fonts | Apache License 2.0 |
| Outfit, Geist Mono (Aurora, `assets/aurora/`) | github.com/google/fonts | SIL Open Font License 1.1 |
| Mochiy Pop One, Yusei Magic, M PLUS Rounded 1c (Variety Captions, `assets/variety/`; the M PLUS folder upstream has no licence file, so `OFL-MPLUSRounded1c.txt` was written from its METADATA copyright line and the standard OFL text) | github.com/google/fonts | SIL Open Font License 1.1 |
| Frame-by-Frame and Pixel Art lettering | drawn in code for this film | this project |
| Pixel Art palette | the PICO-8 palette's colour values, plus the mascot's orange | colour values only |
| The block mascot and the terminal's look | a recreation of the Claude Code terminal (Anthropic), drawn in code, to show the tool the film was made with | Anthropic's product; not affiliated or endorsed |
| Music and sound effects (`audio/music/`, `audio/sfx/`) | generated with ElevenLabs on Rich Williams's subscription; music re-cut on bar lines with `tools/music-edit.mjs`; some effects tuned or trimmed with `tools/sfx-post.mjs` | ElevenLabs terms for that plan; Rich confirmed on Nov 14 2026 that they allow shipping the audio |
| The fifteen styles and their signature features | github.com/Vincentwei1021/mg-styles-15 (prompts and style notes) | MIT; a link back is asked for |
