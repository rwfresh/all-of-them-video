#!/usr/bin/env node
// Checks what the film's terminal prints against the real project: every file it says it wrote exists under that
// name, every command names a real tool, and every number matches the build. Run after a build, before showing anyone.
//   node tools/truth.mjs [v1]        (the version whose mp4 the "play it." line names; default: from the cue sheet)
// The jury's real numbers are read from film/out/review/jury.json: { "round1": { "score": 6.4, "fixes": 9 }, "round2": { "score": 8.1 } }
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildClock } from '../film/js/clock.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => path.join(ROOT, ...a);
const cues = JSON.parse(fs.readFileSync(P('film/cues.json'), 'utf8'));
const clock = buildClock(cues);
const film = fs.existsSync(P('film/out/film.json')) ? JSON.parse(fs.readFileSync(P('film/out/film.json'), 'utf8')) : null;
const jury = fs.existsSync(P('film/out/review/jury.json')) ? JSON.parse(fs.readFileSync(P('film/out/review/jury.json'), 'utf8')) : {};
let bad = 0;
const ok = (cond, what) => { console.log(`${cond ? '  ok  ' : ' WRONG'} ${what}`); if (!cond) bad++; };
const exists = (rel) => [rel, 'film/js/' + rel, 'film/' + rel].some((r) => fs.existsSync(P(r)));
const out = (name) => cues.shots.find((s) => s.name === name).out || [];
const lines = cues.shots.flatMap((s) => (s.out || []).map((o) => ({ shot: s.name, ...o })));

// files and tools named in tool lines
for (const l of lines.filter((o) => o.kind === 'tool')) {
  const m = l.text.match(/^(\w+)\((.*)\)$/);
  if (!m) { ok(false, `${l.shot}: cannot read "${l.text}"`); continue; }
  const [, tool, arg] = m;
  if (tool === 'Write' || tool === 'Update' || tool === 'Read') ok(exists(arg), `${l.shot}: ${l.text}: the file exists`);
  else if (tool === 'Bash') {
    const w = arg.split(/\s+/);
    if (w[0] === 'node' || w[0] === 'bash') ok(fs.existsSync(P(w[1])), `${l.shot}: ${l.text}: ${w[1]} exists`);
    else if (w[0] === 'mpv') {
      ok(spawnSync('which', ['mpv']).status === 0, `${l.shot}: mpv is installed`);
      ok(fs.existsSync(P('film/out', w[1])), `${l.shot}: ${l.text}: film/out/${w[1]} exists`);
    } else ok(false, `${l.shot}: unknown command "${arg}"`);
  } else if (tool === 'Agent') {
    const f = arg.match(/[\w./-]+\.md/);
    if (f) ok(exists(f[0]), `${l.shot}: ${l.text}: ${f[0]} exists`);
  }
}

// numbers
const text = (name, kind = 'result') => (out(name).find((o) => o.kind === kind) || {}).text || '';
ok(text('bauhaus') === `${clock.shots.reduce((a, s) => a + s.bars, 0)} bars · ${clock.totalBeats} beats`, `bauhaus: "${text('bauhaus')}" is the cue sheet's length`);
const writes = out('iso').filter((o) => o.kind === 'tool').length;
ok(text('iso') === `${writes} shots` && writes === cues.shots.filter((s) => s.num).length, `iso: "${text('iso')}" and ${writes} Write lines, one for each numbered shot`);
if (film) {
  const mixWav = P('audio/mix.wav');
  let lufs = null;
  if (fs.existsSync(mixWav)) {
    const r = spawnSync('ffmpeg', ['-hide_banner', '-i', mixWav, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
    lufs = +(r.stderr.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop()?.match(/-?[\d.]+/)[0];
  }
  ok(text('liquid') === `${film.sfx.length} cues · ${Math.round(lufs)} LUFS`, `liquid: "${text('liquid')}" against ${film.sfx.length} sound cues and ${lufs} LUFS measured`);
  ok(Math.round(film.duration * film.fps) === Math.round(clock.duration * clock.fps), `frame count ${Math.round(film.duration * film.fps)} (the sticker and pixel shots compute it)`);
  ok(text('pixel') === `${Math.round(film.duration * film.fps).toLocaleString('en-US')} frames`, `pixel: "${text('pixel')}" is the frame count`);
}
const ups = out('collage').filter((o) => o.kind === 'tool').length;
const hud = text('hud').match(/^([\d.]+) \/ 10 · (\d+) fixes$/), col = text('collage').match(/^(\d+) fixes applied$/), aur = text('aurora').match(/^([\d.]+) \/ 10$/);
ok(hud && col && hud[2] === col[1], `hud "${text('hud')}" and collage "${text('collage')}" agree on the number of fixes`);
if (jury.round1) ok(hud && +hud[1] === jury.round1.score && +hud[2] === jury.round1.fixes, `hud: score and fixes are the real first round (${jury.round1.score}, ${jury.round1.fixes} fixes)`);
else ok(false, 'hud: no real first jury round recorded yet (film/out/review/jury.json)');
if (jury.round1 && jury.round1.files) ok(out('collage').filter((o) => o.kind === 'tool').every((o) => jury.round1.files.some((f) => o.text.includes(f))), `collage: each of its ${ups} Update lines names a file really changed in the fix round (${jury.round1.files.length} were)`);
ok(ups === writes, `collage: ${ups} Update lines for the ${writes} shot files iso wrote`);
if (jury.round2) ok(aur && +aur[1] === jury.round2.score, `aurora: score is the real second round (${jury.round2.score})`);
else ok(false, 'aurora: no real second jury round recorded yet');

// the credits the ending prints: every name in them is in the file it says it read
const cred = (cues.shots.find((x) => x.name === 'end') || {}).credits;
if (cred) {
  const file = fs.readFileSync(P('CREDITS.md'), 'utf8').toLowerCase();
  const names = [...cred.rows, cred.sign].flatMap((r) => r.split('·')).map((x) => x.replace(/^\s*jury:\s*/, '').replace(/\(.*?\)/g, '').replace(/ skill$/, '').trim().toLowerCase()).filter(Boolean);
  const missing = names.filter((n) => !file.includes(n));
  ok(missing.length === 0, `end: every name in the credits is in CREDITS.md${missing.length ? ' (missing: ' + missing.join(', ') + ')' : ''}`);
  ok(/fable 5\.2[^\n]*xhigh/i.test(file.replace(/[*`]/g, '')) && /opus 5\.5[^\n]*high/i.test(file.replace(/[*`]/g, '')), 'end: the models and effort levels in the credits are the ones CREDITS.md records from the logs');
}

for (const n of ['hud', 'aurora']) { const f = (cues.shots.find((x) => x.name === n) || {}).file; if (f) ok(fs.existsSync(P('film/out', f)), `${n}: the file it names, ${f}, exists`); }

// the finished file
const mp4 = (lines.find((l) => /mpv /.test(l.text)) || { text: '' }).text.match(/mpv (\S+)\)/);
if (mp4 && fs.existsSync(P('film/out', mp4[1]))) {
  const pr = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', P('film/out', mp4[1])], { encoding: 'utf8' })).streams[0];
  const base = P('film/out', mp4[1].replace(/\.mp4$/, ''));
  ok(pr.width === 1920 && pr.height === 1080 && pr.r_frame_rate === '60/1', `soft: "${text('soft')}": the file is ${pr.width}x${pr.height} at ${pr.r_frame_rate}`);
  ok(fs.existsSync(base + '_poster.jpg') && fs.existsSync(base + '_contact.jpg'), `soft: the poster and the contact sheet exist`);
}
console.log(bad ? `\n${bad} thing(s) on screen are not true yet.` : '\nEverything the terminal prints is true.');
process.exit(bad ? 1 : 0);
