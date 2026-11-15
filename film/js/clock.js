// The film's clock is the music's. The cue sheet gives a tempo and, for each shot, a whole number of bars; everything
// else is placed in beats. Change the tempo (or the offset of the first downbeat) and the whole film retimes.

export function buildClock(cues) {
  const fps = cues.fps || 60;
  const bpm = cues.bpm, spb = 60 / bpm, bpb = cues.beatsPerBar || 4, offset = cues.offset || 0;
  /** Film seconds at an absolute beat (beat 0 = the first downbeat). */
  const time = (beats) => offset + beats * spb;
  /** Absolute beat (fractional) at a film time. */
  const beat = (t) => (t - offset) / spb;

  let b = 0;
  const shots = cues.shots.map((s, index) => {
    const beats = s.bars * bpb;
    const o = { ...s, index, b0: b, b1: b + beats, beats };
    b += beats;
    return o;
  });
  for (const s of shots) { s.t0 = time(s.b0); s.t1 = time(s.b1); s.dur = s.t1 - s.t0; }
  const totalBeats = b + (cues.tailBeats || 0);
  const duration = Math.ceil(time(totalBeats) * fps - 1e-6) / fps;
  return { fps, bpm, spb, bpb, offset, time, beat, shots, totalBeats, duration, shot: Object.fromEntries(shots.map((s) => [s.name, s])) };
}
