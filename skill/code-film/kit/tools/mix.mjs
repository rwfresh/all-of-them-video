#!/usr/bin/env node
// Builds the soundtrack from the cue sheet: voice lines at their start times, sound effects at the hit times the
// picture reports, music ducked under the voice, then two-pass loudness normalisation to -14 LUFS.
//   node tools/mix.mjs            -> audio/mix.wav   (reads film/out/film.json; refresh it with: harness --info)
// Options: --vo 1.0 --sfx 0.75 --music 0.5   bus gains,  --musicfrom <shot>   shot where the music enters

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => path.join(ROOT, ...a);
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
const film = JSON.parse(fs.readFileSync(P('film/out/film.json'), 'utf8'));
const DUR = film.duration;

/** Minimal PCM16 WAV reader: peak level, when the peak happens, and the length. */
function wavInfo(file) {
  const b = fs.readFileSync(file);
  let off = 12, fmt = null, data = null;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4), size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { ch: b.readUInt16LE(off + 10), rate: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22) };
    if (id === 'data') { data = { off: off + 8, size: Math.min(size, b.length - off - 8) }; break; }
    off += 8 + size + (size % 2);
  }
  const step = (fmt.bits / 8) * fmt.ch, n = Math.floor(data.size / step);
  let peak = 0, at = 0;
  const env = [];
  const win = Math.floor(fmt.rate * 0.5);
  let acc = 0, cnt = 0;
  for (let i = 0; i < n; i++) {
    const v = Math.abs(b.readInt16LE(data.off + i * step)) / 32768;
    if (v > peak) { peak = v; at = i; }
    acc += v * v; cnt++;
    if (cnt === win) { env.push(Math.sqrt(acc / cnt)); acc = 0; cnt = 0; }
  }
  return { peak, peakT: at / fmt.rate, dur: n / fmt.rate, env };
}

const inputs = [], chains = [], voLabels = [], fxLabels = [];
const add = (file) => { inputs.push('-i', file); return inputs.length / 2 - 1; };
const FMT = 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo';
const ms = (t) => Math.max(0, Math.round(t * 1000));

// voice
for (const [id, at] of film.lines) {
  if (!fs.existsSync(P('audio/vo', `${id}.wav`))) { console.log(`no voice take yet for line: ${id}`); continue; }
  const i = add(P('audio/vo', `${id}.wav`));
  chains.push(`[${i}:a]${FMT},adelay=${ms(at)}:all=1[v${i}]`);
  voLabels.push(`[v${i}]`);
}

// sound effects: each file is peak-normalised, then placed so its start (or its loudest moment) lands on the cue
const info = {};
for (const c of film.sfx) {
  if (c.s.startsWith('__')) continue;            // a direction for the mix, not a sound
  const file = P('audio/sfx', `${c.s}.wav`);
  if (!fs.existsSync(file)) { console.log(`missing sound: ${c.s}`); continue; }
  const w = (info[c.s] ||= wavInfo(file));
  if (w.peak < 0.02) { console.log(`skipping near-silent sound: ${c.s}`); continue; }
  const start = c.t - (c.a === 'peak' ? w.peakT : 0);
  const len = Math.min(c.len ?? w.dur, w.dur, DUR - Math.max(0, start));
  const gain = (0.7 / w.peak) * (c.g ?? 1);
  const i = add(file);
  chains.push(`[${i}:a]${FMT},atrim=0:${len.toFixed(3)},afade=t=out:st=${Math.max(0, len - 0.1).toFixed(3)}:d=0.1,volume=${gain.toFixed(3)},adelay=${ms(start)}:all=1[s${i}]`);
  fxLabels.push(`[s${i}]`);
}

// music: enters with the shot named in cues.json ("music": { "from": "<shot>" }), so an opening can play dry
const cues = JSON.parse(fs.readFileSync(P('film/cues.json'), 'utf8'));
const musFile = P('audio/music.wav');
const hasMus = fs.existsSync(musFile), hasFx = fxLabels.length > 0;
if (!voLabels.length) { console.log('no voice takes yet: nothing to mix (run tools/vo.mjs first)'); process.exit(2); }
// bus gains: command line first, then "mix" in cues.json, then the defaults
const VO = +opt('vo', cues.mix?.vo ?? 1.0), SFX = +opt('sfx', cues.mix?.sfx ?? 0.75), MUS = +opt('music', cues.mix?.music ?? 0.5);
const buses = ['[vo]'];
const split = ['[vo]', '[voS]'];
if (hasFx) split.push('[sc2]');
if (hasMus) split.push('[sc1]');
const graphParts = [
  ...chains,
  `${voLabels.join('')}amix=inputs=${voLabels.length}:normalize=0,highpass=f=90,acompressor=threshold=-20dB:ratio=3:attack=4:release=90:makeup=4,volume=${VO},apad=whole_dur=${DUR},asplit=${split.length}${split.join('')}`,
];
if (hasFx) {
  graphParts.push(
    `${fxLabels.join('')}amix=inputs=${fxLabels.length}:normalize=0,volume=${SFX},apad=whole_dur=${DUR}[fx0]`,
    `[fx0][sc2]sidechaincompress=threshold=0.04:ratio=2.5:attack=8:release=160,asplit[fx][fxS]`,
  );
  buses.push('[fx]');
}
let musNote = 'no music file';
if (hasMus) {
  const mw = wavInfo(musFile);
  const from = opt('musicfrom', cues.music?.from);
  const enter = from ? film.shots.find((x) => x[0] === from)[1] : 0;
  // a '__music_stop' cue cuts the music dead (a punchline can play dry); otherwise it runs to the end of the film
  const stop = film.sfx.find((c) => c.s === '__music_stop');
  const need = (stop ? stop.t : DUR) - enter;
  // without a stop cue, line the track's real ending (where its level finally drops away) up with the film's end
  // music.endLevel / music.endPad in cues.json move that point: a higher level ends the film while the music is still up
  const musEnd = (mw.env.findLastIndex((v) => v > (cues.music?.endLevel ?? 0.03)) + 1) * 0.5 + (cues.music?.endPad ?? 0.4);
  const skip = Math.max(0, +(opt('musicskip', stop ? 1.0 : Math.max(0, musEnd - need))));
  const mi = add(musFile);
  graphParts.push(
    `[${mi}:a]${FMT},atrim=${skip.toFixed(3)}:${(skip + need).toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.04${stop ? `,afade=t=out:st=${(need - 0.07).toFixed(3)}:d=0.07` : `,afade=t=out:st=${(need - 0.35).toFixed(3)}:d=0.35`},volume=${MUS},adelay=${ms(enter)}:all=1,apad=whole_dur=${DUR}[mus0]`,
    // duck only the speech band (250 Hz to 4.5 kHz): the bass and the sparkle stay up, so the bed sounds loud
    // under the voice without masking it
    `[mus0]asplit=3[ml][mm][mh]`,
    `[ml]lowpass=f=250[ml2]`, `[mh]highpass=f=4500[mh2]`, `[mm]highpass=f=250,lowpass=f=4500[mm2]`,
    `[mm2][sc1]sidechaincompress=threshold=0.02:ratio=8:attack=12:release=300[mmd]`,
    `[ml2][mmd][mh2]amix=inputs=3:normalize=0,asplit[mus][musS]`,
  );
  buses.push('[mus]');
  musNote = `music from ${enter.toFixed(2)} s (track ${skip.toFixed(1)}-${(skip + need).toFixed(1)} s${stop ? ', cut dead at ' + stop.t.toFixed(2) + ' s' : ''})`;
}
graphParts.push(
  // a little tape: band-limited, with a breath of hiss (set "hiss": 0 in cues.json for a clean track)
  `anoisesrc=color=pink:amplitude=${cues.hiss ?? 0.0022}:duration=${DUR}:sample_rate=48000,${FMT}[hiss]`,
  `${buses.join('')}[hiss]amix=inputs=${buses.length + 1}:normalize=0,highpass=f=45,lowpass=f=13500,atrim=0:${DUR},afade=t=out:st=${(DUR - 0.5).toFixed(3)}:d=0.5,alimiter=limit=0.89:attack=2:release=40[out]`,
);
const graph = graphParts.join(';');

fs.mkdirSync(P('audio/out'), { recursive: true });
fs.writeFileSync(P('audio/out/graph.txt'), graph.replace(/;/g, ';\n'));
const pre = P('audio/out/premix.wav');
const stem = (l, f) => ['-map', `[${l}]`, '-t', String(DUR), '-c:a', 'pcm_s16le', P('audio/out', f)];
execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', graph, '-map', '[out]', '-c:a', 'pcm_s24le', '-ar', '48000', pre,
  ...stem('voS', 'stem_voice.wav'), ...(hasFx ? stem('fxS', 'stem_fx.wav') : []), ...(hasMus ? stem('musS', 'stem_music.wav') : [])], { stdio: 'inherit' });

// two-pass loudness to -14 LUFS
const LN = 'I=-14:TP=-1.5:LRA=9';
const pass1 = spawnSync('ffmpeg', ['-hide_banner', '-i', pre, '-af', `loudnorm=${LN}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
const m = JSON.parse(pass1.stderr.slice(pass1.stderr.lastIndexOf('{'), pass1.stderr.lastIndexOf('}') + 1));
const out = P('audio/mix.wav');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', pre, '-af',
  `loudnorm=${LN}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`,
  '-c:a', 'pcm_s16le', out], { stdio: 'inherit' });
const chk = spawnSync('ffmpeg', ['-hide_banner', '-i', out, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
const pick = (re) => (chk.stderr.match(re) || []).pop();
console.log(`mix: ${out}`);
console.log(`  length ${DUR.toFixed(2)} s, ${voLabels.length} voice lines, ${fxLabels.length} sound cues, ${musNote}`);
console.log(`  premix ${m.input_i} LUFS -> ${String(pick(/I:\s+(-?[\d.]+) LUFS/g))}, ${String(pick(/Peak:\s+(-?[\d.]+) dBFS/g))}`);
const lufs = (f) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-i', P('audio/out', f), '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' }); return (r.stderr.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop(); };
console.log(`  stems before the final gain: voice ${lufs('stem_voice.wav')}${hasFx ? ', effects ' + lufs('stem_fx.wav') : ''}${hasMus ? ', music (ducked) ' + lufs('stem_music.wav') : ''}`);
