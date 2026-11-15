#!/usr/bin/env node
// Every hand-over in the film on one page: for each bar line, stills just before it and through the change.
//   node tools/joints.mjs [--beats -0.3,0.15,0.5,0.9,1.4,1.9]   -> film/out/sheets/joints/joints-1.jpg, joints-2.jpg
// (One browser, every shot built, so it also shows whether the whole film loads.)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildClock } from '../film/js/clock.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
const clock = buildClock(JSON.parse(fs.readFileSync(path.join(ROOT, 'film/cues.json'), 'utf8')));
const beats = opt('beats', '-0.3,0.15,0.5,0.9,1.4,1.9').split(',').map(Number);
const joints = clock.shots.slice(1);
const times = joints.flatMap((s) => beats.map((b) => clock.time(s.b0 + b)));
const dir = path.join(ROOT, 'film/out/sheets/joints');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const log = execFileSync('node', [path.join(ROOT, 'harness/render.mjs'), 'film', '--stills', times.map((t) => t.toFixed(4)).join(','), '--dir', dir], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
for (const l of log.split('\n')) if (/\[page|WARNING|failed to load|render failed/.test(l)) console.log(l);
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
if (files.length !== times.length) { console.error(`expected ${times.length} stills, got ${files.length}`); process.exit(1); }
const n = beats.length, half = Math.ceil(joints.length / 2);
for (const [k, part] of [joints.slice(0, half), joints.slice(half)].entries()) {
  const off = k * half * n;
  const names = files.slice(off, off + part.length * n).map((f) => path.join(dir, f));
  const out = path.join(dir, `joints-${k + 1}.jpg`);
  execFileSync('magick', ['montage', ...names, '-tile', `${n}x`, '-geometry', '480x270+3+3', '-background', '#111', '-quality', '88', out]);
  console.log(`${out}: into ${part.map((s) => s.name).join(', ')} at beats ${beats.join(', ')}`);
}
