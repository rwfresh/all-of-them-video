// GLSL for the Liquid shot. One fragment shader draws the whole picture for an instant: the ground (or the neighbour
// shot's picture), then sheets of thick liquid, back to front.
//   main    the pool, its columns (the spectrum), the blobs they pass to each other on necks, and the wave that floods
//           the frame on the first beat. One distance field, joined with a smooth minimum, so parts fuse and neck.
//   drops   what flies in front of the columns (and, on the way out, beads that sit on the last wave)
//   text    the result line: drops thrown up by the columns that settle into big letters (a blurred mask as a field)
//   hot, pink, violet   the three waves of the way out, each a flat sheet with a thick lit edge
// Each primitive returns its distance, its gradient and its own thickness, so the lighting needs no extra samples:
// the gradient is the surface's slope, and a round edge profile (as wide as the part is thick) turns it into a normal.
// That is the whole trick of the style: fake 3D from a 2D field. Colours are worked in linear light, written in sRGB.

export const NC = 15;      // columns
export const NB = 52;      // free blobs, in four groups
export const BLOBS = { fused: [0, 14], front: [14, 30], text: [30, 46], hot: [46, 52] };   // joined to pool and columns; in front of them; the result line's; the first wave's
export const NR = 8;       // ripples on the pool
export const NN = 8;       // necks between a column and a blob

const COMMON = /* glsl */`
precision highp float;
varying vec2 vUv;
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
vec3 srgb(vec3 c) { return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`;

export const LIQUID_FRAG = COMMON + /* glsl */`
#define NC ${NC}
#define NB ${NB}
#define NN ${NN}
#define B_FUSED ${14}
#define B_FRONT ${30}
#define B_TEXT ${46}
#define NR ${NR}
uniform vec2 uRes;
uniform float uWeight, uBeat, uSec;
uniform sampler2D tOther;
uniform float uOther;            // 0 no neighbour picture; 1 it lies outside the flood ring; 2 it lies behind the waves
uniform vec2 uHit;               // where the drop lands
uniform vec3 uFlood;             // the first wave: its leading edge (y), its thickness, its phase
uniform float uFloodOn;
uniform vec4 uNeckA[NN];         // necks: from x, y to x, y
uniform float uNeckR[NN];
uniform sampler2D tGlyph;        // the result line's letters, blurred: coverage as a height
uniform vec2 uGlyphBox;          // the strip of the frame that texture covers: top, height
uniform float uTextOn;
uniform float uFlash;
uniform float uLevel, uSwell, uPoolOn;
uniform vec4 uRip[NR];           // x, amplitude, beats since it started, decay
uniform vec4 uColA[NC];          // x, top y, radius, lean
uniform vec4 uColB[NC];          // head y, head radius, neck radius, head squash
uniform vec4 uBlobA[NB];         // x, y, radius, stretch
uniform vec2 uBlobB[NB];         // direction of travel
uniform vec3 uFront, uTail;      // where each wave's leading and trailing edge is (x)
uniform float uWaveOn, uWavePh;
uniform float uRamp;             // 0: everything is the drop's orange; 1: orange above, pink, violet in the deep
uniform float uGlow, uPulse, uMix;
uniform vec4 uBub[10];           // bubbles rising in the pool: x, y, radius, strength
uniform float uBackA[8], uBackB[8];   // the music a moment ago, and a moment before that: two ranges of hills behind everything

const float BEVEL = 46.0;
const float WAVE_BEVEL = 96.0;
const float BIG = 1000.0;

// ---- smooth minimum that also blends gradient and thickness (after Inigo Quilez) ----
vec4 smin(vec4 a, vec4 b, float k) {
  float h = max(k - abs(a.x - b.x), 0.0);
  float m = 0.25 * h * h / k, n = 0.5 * h / k;
  return vec4(min(a.x, b.x) - m, mix(a.yzw, b.yzw, a.x < b.x ? n : 1.0 - n));
}
vec4 smax(vec4 a, vec4 b, float k) { vec4 r = smin(vec4(-a.x, a.yzw), vec4(-b.x, b.yzw), k); return vec4(-r.x, r.yzw); }

vec4 sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-3), 0.0, 1.0);
  vec2 q = pa - ba * h; float l = max(length(q), 1e-3);
  return vec4(l - r, q / l, r);
}
/** A ball stretched by s along dir (and thinned across it, so its size holds). */
vec4 sdBlob(vec2 p, vec2 c, float r, float s, vec2 dir) {
  vec2 q = p - c, n = vec2(-dir.y, dir.x);
  vec2 sc = vec2(s, 1.0 / sqrt(s));
  vec2 l = vec2(dot(q, dir), dot(q, n)) / sc;
  float len = max(length(l), 1e-3);
  vec2 gl = normalize((l / len) / sc);
  return vec4((len - r) * min(sc.x, sc.y), dir * gl.x + n * gl.y, r * min(sc.x, sc.y));
}

// ---- the pool's surface: a level, a slow swell, and rings that run out from wherever something lands ----
float surf(float x) {
  float y = uLevel + uSwell * (5.0 * sin(x * 0.0061 + uSec * 1.9) + 3.0 * sin(x * 0.0137 - uSec * 2.7 + 1.3));
  for (int i = 0; i < NR; i++) {
    vec4 r = uRip[i];
    if (r.y == 0.0) continue;
    float dx = abs(x - r.x), w = 60.0 + 520.0 * r.z;
    y -= r.y * exp(-r.z * r.w) * cos(dx * 0.02 - r.z * 10.0) * exp(-dx * dx / (w * w));
  }
  return y;
}

// ---- the waves of the way out: an edge that runs down the frame with five bulges, each on its own clock ----
float edgeX(float y, float base, float ph, float seed, float amp) {
  float x = base;
  for (int j = 0; j < 5; j++) {
    float fj = float(j);
    float yc = 108.0 + 216.0 * fj + 46.0 * sin(seed * 3.1 + fj * 2.7 + ph * 0.6);
    float a = amp * (0.5 + 0.5 * sin(ph * 1.7 + fj * 2.399 + seed * 1.9));
    float u = (y - yc) / 112.0;
    x += a * exp(-u * u);
  }
  return x + 16.0 * sin(y * 0.021 + ph * 2.3 + seed) - amp * 0.55;
}
/** A sheet that covers the frame between a trailing edge (left) and a leading edge (right). */
vec4 sdSheet(vec2 p, float front, float tail, float seed) {
  float xf = edgeX(p.y, front, uWavePh, seed, 190.0), sf = edgeX(p.y + 1.0, front, uWavePh, seed, 190.0) - xf;
  vec4 a = vec4((p.x - xf) / sqrt(1.0 + sf * sf), normalize(vec2(1.0, -sf)), BIG);
  // the trailing edge drags: its bulges point back the way it came
  float xt = 2.0 * tail - edgeX(p.y, tail, uWavePh * 0.8 + 2.0, seed + 5.0, 170.0);
  float st = (2.0 * tail - edgeX(p.y + 1.0, tail, uWavePh * 0.8 + 2.0, seed + 5.0, 170.0)) - xt;
  vec4 b = vec4((xt - p.x) / sqrt(1.0 + st * st), normalize(vec2(-1.0, st)), BIG);
  return smax(a, b, 30.0);
}
/** The first wave, with the beads that fly ahead of it and hang behind it. */
vec4 sdHot(vec2 p) {
  vec4 d = sdSheet(p, uFront.x, uTail.x, 0.0);
  for (int j = B_TEXT; j < NB; j++) {
    vec4 A = uBlobA[j];
    if (A.z <= 0.0) continue;
    d = smin(d, sdBlob(p, A.xy, A.z, A.w, uBlobB[j]), 50.0);
  }
  return d;
}
/** Drops in the air: in front of the columns, so they cross them cleanly and only join the pool when they land. */
vec4 fieldDrops(vec2 p) {
  vec4 d = vec4(1e4, 0.0, -1.0, BIG);
  for (int j = B_FUSED; j < B_FRONT; j++) {
    vec4 A = uBlobA[j];
    if (A.z <= 0.0) continue;
    d = smin(d, sdBlob(p, A.xy, A.z, A.w, uBlobB[j]), 14.0);
  }
  return d;
}
/** The result line: letters from a blurred mask, joined to the drops that are still on their way into them. */
vec4 fieldText(vec2 p) {
  vec4 d = vec4(1e4, 0.0, -1.0, BIG);
  float v = (p.y - uGlyphBox.x) / uGlyphBox.y;
  if (v > 0.0 && v < 1.0) {
    vec2 uv = vec2(p.x / uRes.x, 1.0 - v), e = vec2(2.0 / uRes.x, 2.0 / uGlyphBox.y);
    float c = texture2D(tGlyph, uv).a;
    vec2 g = -vec2(texture2D(tGlyph, uv + vec2(e.x, 0.0)).a - texture2D(tGlyph, uv - vec2(e.x, 0.0)).a,
                   texture2D(tGlyph, uv - vec2(0.0, e.y)).a - texture2D(tGlyph, uv + vec2(0.0, e.y)).a);
    float gl = length(g);
    // coverage 0.5 is the outline; a blur of 5 px makes about 12.5 px of distance for the whole step
    d = vec4((0.5 - c) * 12.5 + 220.0 * smoothstep(0.07, 0.0, c), gl > 1e-4 ? g / gl : vec2(0.0, -1.0), 15.0);
  }
  for (int j = B_FRONT; j < B_TEXT; j++) {
    vec4 A = uBlobA[j];
    if (A.z <= 0.0) continue;
    d = smin(d, sdBlob(p, A.xy, A.z, A.w, uBlobB[j]), 22.0);
  }
  return d;
}

/** A range of soft hills, one for each band, low notes on the left: the spectrum's echo, far behind. */
float hills(float x, float v[8], float shift, float tall) {
  float h = 0.0;
  for (int k = 0; k < 8; k++) { float u = (x - shift - 150.0 - float(k) * 231.0) / 176.0; h += v[k] * exp(-u * u); }
  return h * tall;
}

// ---- the wave of the way in: it rises through the frame with four bulges, each on its own clock ----
float floodF(float x) {
  float y = uFlood.x, ph = uFlood.z;
  for (int j = 0; j < 4; j++) {
    float fj = float(j);
    float xc = 240.0 + 480.0 * fj + 70.0 * sin(ph * 0.7 + fj * 2.1);
    float a = 190.0 * (0.5 + 0.5 * sin(ph * 1.9 + fj * 2.4 + 0.6));
    float u = (x - xc) / 190.0;
    y -= a * exp(-u * u);
  }
  return y + 14.0 * sin(x * 0.017 + ph * 2.1);
}
float floodT(float x) { return floodF(x + 90.0) + uFlood.y * (0.75 + 0.25 * sin(x * 0.006 + uFlood.z)); }

vec4 fieldMain(vec2 p) {
  vec4 d = vec4(1e4, 0.0, -1.0, BIG);
  if (uPoolOn > 0.5) {
    float s = surf(p.x), sl = (surf(p.x + 1.0) - s);
    d = vec4((s - p.y) / sqrt(1.0 + sl * sl), normalize(vec2(sl, -1.0)), BIG);
    float base = uLevel + 70.0;
    for (int i = 0; i < NC; i++) {
      vec4 A = uColA[i], B = uColB[i];
      if (A.z <= 0.0) continue;
      float hgt = max(base - A.y, 1.0);
      float u = clamp((base - p.y) / hgt, 0.0, 1.0);
      vec2 q = vec2(p.x - A.w * u * u, p.y);                      // the column leans more the higher it goes
      // wide where it stands in the pool, drawn in at two thirds of its height, round at the top
      float waist = A.z * (0.78 + 0.34 * pow(1.0 - clamp(u, 0.0, 1.0), 2.0) + 0.1 * smoothstep(0.7, 1.0, u));
      vec4 c = sdCapsule(q, vec2(A.x, base), vec2(A.x, A.y), waist);
      // its head: a ball that can leave on a neck. It keeps the column's line but is not bent by it.
      float uh = clamp((base - B.x) / hgt, 0.0, 1.6);
      vec2 hc = vec2(A.x + A.w * (uh <= 1.0 ? uh * uh : 2.0 * uh - 1.0), B.x), tc = vec2(A.x + A.w, A.y - 4.0);
      vec2 sc = vec2(1.0 / sqrt(B.w), B.w);
      vec2 hq = (p - hc) / sc;
      float hl = max(length(hq), 1e-3);
      vec4 h = vec4((hl - B.y) * min(sc.x, sc.y), normalize(hq / sc), B.y);
      c = smin(c, h, 34.0);
      if (B.z > 0.5) c = smin(c, sdCapsule(p, tc, hc, B.z), 18.0);
      d = smin(d, c, 44.0);
    }
  }
  for (int j = 0; j < B_FUSED; j++) {
    vec4 A = uBlobA[j];
    if (A.z <= 0.0) continue;
    d = smin(d, sdBlob(p, A.xy, A.z, A.w, uBlobB[j]), 30.0);
  }
  for (int i = 0; i < NN; i++) {
    if (uNeckR[i] <= 0.5) continue;
    d = smin(d, sdCapsule(p, uNeckA[i].xy, uNeckA[i].zw, uNeckR[i]), 16.0);
  }
  if (uFloodOn > 0.5) {
    float f = floodF(p.x), sf = floodF(p.x + 1.0) - f, t = floodT(p.x), st = floodT(p.x + 1.0) - t;
    vec4 a = vec4((f - p.y) / sqrt(1.0 + sf * sf), normalize(vec2(sf, -1.0)), max(t - f, 20.0) * 0.5);
    vec4 b = vec4((p.y - t) / sqrt(1.0 + st * st), normalize(vec2(-st, 1.0)), max(t - f, 20.0) * 0.5);
    d = smin(d, smax(a, b, 24.0), 60.0);
  }
  return d;
}

// ---- colour: the drop's orange on top, pink, then violet in the deep ----
vec3 ramp(float y) {
  vec3 c0 = lin(vec3(1.0, 0.44, 0.10)), c1 = lin(vec3(1.0, 0.21, 0.40)), c2 = lin(vec3(0.90, 0.15, 0.66)), c3 = lin(vec3(0.50, 0.17, 0.90)), c4 = lin(vec3(0.25, 0.09, 0.62));
  float yy = mix(240.0, y, uRamp) - uMix;
  vec3 c = mix(c0, c1, smoothstep(240.0, 520.0, yy));
  c = mix(c, c2, smoothstep(480.0, 700.0, yy));
  c = mix(c, c3, smoothstep(670.0, 800.0, yy));
  return mix(c, c4, smoothstep(830.0, 1090.0, yy));
}

/** Thick glossy liquid: distance, gradient and thickness become a rounded edge, lit from the upper left. */
vec3 shade(vec4 df, vec3 base, float cap) {
  float bev = clamp(df.w, 5.0, cap);
  float t = clamp(-df.x / bev, 0.0, 1.0);
  float hz = sqrt(max(1.0 - (1.0 - t) * (1.0 - t), 0.0));
  float slope = (1.0 - t) / max(hz, 0.14);
  vec3 n = normalize(vec3(df.yz * slope, 1.0));
  vec3 L = normalize(vec3(-0.50, -0.68, 0.54)), V = vec3(0.0, 0.0, 1.0), H = normalize(L + V);
  float nl = dot(n, L), wrap = 0.5 + 0.5 * nl;
  float rim = pow(1.0 - n.z, 2.2);
  // the side away from the light goes deeper and more saturated, never grey
  vec3 deep = base * base * 1.25 * vec3(0.85, 0.5, 1.15) + base * 0.12;
  vec3 col = mix(deep, base, smoothstep(0.10, 0.74, wrap));
  col *= 0.84 + 0.3 * wrap;
  // light coming through the far edge (it is syrup, not paint)
  col += base * vec3(1.35, 0.8, 0.65) * rim * max(0.0, -nl) * 1.0;
  // what faces the sky is a little paler, like any glossy bead
  col = mix(col, col * 1.12 + vec3(0.05, 0.035, 0.045), smoothstep(0.1, 0.8, -n.y) * (1.0 - n.z * n.z));
  // a tall soft light on the left: the long streak down a column
  float strip = pow(max(dot(n, normalize(vec3(-0.66, -0.10, 0.74))), 0.0), 46.0);
  col += vec3(1.0, 0.9, 0.92) * strip * 0.42;
  // the hot highlight, and its softer halo
  float ndh = max(dot(n, H), 0.0);
  // (only on parts that are round: where a column meets the pool the slope turns slowly, and a highlight would smear)
  float round_ = 1.0 - smoothstep(70.0, 140.0, df.w);
  col += vec3(1.0, 0.98, 0.95) * (smoothstep(0.972, 0.992, ndh) * 0.95 * round_ + pow(ndh, 40.0) * 0.16 * (0.4 + 0.6 * round_));
  // a cool rim, a second light from the right (so an edge that runs away from the key still shines), a third from below
  col += vec3(1.0, 0.6, 0.95) * rim * smoothstep(-0.2, 0.9, nl) * 0.28;
  col += vec3(1.0, 0.84, 0.92) * pow(max(dot(n, normalize(vec3(0.80, -0.18, 0.57))), 0.0), 34.0) * 0.34;
  col += vec3(0.5, 0.66, 1.0) * pow(max(dot(n, normalize(vec3(0.62, 0.58, 0.53))), 0.0), 26.0) * 0.20;
  // wide bodies (the pool, the waves): one crisp line of light inside the edge, and a soft swell of depth behind it
  float big = smoothstep(120.0, 420.0, df.w);
  float facing = smoothstep(-0.1, 0.8, dot(df.yz, normalize(vec2(-0.55, -0.83))));
  float lk = cap / BEVEL;
  float line = smoothstep(16.0 * lk, 20.0 * lk, -df.x) * (1.0 - smoothstep(27.0 * lk, 32.0 * lk, -df.x));
  col += vec3(1.0, 0.94, 0.96) * line * big * (0.16 + 0.42 * facing) * (cap > BEVEL + 1.0 ? 1.0 : 0.6);
  float inner = smoothstep(60.0 * lk, 96.0 * lk, -df.x) * (1.0 - smoothstep(96.0 * lk, 210.0 * lk, -df.x));
  col += base * inner * 0.22 * big;
  return col;
}

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 SH = vec2(-13.0, -20.0);                                   // toward the light, for cast shadows

  // ---- the ground ----
  vec3 plum = lin(vec3(0.165, 0.045, 0.21));
  vec2 gq = (p - vec2(960.0, 560.0)) / vec2(1300.0, 900.0);
  vec3 ground = plum * (1.12 - 0.62 * dot(gq, gq));
  vec2 hq = (p - vec2(960.0, 620.0)) / vec2(860.0, 430.0);
  ground += lin(vec3(0.72, 0.10, 0.46)) * uGlow * (0.16 + 0.10 * uPulse) * exp(-dot(hq, hq));
  // two ranges of hills, tone on tone: what the columns did a moment ago
  float h2 = uLevel + 30.0 - hills(p.x, uBackB, 60.0 * sin(uSec * 0.4), 560.0);
  ground = mix(ground, ground * 1.5 + lin(vec3(0.30, 0.045, 0.30)) * 0.5, uGlow * smoothstep(-7.0, 7.0, p.y - h2) * (0.55 + 0.45 * smoothstep(0.0, 420.0, p.y - h2)));
  float h1 = uLevel + 30.0 - hills(p.x, uBackA, 0.0, 430.0);
  ground = mix(ground, ground * 1.35 + lin(vec3(0.46, 0.06, 0.40)) * 0.55, uGlow * smoothstep(-5.0, 5.0, p.y - h1) * (0.6 + 0.4 * smoothstep(0.0, 300.0, p.y - h1)));
  vec3 other = lin(texture2D(tOther, vUv).rgb);
  if (uOther > 1.5) ground = other;
  else if (uOther > 0.5 || uFloodOn > 0.5) {
    // above the first wave the old picture is still there
    vec3 old = uOther > 0.5 ? other : lin(vec3(1.0, 0.965, 0.914));
    float mid = uFloodOn > 0.5 ? 0.5 * (floodF(p.x) + floodT(p.x)) : 1e4;
    ground = mix(old, ground, smoothstep(-2.0, 2.0, p.y - mid));
  }

  // ---- main sheet ----
  vec4 d = fieldMain(p);
  float sh = 1.0 - smoothstep(-6.0, 26.0, fieldMain(p + SH).x);
  vec3 col = ground * (1.0 - 0.5 * sh);
  vec3 base = ramp(p.y);
  // in the pool: the light thins with depth and the kick brightens the surface
  float depth = clamp((p.y - uLevel) / 340.0, 0.0, 1.0);
  base *= 1.0 + uPulse * 0.16 * (1.0 - depth) * step(BEVEL * 2.0, d.w);
  vec3 lit = shade(d, base, BEVEL);
  // bubbles on their way up through the pool: a thin bright ring and a glint each
  if (uPoolOn > 0.5 && p.y > uLevel) {
    for (int i = 0; i < 10; i++) {
      vec4 b = uBub[i];
      if (b.w <= 0.0) continue;
      vec2 q = p - b.xy; float l = length(q);
      float ring = smoothstep(b.z + 1.5, b.z, l) * smoothstep(b.z - 4.5, b.z - 1.5, l);
      float fill = smoothstep(b.z, b.z - 2.0, l);
      float glint = smoothstep(b.z * 0.34, 0.0, length(q - vec2(-0.36, -0.40) * b.z));
      lit += (base * 1.6 + 0.08) * b.w * (ring * 0.55 + fill * 0.10) + vec3(1.0, 0.92, 1.0) * glint * b.w * 0.6;
    }
  }
  col = mix(col, lit, clamp(0.5 - d.x, 0.0, 1.0));

  // ---- drops in the air (on the way out they sit on the waves instead, and are drawn after them) ----
  vec4 dd = fieldDrops(p);
  float sd = 1.0 - smoothstep(-5.0, 22.0, fieldDrops(p + SH).x);
  if (uWaveOn < 0.5) {
    col *= 1.0 - 0.36 * sd;
    col = mix(col, shade(dd, ramp(p.y), BEVEL), clamp(0.5 - dd.x, 0.0, 1.0));
  }

  // ---- the result line ----
  if (uTextOn > 0.5) {
    vec4 dt = fieldText(p);
    float st = 1.0 - smoothstep(-4.0, 20.0, fieldText(p + vec2(-9.0, -14.0)).x);
    col *= 1.0 - 0.42 * st;
    vec3 hot = mix(lin(vec3(1.0, 0.60, 0.13)), lin(vec3(1.0, 0.24, 0.42)), smoothstep(uGlyphBox.x + 70.0, uGlyphBox.x + 160.0, p.y));
    vec3 tb = mix(hot, ramp(p.y), smoothstep(uGlyphBox.x + 190.0, uGlyphBox.x + 300.0, p.y));
    col = mix(col, shade(dt, tb, 18.0), clamp(0.5 - dt.x, 0.0, 1.0));
  }

  // ---- the three waves: thicker than anything before them, each casting a long shadow on the one below ----
  if (uWaveOn > 0.5) {
    float yk = smoothstep(60.0, 1020.0, p.y);
    vec2 SW = vec2(-26.0, -34.0);
    vec4 d1 = sdHot(p);
    float s1 = 1.0 - smoothstep(-10.0, 44.0, sdHot(p + SW).x);
    col *= 1.0 - 0.5 * s1 * (uOther > 1.5 ? 0.7 : 1.0);
    col = mix(col, shade(d1, mix(lin(vec3(1.0, 0.52, 0.10)), lin(vec3(1.0, 0.27, 0.22)), yk), WAVE_BEVEL), clamp(0.5 - d1.x, 0.0, 1.0));
    vec4 d2 = sdSheet(p, uFront.y, uTail.y, 11.0);
    float s2 = 1.0 - smoothstep(-10.0, 44.0, sdSheet(p + SW, uFront.y, uTail.y, 11.0).x);
    col *= 1.0 - 0.46 * s2;
    col = mix(col, shade(d2, mix(lin(vec3(1.0, 0.30, 0.56)), lin(vec3(0.94, 0.13, 0.55)), yk), WAVE_BEVEL), clamp(0.5 - d2.x, 0.0, 1.0));
    vec4 d3 = sdSheet(p, uFront.z, uTail.z, 23.0);
    float s3 = 1.0 - smoothstep(-10.0, 44.0, sdSheet(p + SW, uFront.z, uTail.z, 23.0).x);
    col *= 1.0 - 0.46 * s3;
    col = mix(col, shade(d3, mix(lin(vec3(0.58, 0.25, 0.97)), lin(vec3(0.34, 0.13, 0.76)), yk), WAVE_BEVEL), clamp(0.5 - d3.x, 0.0, 1.0));
  }

  // beads that sit on the last wave
  if (uWaveOn > 0.5) {
    col *= 1.0 - 0.42 * sd;
    col = mix(col, shade(dd, mix(lin(vec3(1.0, 0.56, 0.12)), lin(vec3(1.0, 0.28, 0.46)), smoothstep(150.0, 950.0, p.y)), BEVEL), clamp(0.5 - dd.x, 0.0, 1.0));
  }

  // the hit: a white-hot heart where the drop lands
  if (uFlash > 0.0) {
    float l = length((p - uHit) / vec2(1.0, 0.8));
    col += vec3(1.0, 0.88, 0.74) * uFlash * exp(-l * l / (300.0 * 300.0));
  }
  gl_FragColor = vec4(srgb(col) * uWeight, uWeight);
}
`;

/** Shows the accumulated picture, with a little noise so smooth colour never bands. */
export const PRESENT_FRAG = COMMON + /* glsl */`
uniform sampler2D tAcc;
uniform float uSeed;
void main() {
  vec3 c = texture2D(tAcc, vUv).rgb;
  float n = hash21(gl_FragCoord.xy + uSeed) - 0.5;
  gl_FragColor = vec4(c + n * (1.6 / 255.0), 1.0);
}
`;

/**
 * Lettering made of the same stuff. The mask holds flat coloured shapes, blurred: its coverage is a height, its
 * gradient a slope. Out comes a glossy bead of that colour with a soft shadow under it (premultiplied).
 */
export const GLYPH_FRAG = COMMON + /* glsl */`
uniform sampler2D tMask;
uniform vec2 uRes;
void main() {
  vec2 px = 1.0 / uRes;
  vec4 m = texture2D(tMask, vUv);
  float a = m.a;
  float e = 1.5;
  float ax = texture2D(tMask, vUv + vec2(px.x * e, 0.0)).a - texture2D(tMask, vUv - vec2(px.x * e, 0.0)).a;
  float ay = texture2D(tMask, vUv - vec2(0.0, px.y * e)).a - texture2D(tMask, vUv + vec2(0.0, px.y * e)).a;   // y down
  vec3 base = lin(m.rgb);
  float cov = smoothstep(0.40, 0.56, a);
  vec3 n = normalize(vec3(-vec2(ax, ay) * 4.2, 1.0));
  vec3 L = normalize(vec3(-0.50, -0.68, 0.54)), H = normalize(L + vec3(0.0, 0.0, 1.0));
  float nl = dot(n, L), wrap = 0.5 + 0.5 * nl, rim = pow(1.0 - n.z, 2.0);
  vec3 deep = base * mix(vec3(0.62, 0.42, 0.78), vec3(1.0), 0.15);
  vec3 col = mix(deep, base, smoothstep(0.15, 0.75, wrap)) * (0.9 + 0.2 * wrap);
  float ndh = max(dot(n, H), 0.0);
  col += vec3(1.0) * (pow(ndh, 60.0) * 0.9 + pow(ndh, 12.0) * 0.12);
  col += vec3(1.0, 0.7, 0.95) * rim * 0.12;
  // the shadow it casts on the liquid under it
  float as = texture2D(tMask, vUv + vec2(-px.x * 4.0, px.y * 7.0)).a;
  float as2 = texture2D(tMask, vUv + vec2(-px.x * 2.0, px.y * 3.5)).a;
  float sh = (smoothstep(0.12, 0.7, as) * 0.34 + smoothstep(0.2, 0.7, as2) * 0.3) * (1.0 - cov);
  vec3 shc = vec3(0.07, 0.01, 0.16);
  gl_FragColor = vec4(srgb(col) * cov + shc * sh, cov + sh);
}
`;
