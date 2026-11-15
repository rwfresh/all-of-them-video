import fs from 'node:fs';
import { buildTimeline } from '../film/js/timeline.js';
const tl = buildTimeline(JSON.parse(fs.readFileSync(new URL('../film/cues.json', import.meta.url), 'utf8')));
for (const s of tl.shots) console.log(s.name.padEnd(9), s.t0.toFixed(2).padStart(6), '->', s.t1.toFixed(2).padStart(6), ` (${s.dur.toFixed(2)} s)`);
console.log('duration', tl.duration.toFixed(2));
