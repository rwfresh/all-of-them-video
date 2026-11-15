// Turns the cue sheet into absolute times: when each voice line starts, when a given word is spoken, and where each
// shot begins and ends. Picture and sound both read these, so a retimed voiceover moves every cut with it.
//
// cues.shots lists the shots in order. Each says where it cuts in:
//   { "name": "a", "at": 0 }                                   at a fixed time
//   { "name": "b", "line": "intro" }                           just before a voice line (lead, default 0.14 s)
//   { "name": "c", "mark": ["discs", "on fourteen"], "lead": 0.22 }   just before a spoken word or phrase
// A shot leads its words by a few frames so the picture arrives before the voice.

export function buildTimeline(cues) {
  const lines = {};
  let t = cues.leadIn;
  for (const l of cues.lines) {
    lines[l.id] = { ...l, at: t, end: t + l.dur };
    t = lines[l.id].end + (l.gap ?? 0.25);
  }
  const duration = Math.ceil((t + cues.tail) * 30) / 30;

  /** Absolute time at which `word` starts in a voice line: from recorded word timings, else estimated by position. */
  const mark = (lineId, word) => {
    const l = lines[lineId];
    const key = String(word).toLowerCase();
    if (l.words) {
      // match a run of words, so "on fourteen" finds the "on" that is followed by "fourteen"
      const parts = key.split(/\s+/);
      const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (let i = 0; i < l.words.length; i++) {
        if (parts.every((p, k) => l.words[i + k] && norm(l.words[i + k].w).startsWith(norm(p)))) return l.at + l.words[i].t0;
      }
    }
    const i = l.text.toLowerCase().indexOf(key);
    return l.at + l.dur * (i < 0 ? 0 : i / l.text.length);
  };

  const start = (s) => {
    if (s.at !== undefined) return s.at;
    if (s.mark) return mark(s.mark[0], s.mark[1]) - (s.lead ?? 0.14);
    return lines[s.line].at - (s.lead ?? 0.14);
  };
  const shots = cues.shots.map((s) => ({ name: s.name, t0: Math.max(0, Math.round(start(s) * 30) / 30) }));
  shots.forEach((s, i) => { s.t1 = i + 1 < shots.length ? shots[i + 1].t0 : duration; s.dur = s.t1 - s.t0; });
  return { lines, shots, duration, mark, shot: Object.fromEntries(shots.map((s) => [s.name, s])) };
}
