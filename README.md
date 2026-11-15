# All of Them

A 77-second film about making films in code, made entirely in code, in one Claude Code terminal session.
Someone types `make me a video.` Claude asks `In what style?` The answer is `all of them.`
Each step of making a film then arrives in a different motion-design style: fifteen of them.

By Rich Williams · [@engineerforai](https://x.com/engineerforai) · [builderwars.ai](https://builderwars.ai)

The fifteen styles are the set defined by [mg-styles-15](https://vincentwei1021.github.io/mg-styles-15/)
(by Vincentwei1021, MIT). This film borrows its style definitions and its render pattern, and nothing else.

## What is in here

| Path | What it is |
|---|---|
| `film/js/shots/01-line.js` to `15-variety.js`, `open.js`, `end.js` | One file a shot. Each paints any moment of its shot onto a canvas. |
| `film/js/main.js`, `clock.js`, `term.js`, `gl.js` | The director, the beat clock, the terminal's two rows, the shared WebGL renderer. |
| `film/cues.json` | The cue sheet: 40 bars at 124 BPM, every prompt, every line the terminal prints, in beats. |
| `harness/render.mjs` | Headless Chromium asks the page for every frame and pipes them to ffmpeg. |
| `tools/` | Stills and contact sheets, the sound mixer, the final encode, and `truth.mjs`. |
| `audio/` | The music, the sound effects, and the prompts and plans they were generated from. |
| `SHOTS.md`, `BRIEFS.md`, `treatment.md` | How a shot is built, what each shot shows, the one-page treatment. |
| `film/out/review/` | The two jury rounds, word for word in summary, and what was really fixed after each. |
| `CREDITS.md` | Everything the film was made with, and every licence. |
| `skill/code-film/` | The Claude Code skill the film was made with. |

## Everything on screen is true

The terminal in the film prints file names, commands and numbers. `node tools/truth.mjs` checks each one against
the project: the files exist under those names, the commands name real tools, and the numbers (40 bars, 160 beats,
4,646 frames, 550 sound cues, -14 LUFS, the jury's 7.1 and 7.3, 26 fixes) match the build and the reviews.

In a fresh clone, after a build, 57 of its 59 checks pass. The other two look for the first and second cuts
(`all-of-them_v1.mp4` and `all-of-them_v2.mp4`), which the film shows being reviewed and which, like all rendered
video, are not in the repository. One check also needs `mpv` installed, because the film plays itself with it.

## How it was made

- One lead session wrote the engine, the cue sheet and the look; one builder a shot wrote the fifteen shots.
- The first cut went to an independent jury of three reviewers who had not seen the project. They scored it
  7.1 / 10 and asked for 26 fixes. All 26 were applied. A second jury of three, who had not seen the first round,
  scored the second cut 7.3 / 10. A last pass fixed what still broke the film's own rules.
- Models, from the session's logs: Claude Fable 5.2 at `xhigh` effort for the lead and the shot builders; Claude
  Opus 5.5 at `high` effort for the jurors and for the last fix pass.
- The picture is all code. The music and the sound effects were generated with ElevenLabs.

## Render it yourself

You need Node 22 or later, a Chromium or Chrome binary, and ffmpeg.

```sh
pnpm install                     # or npm install: three and puppeteer-core
node tools/sheet.mjs iso         # twelve stills of one shot -> film/out/sheets/iso/
bash tools/build.sh              # every frame, then the encode -> film/out/all-of-them.mp4
```

The build needs about 12 GB free while it runs: about 6 GB of temporary segments in the system's temp folder (set
`TMPDIR` to a folder on disk if `/tmp` is held in memory) and a lossless master of about 6 GB, `film/out/master.mkv`,
which you can delete afterwards.

The music (`audio/music/cut/A.wav`) and every sound effect (`audio/sfx/`) are in the repository, so the build has
its sound. They were generated with ElevenLabs; the prompts are in `audio/sfx.json` and the music plans in
`audio/plans/`. To generate your own, put an ElevenLabs key in `.env` (`ELEVENLABS_API_KEY=...`) and run
`node tools/sfx.mjs`. The rendered video is not in the repository.

## Make your own with the skill

`skill/code-film/` is the Claude Code skill this film was made with: the method (`SKILL.md`), a starter kit, and two
earlier films as worked examples.

```sh
cp -R skill/code-film ~/.claude/skills/              # then ask Claude Code to make a film
bash skill/code-film/new-film.sh ~/Work/my-film      # or start by hand: copies the kit, installs, renders two stills
```

The picture needs no account. Voice, sound effects and music use your own ElevenLabs key. Each example's README
gives the commands to run it. The storybook example fetches its two typefaces with a script, because their licence
(the AGPL with a font exception) keeps them out of this repository.

## Licence

The code is under the MIT licence (`LICENSE`). Fonts keep their own licences, which sit beside them in `assets/`
and in `skill/code-film/kit/assets/fonts/` (SIL Open Font License 1.1, and Apache 2.0 for Special Elite). The style definitions under
`reference/mg-styles-15/` are copied from mg-styles-15 under its MIT licence.

The terminal and the block mascot drawn in this film are a recreation of Claude Code, to show the tool the film
was made with. This project is not affiliated with or endorsed by Anthropic.
