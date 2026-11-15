#!/usr/bin/env node
// One still of every shot, for the shots that show the film's own frames (the sticker explainer, the collage, the phone):
// assets/thumbs/<shot>.png at 960x540, taken at each shot's best moment (local beats, below). Run again whenever shots change.
//   node tools/thumbs.mjs [shot ...]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildClock } from '../film/js/clock.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clock = buildClock(JSON.parse(fs.readFileSync(path.join(ROOT, 'film/cues.json'), 'utf8')));
// the local beat that shows each shot at its best; anything not listed uses 60% of the way through
const BEST = { open: 7, line: 9.5, boil: 11.5, bauhaus: 7.3, iso: 7.5, flat: 4.8, morph: 5.4, liquid: 5.7, sticker: 11, pixel: 6.2, synth: 5.5, hud: 5.3, collage: 7.9, soft: 7, aurora: 5.4, variety: 6.5 };
const only = process.argv.slice(2);
const shots = clock.shots.filter((s) => !only.length || only.includes(s.name));
const tmp = path.join(ROOT, 'film/out/thumbs-tmp');
fs.rmSync(tmp, { recursive: true, force: true });
const times = shots.map((s) => clock.time(s.b0 + (BEST[s.name] ?? s.beats * 0.6)));
execFileSync('node', [path.join(ROOT, 'harness/render.mjs'), 'film', '--stills', times.map((t) => t.toFixed(4)).join(','), '--dir', tmp, '--query', 'solo=1' + (only.length ? '&shots=' + shots.map((x) => x.name).join(',') : '')], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const files = fs.readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
fs.mkdirSync(path.join(ROOT, 'assets/thumbs'), { recursive: true });
shots.forEach((s, i) => execFileSync('magick', [path.join(tmp, files[i]), '-resize', '960x540', path.join(ROOT, 'assets/thumbs', `${s.name}.png`)]));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`assets/thumbs: ${shots.map((s) => s.name).join(', ')}`);
