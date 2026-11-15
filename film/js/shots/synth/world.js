// The synthwave world: sky with a striped sun, and a neon terrain that rushes at the camera (flat grid road in the
// middle, low-poly wireframe mountains at the sides). Everything is drawn in linear HDR so the bloom makes the glow.

import * as THREE from 'three';

const HASH = /* glsl */`
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }`;

// ---------------------------------------------------------------------------------------------------------------------
// Sky: deep purple to a magenta haze at the horizon, stars, and the sun: three stops down the disc (yellow at the top,
// orange a little past half way, hot pink at the horizon), cut below uStripeTop by bands that widen toward its foot
// and slide downward. The stops are scene values that come out of the film's tone curve near #FFE45C, #FF8A3D, #FF2E88.

const SKY_FRAG = /* glsl */`
uniform float uHorizon, uSunR, uAspect, uTime, uPulse, uStripe, uGain, uStripeTop, uSunGain;
uniform vec2 uSun;
varying vec2 vUv;
${HASH}
void main() {
  float h = vUv.y - uHorizon;
  float k = clamp(h / (1.0 - uHorizon), 0.0, 1.0);
  vec3 top = vec3(0.004, 0.001, 0.022), mid = vec3(0.028, 0.004, 0.095), low = vec3(0.20, 0.012, 0.19);
  vec3 c = mix(low, mid, smoothstep(0.0, 0.22, k));
  c = mix(c, top, smoothstep(0.18, 0.9, k));
  // stars: fewer and fainter toward the haze
  vec2 g = vec2((vUv.x - 0.5) * uAspect, vUv.y) * 40.0;
  vec2 id = floor(g), f = fract(g) - 0.5;
  float rnd = hash21(id);
  vec2 o = (vec2(hash21(id + 3.1), hash21(id + 7.7)) - 0.5) * 0.7;
  float tw = 0.55 + 0.45 * sin(uTime * (1.5 + rnd * 4.0) + rnd * 40.0);
  float d2 = dot(f - o, f - o);
  float star = step(0.80, rnd) * tw * exp(-d2 * (260.0 + 500.0 * hash21(id + 1.7)));
  c += vec3(0.85, 0.9, 1.3) * star * 3.4 * smoothstep(0.06, 0.4, k);
  // the sun
  vec2 d = vec2((vUv.x - uSun.x) * uAspect, vUv.y - uSun.y);
  float r = length(d);
  float sy = d.y / uSunR;
  float disc = smoothstep(uSunR, uSunR - 0.0022, r);
  float s = clamp((1.0 - sy) / 1.55, 0.0, 1.0);          // 0 at the top of the disc, 1 where the horizon cuts it
  vec3 yel = vec3(1.80, 0.740, 0.150), ora = vec3(1.50, 0.160, 0.040), pin = vec3(1.34, 0.028, 0.170);
  vec3 sc = s < 0.55 ? mix(yel, ora, smoothstep(0.0, 1.0, s / 0.55)) : mix(ora, pin, smoothstep(0.0, 1.0, (s - 0.55) / 0.45));
  float sv = uStripeTop - sy;                             // below this line the bands start
  float band = fract(sv * 8.4 + uStripe);
  float gapW = clamp(0.20 + sv * 0.66, 0.0, 0.80);        // the gaps widen toward the foot
  float aa = 0.022;
  float gap = smoothstep(gapW + aa, gapW - aa, band) * smoothstep(1.0, 1.0 - aa * 2.0, band) * step(0.0, sv);
  disc *= 1.0 - gap;
  c += vec3(1.0, 0.16, 0.50) * exp(-max(r - uSunR, 0.0) * 9.0) * 0.26 * (1.0 + 0.6 * uPulse);     // halo
  c = mix(c, sc * uSunGain * (1.0 + 0.45 * uPulse), disc);
  // the haze line itself, and nothing of the sun below the horizon
  float below = smoothstep(0.0, -0.004, h);
  vec3 floorHaze = vec3(0.30, 0.018, 0.25);
  c = mix(c, floorHaze, below);
  c += vec3(1.3, 0.25, 0.95) * exp(-abs(h) * 70.0) * 0.5;
  gl_FragColor = vec4(c * uGain, 1.0);
}`;

export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
    fragmentShader: SKY_FRAG, depthTest: false, depthWrite: false,
    uniforms: {
      uHorizon: { value: 0.39 }, uSun: { value: new THREE.Vector2(0.5, 0.44) }, uSunR: { value: 0.27 }, uAspect: { value: 16 / 9 },
      uTime: { value: 0 }, uPulse: { value: 0 }, uStripe: { value: 0 }, uGain: { value: 1 }, uStripeTop: { value: 0.1 },
      uSunGain: { value: 1 },
    },
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}

// ---------------------------------------------------------------------------------------------------------------------
// Terrain: a lattice of unit cells. Heights come from a hash of each lattice point's own number, and the lattice
// slides toward the camera, so the mountains are faceted and travel with the grid. Lines are drawn in the fragment
// shader at a constant width on screen, with a tight glow around them; the bloom adds the wide one.
//
// The road is glossy: just below the horizon it carries a mirror image of the title (tRefl is the title alone, drawn
// from the same camera; uRefl places it), blurred sideways and fading toward the camera. And under the terminal's two
// rows the whole floor is turned down (uDock), so the lettering has something dark to sit on.

const TERRAIN_VERT = /* glsl */`
uniform float uScroll, uRoad;
varying vec2 vGrid;
varying vec3 vW;
varying float vH;
${HASH}
float height(vec2 id) {
  float ax = abs(id.x);
  float rise = smoothstep(uRoad, uRoad + 11.0, ax);
  float n = hash21(id), n2 = hash21(floor(id / 3.0) + 7.0), n3 = hash21(floor(id / 7.0) + 19.0);
  return rise * (0.2 + 2.6 * n * n + 1.9 * n2 + 2.4 * n3 * smoothstep(9.0, 26.0, ax));
}
void main() {
  float fl = floor(uScroll), fr = uScroll - fl;
  vec2 id = vec2(position.x, position.z - fl);
  float h = height(id);
  vec3 p = vec3(position.x, h, position.z + fr);
  vGrid = position.xz;
  vH = h;
  vW = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const TERRAIN_FRAG = /* glsl */`
uniform float uPulse, uRing, uRingAmt, uRingZ, uLine, uGain, uReflH, uDock, uFar, uHaze;
uniform vec3 uCam;
uniform vec2 uRes;
uniform vec4 uRefl;          // amount; the horizon and the title's lower edge (screen v); title rows per floor row
uniform vec4 uDockBox;       // the dimmed region, in frame pixels from the top left: right edge, its feather, top, its feather
uniform sampler2D tRefl;
varying vec2 vGrid;
varying vec3 vW;
varying float vH;
void main() {
  vec2 fw = max(fwidth(vGrid), vec2(1e-5));
  vec2 a = abs(fract(vGrid - 0.5) - 0.5) / fw;                       // pixels to the nearest lattice line
  float d = min(a.x, a.y);
  float gd = vGrid.x + vGrid.y;
  float dd = abs(fract(gd - 0.5) - 0.5) / max(fwidth(gd), 1e-5);     // and to the facet's diagonal
  float mount = smoothstep(0.03, 0.5, vH);
  float dense = 1.0 - smoothstep(0.22, 0.6, max(fw.x, fw.y));         // far away the cells are smaller than the lines
  float core = (1.0 - smoothstep(uLine, uLine + 1.3, d)) * dense;
  float halo = exp(-d * 0.55) * 0.34 * dense;
  float dcore = (1.0 - smoothstep(uLine * 0.6, uLine * 0.6 + 1.2, dd)) * mount * 0.5 * dense;
  float dist = length(vW.xz - uCam.xz);
  vec3 magenta = vec3(1.0, 0.045, 0.72), cyan = vec3(0.04, 0.80, 1.0);
  vec3 lc = mix(magenta, cyan, mount);
  float line = max(core, dcore) + halo;
  vec3 base = mix(vec3(0.016, 0.0, 0.040), vec3(0.006, 0.003, 0.030), mount);
  base += vec3(0.02, 0.01, 0.07) * vH * 0.25;                                              // a little body on the slopes
  base += vec3(1.0, 0.22, 0.42) * exp(-abs(vW.x) * 0.42) * 0.05 * (1.0 - mount) * exp(-dist * 0.03);   // the sun on the road
  vec3 c = base + lc * line * (mix(1.75, 1.15, mount) + 1.5 * uPulse) + lc * uFar * (1.0 - dense);
  // the shock ring that runs out over the ground when the title lands
  float rr = length(vW.xz - vec2(0.0, uRingZ));
  float rd = rr - uRing;
  float ring = exp(-rd * rd * 0.55) * uRingAmt;
  c += vec3(0.75, 0.95, 1.0) * ring * (0.05 + line * 3.0);
  float fog = exp(-max(dist - 14.0, 0.0) * 0.034);
  vec3 haze = vec3(0.30, 0.018, 0.25) * uHaze;
  vec3 col = mix(haze, c, fog) * uGain;

  // the title in the glossy road
  vec2 suv = gl_FragCoord.xy / uRes;
  float dy = uRefl.y - suv.y;
  if (uRefl.x > 0.0 && dy > 0.0 && dy < uReflH) {
    float f = dy / uReflH;
    float ry = uRefl.z + dy * uRefl.w;
    float spread = (0.5 + 1.6 * f) / uRes.x;
    vec3 r = vec3(0.0); float ws = 0.0;
    for (int i = -4; i <= 4; i++) {
      float w = exp(-float(i * i) / 7.0);
      r += texture2D(tRefl, vec2(suv.x + float(i) * spread, ry)).rgb * w; ws += w;
    }
    r = min(r / ws, vec3(1.0));                        // the chrome's hot spots would read as smudges
    float cover = clamp(max(r.r, max(r.g, r.b)) * 1.6, 0.0, 1.0);
    float k = uRefl.x * (1.0 - f * f) * smoothstep(1.0, 0.86, f) * (1.0 - smoothstep(0.35, 1.5, vH));   // the low verge is wet too
    // the mirror takes the place of the haze where the title is, so its colours are its own
    col = mix(col, col * 0.55, cover * min(1.0, k * 2.2)) + r * k;
  }

  // under the terminal's rows
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float dk = (1.0 - smoothstep(uDockBox.x, uDockBox.x + uDockBox.y, px.x)) * smoothstep(uDockBox.z - uDockBox.w, uDockBox.z, px.y);
  col = mix(col, col * 0.2 + vec3(0.0012, 0.0, 0.004), dk * uDock);
  gl_FragColor = vec4(col, 1.0);
}`;

export function makeTerrain(W = 1920, H = 1080) {
  const NX = 46, Z0 = -110, Z1 = 6;
  const nx = NX * 2 + 1, nz = Z1 - Z0 + 1;
  const pos = new Float32Array(nx * nz * 3);
  let k = 0;
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) { pos[k++] = ix - NX; pos[k++] = 0; pos[k++] = Z0 + iz; }
  const idx = [];
  for (let iz = 0; iz < nz - 1; iz++) {
    for (let ix = 0; ix < nx - 1; ix++) {
      const a = ix + nx * iz, b = a + 1, c = a + nx, d = c + 1;
      idx.push(a, c, b, b, c, d);            // the shared edge b-c runs along x + z = constant
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG, side: THREE.DoubleSide,
    uniforms: {
      uScroll: { value: 0 }, uPulse: { value: 0 }, uRing: { value: 0 }, uRingAmt: { value: 0 }, uRingZ: { value: -6 },
      uLine: { value: 0.75 }, uGain: { value: 1 }, uCam: { value: new THREE.Vector3() }, uRoad: { value: 6.5 }, uFar: { value: 0.045 }, uHaze: { value: 0.8 },
      uRes: { value: new THREE.Vector2(W, H) }, tRefl: { value: null }, uRefl: { value: new THREE.Vector4(0, 0.39, 0.6, 1.4) },
      uReflH: { value: 124 / H }, uDock: { value: 1 }, uDockBox: { value: new THREE.Vector4(1180, 520, 800, 90) },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------------------------------------------------------------
// The hand-over: the picture before this shot, put on the tape. It stays whole and readable: the tape only leans its
// top over (uSkew, as a deck does while the tension settles) and then loses vertical hold once. The old picture is
// written over the upper part of the frame (above uSplit) so the roll can carry it down and out while this shot's
// picture comes in from the top; the top and bottom edges are the black bar between two pictures.

export const HAND_FRAG = /* glsl */`
uniform sampler2D tOld;
uniform float uSplit, uHasOld, uBar, uFrame, uSkew;
varying vec2 vUv;
${HASH}
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
// the inverse of the film's tone curve, so the old picture comes out of the chain close to how it went in
vec3 untone(vec3 y) {
  y = clamp(y, 0.0, 0.88);
  vec3 a = 2.43 * y - 2.51, b = 0.59 * y - 0.03, c = 0.14 * y;
  return (-b - sqrt(max(b * b - 4.0 * a * c, 0.0))) / (2.0 * a);
}
void main() {
  float edge = min(vUv.y, 1.0 - vUv.y);
  if (edge < uBar) {
    // the bar: black, with the short white dashes of the head switching
    float n = hash21(vec2(floor(vUv.x * 150.0 + uFrame * 7.0), floor(vUv.y * 486.0) + uFrame * 13.0));
    gl_FragColor = vec4(vec3(step(0.93, n)) * 0.5 * smoothstep(0.0, uBar * 0.5, edge), 1.0);
    return;
  }
  if (uHasOld > 0.5 && vUv.y >= uSplit) {
    vec2 uv = vUv;
    float top = smoothstep(0.78, 1.0, uv.y);
    uv.x += uSkew * top * top;
    vec3 c = texture2D(tOld, uv).rgb * step(0.0, uv.x) * step(uv.x, 1.0);
    gl_FragColor = vec4(untone(toLinear(c)), 1.0);
    return;
  }
  gl_FragColor = vec4(0.0);
}`;
