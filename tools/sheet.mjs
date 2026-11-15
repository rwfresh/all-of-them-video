#!/usr/bin/env node
// Stills and a contact sheet for one shot, placed in beats (the film's clock), so you can look at what you made.
//   node tools/sheet.mjs line                    12 stills across the shot -> film/out/sheets/line/sheet.jpg
//   node tools/sheet.mjs line --n 24             more of them
//   node tools/sheet.mjs line --from -2 --to 4   local beats (negative = before the shot's bar line, to see the hand-over)
//   node tools/sheet.mjs line --at 0,1.5,3       exact local beats, full-size PNGs only
//   node tools/sheet.mjs line --solo             the shot alone, without its neighbours' hand-overs
//   node tools/sheet.mjs all --n 38              the whole film, one still a bar
// A named shot is built with only its two neighbours (other shots show placeholder cards); --film builds every shot.
// Full-size PNGs are kept beside the sheet (b<beat>.png) for a close look.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildClock } from '../film/js/clock.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const name = argv[0];
const opt = (k, d) => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
if (!name) { console.error('usage: sheet.mjs <shot|all> [--n 12] [--from b --to b] [--at b,b] [--solo] [--cols 4]'); process.exit(1); }

const clock = buildClock(JSON.parse(fs.readFileSync(path.join(ROOT, 'film/cues.json'), 'utf8')));
const s = name === 'all' ? { b0: 0, beats: clock.totalBeats } : clock.shot[name];
if (!s) { console.error(`no shot "${name}". Shots: ${clock.shots.map((x) => x.name).join(', ')}`); process.exit(1); }

let beats;
if (argv.includes('--at')) beats = opt('at').split(',').map(Number);
else {
  const n = +opt('n', 12), from = +opt('from', 0), to = +opt('to', s.beats);
  beats = Array.from({ length: n }, (_, i) => from + ((i + 0.5) / n) * (to - from));
}
const eps = 0.5 / clock.fps;
const times = beats.map((b) => Math.min(clock.duration - eps, Math.max(0, clock.time(s.b0 + b))));
const dir = path.join(ROOT, 'film/out/sheets', name);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const args = [path.join(ROOT, 'harness/render.mjs'), 'film', '--stills', times.map((t) => t.toFixed(4)).join(','), '--dir', dir];
// build only this shot and its two neighbours (the others show placeholder cards), unless --film asks for every shot
const q = [];
if (argv.includes('--solo')) q.push('solo=1');
if (name !== 'all' && !argv.includes('--film')) { const i = clock.shots.findIndex((x) => x.name === name); q.push('shots=' + clock.shots.slice(Math.max(0, i - 1), i + 2).map((x) => x.name).join(',')); }
if (q.length) args.push('--query', q.join('&'));
const log = execFileSync('node', args, { cwd: ROOT, encoding: 'utf8' });
for (const l of log.split('\n')) if (/\[page|WARNING|failed/.test(l)) console.log(l);

// rename t<seconds>.png to b<local beat>.png, in order
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const named = files.map((f, i) => {
  const to = path.join(dir, `b${(beats[i] < 0 ? 'm' : '') + Math.abs(beats[i]).toFixed(2).padStart(5, '0')}.png`);
  fs.renameSync(path.join(dir, f), to);
  return to;
});
if (!argv.includes('--at')) {
  const cols = +opt('cols', 4);
  const sheet = path.join(dir, 'sheet.jpg');
  execFileSync('magick', ['montage', ...named, '-tile', `${cols}x`, '-geometry', '640x360+4+4', '-background', '#111', '-quality', '90', sheet]);
  console.log(sheet);
} else for (const f of named) console.log(f);
