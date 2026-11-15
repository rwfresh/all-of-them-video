// The pastel studio of the 3D Render shot: a cloner field of glossy pills on concentric rings, a puffy play button that
// drops into it, soft lights, and a lens.
//
// Everything is three.js on the film's shared renderer. A frame is drawn K times and averaged; on each pass the lens
// position (depth of field), the key light and a dome light (soft shadows, ambient shading), the sub-pixel offset
// (antialiasing) and the moment inside the open shutter (motion blur) all move a little, on a fixed pattern.
// Depth rides in the alpha channel, so a last pass can fill the gaps between the lens positions: smooth blur from few
// passes. (The lens and light patterns follow the storybook film's rig.)
//
// Every pill is one instanced shape: a ball whose eight octants are pulled apart into a rounded box (aBox: half sizes
// and corner radius) and then scaled (aScl). So a flat paper scrap, a puffed pillow and a standing pill are the same
// object at different numbers, and squash and stretch keep true normals.

import * as THREE from 'three';
import { Pass } from '../../post.js';
import { clamp, lerp, seg, smooth, ease, spring, rng, hash } from '../../util.js';

const GA = 2.399963229728653;
const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
const DEG = Math.PI / 180;

// ---- the timeline, in local beats ------------------------------------------------------------------------------------
export const TL = {
  WAVE_V: 13,      // the inflating wave leaves the centre on beat 0 at this many units a beat
  DROP0: 1.5,        // the play button enters above the frame
  DROP: 2.0,         // and lands
  CREST_V: 9.6,      // the wave it sends through the field: units a second (about 900 px)
  CREST_W: 1.6,      // and how wide its crest is
  SHEEN: 4.0,        // the polish: the softboxes sweep over everything, a second, gentler ring
  CAM_END: 6.6,      // the camera's long tail is done
};

// ---- the set, in units (a pill is 1.1 wide and 2 tall, the cursor's proportions) ---------------------------------------
export const FOV = 24;
const D0 = 30, D1 = 26.5;                          // camera distance: straight above at the start, the hero frame
const EL1 = 43 * DEG;
export const PX0 = 540 / (D0 * Math.tan((FOV / 2) * DEG));   // pixels a unit when looking straight down: the old picture lies 1:1 on the floor
const T0 = new THREE.Vector3(0, 0, 1.65), T1 = new THREE.Vector3(0.15, 0.1, 1.0);
const RING = 1.7, PILL_R = 0.5, PILL_H = 0.9;      // ring pitch; pill radius and half height
export const PEARL_R = 0.3;
const HERO = { R: 4.0, T: 1.2, Tb: 0.75, e: 0.92 };                       // the button: a round cushion
const TRI = { R: 2.2, rc: 0.55, T: 0.6, Tb: 0.34, x: 0.26 };      // and the triangle that sits on it

export const PAL = {
  floorA: '#f6c6cd', floorB: '#e296ae', lip: '#fff3ea',
  pink: '#ffa3c4', peach: '#ffc9aa', cream: '#fff4e4', lilac: '#cdbcff',
  hot: '#ff4a80', hero: '#ff3d74', tri: '#fff6ea', chrome: '#ffd2c4',
};

/** Frame pixels (when the camera looks straight down, at beat 0) to floor units, and back. */
export const toWorld = (px, py) => [(px - 960) / PX0 + T0.x, (py - 540) / PX0 + T0.z];

// ---- shapes ----------------------------------------------------------------------------------------------------------

/** A unit ball made from a cube's grid, so it has vertices exactly on the three axis planes (the rounded box needs them). */
function ballGeometry(seg2) {
  const g = new THREE.BoxGeometry(2, 2, 2, seg2, seg2, seg2);
  const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    for (const k of ['x', 'y', 'z']) if (Math.abs(v[k]) < 1e-6) v[k] = 0;
    v.normalize();
    p.setXYZ(i, v.x, v.y, v.z); n.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('uv');
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);
  return g;
}

/** How far the rounded triangle's edge is from its centre in direction phi (it points along +x). */
function triRadius(phi, R, rc) {
  const TAU = Math.PI * 2;
  const inr = R / 2, Ri = R - 2 * rc;
  let best = Infinity;
  for (const na of [60 * DEG, 180 * DEG, 300 * DEG]) {
    let d = phi - na; d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) >= Math.PI / 2 - 1e-3) continue;
    const de = inr / Math.cos(d);
    if (de < best) {
      const tang = de * Math.sin(d);
      if (Math.abs(tang) <= Ri * 0.8660254) best = de;
      else {
        // past the straight part: the corner's arc
        const va = na + Math.sign(d) * 60 * DEG;
        let dv = phi - va; dv = Math.atan2(Math.sin(dv), Math.cos(dv));
        const s = Ri * Math.sin(dv), q = rc * rc - s * s;
        best = Math.min(best, q > 0 ? Ri * Math.cos(dv) + Math.sqrt(q) : de);
      }
    }
  }
  return best === Infinity ? R : best;
}

/** Distance from p to the inside edge of the rounded triangle (positive inside): smooth out to the corner radius. */
function triInside(x, z, R, rc) {
  const Ri = R - 2 * rc;
  const V = [0, 120, 240].map((a) => [Ri * Math.cos(a * DEG), Ri * Math.sin(a * DEG)]);
  let inside = true, best = Infinity;
  for (let i = 0; i < 3; i++) {
    const [ax, az] = V[i], [bx, bz] = V[(i + 1) % 3];
    const ex = bx - ax, ez = bz - az, px = x - ax, pz = z - az;
    const t = clamp((px * ex + pz * ez) / (ex * ex + ez * ez));
    best = Math.min(best, Math.hypot(px - ex * t, pz - ez * t));
    if (ex * pz - ez * px < 0) inside = false;
  }
  return rc + (inside ? best : -best);
}

/**
 * An inflated cushion standing on y = 0. radius(phi) is its outline; top(x, z, t) and bot(x, z, t) give the height of
 * its upper and lower skin (t: 0 at the centre, 1 on the outline, where both must meet).
 */
function cushion(radius, top, bot, M = 192, N = 56) {
  const pos = new Float32Array((M + 1) * (N + 1) * 3), idx = [];
  const D = Array.from({ length: M + 1 }, (_, i) => radius((i / M) * Math.PI * 2));
  let k = 0;
  for (let j = 0; j <= N; j++) {
    const v = j / N, up = v >= 0.5;
    const t = Math.sin((up ? 2 - 2 * v : 2 * v) * Math.PI / 2);          // rows crowd toward the outline, where the skin turns
    for (let i = 0; i <= M; i++) {
      const phi = (i / M) * Math.PI * 2, x = D[i] * t * Math.cos(phi), z = D[i] * t * Math.sin(phi);
      pos[k++] = x; pos[k++] = up ? top(x, z, t) : bot(x, z, t); pos[k++] = z;
    }
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < M; i++) {
    const a = j * (M + 1) + i, b = a + 1, c2 = a + M + 1, d = c2 + 1;
    idx.push(a, c2, b, b, c2, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the seam (first and last column are the same points) and the two poles need their normals joined by hand
  const n = g.attributes.normal;
  for (let j = 0; j <= N; j++) {
    const a = j * (M + 1), b = a + M;
    const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
  }
  for (let i = 0; i <= M; i++) { n.setXYZ(i, 0, -1, 0); n.setXYZ(N * (M + 1) + i, 0, 1, 0); }
  return g;
}

/** The button: a round cushion with a domed top. */
function discGeometry({ R, T, Tb, e }) {
  const prof = (t, n) => Math.pow(Math.max(0, 1 - Math.pow(t, 2 / n)), n / 2);
  return cushion(() => R, (x, z, t) => Tb + T * prof(t, e), (x, z, t) => Tb - Tb * prof(t, 0.5));
}

/** The triangle: its edge rolls over on a quarter circle and its top swells gently toward the middle, with no ridges. */
function triGeometry({ R, rc, T, Tb }) {
  const inr = R / 2, roll = rc * 0.96;
  const N3 = [60, 180, 300].map((a) => [Math.cos(a * DEG), Math.sin(a * DEG)]);
  const edge = (x, z) => { const s2 = clamp(triInside(x, z, R, rc) / roll); return Math.sqrt(Math.max(0, 1 - (1 - s2) * (1 - s2))); };
  const dome = (x, z) => { let p = 1; for (const [nx, nz] of N3) p *= Math.max(0, inr - (x * nx + z * nz)) / inr; return Math.pow(p, 0.4); };
  return cushion((phi) => triRadius(phi, R, rc), (x, z) => Tb + T * edge(x, z) * (0.66 + 0.34 * dome(x, z)), (x, z) => Tb - Tb * edge(x, z));
}

// ---- materials ---------------------------------------------------------------------------------------------------------

const SOFT_VERT_PARS = /* glsl */`
attribute vec4 aBox;
attribute vec3 aScl;
`;
const SOFT_NORMAL = /* glsl */`
vec3 sN = normalize(position);
vec3 objectNormal = normalize(sN / aScl);
`;
const SOFT_BEGIN = /* glsl */`
vec3 sD = normalize(position);
vec3 sS = sign(sD) * step(vec3(1e-4), abs(sD));
float sR = min(aBox.w, min(aBox.x, min(aBox.y, aBox.z)));
vec3 transformed = (sD * sR + sS * (aBox.xyz - sR)) * aScl;
`;

const FRAG_PARS = /* glsl */`
uniform float uIblDiffuse;
uniform vec3 uKeyView;
uniform vec3 uSss;
`;
// light that goes into the candy and comes out again: it bleeds past the shadow line, glows where the body is thin
// (the rim) and where the key light shines through from behind
const SSS = /* glsl */`
{
  vec3 sV = normalize(vViewPosition);
  float sN = clamp(dot(normal, sV), 0.0, 1.0);
  float sF = pow(1.0 - sN, 2.4) * smoothstep(0.0, 0.12, sN);            // a band just inside the silhouette
  float sW = clamp((dot(normal, uKeyView) + 0.75) / 1.75, 0.0, 1.0);
  float sB = pow(clamp(dot(sV, -normalize(uKeyView + normal * 0.45)), 0.0, 1.0), 2.5);
  vec3 sC = pow(diffuseColor.rgb, vec3(1.7)) * 1.25 + vec3(0.05, 0.0, 0.0);
  // light that has been through the body comes out warmer
  vec3 sT = mix(sC, vec3(1.0, 0.6, 0.46) * (0.35 + 0.9 * dot(diffuseColor.rgb, vec3(0.333))), 0.5);
  totalEmissiveRadiance += sC * (uSss.x * sW * sW) + sT * (uSss.y * sF + uSss.z * sB);
}
`;

// a soft dark pool where each pill meets the floor
const CONTACT_VERT = /* glsl */`
attribute float aFade;
varying vec2 vUv; varying float vFade;
void main() { vUv = uv; vFade = aFade; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`;
const CONTACT_FRAG = /* glsl */`
uniform vec3 uCol; uniform float uAmt;
varying vec2 vUv; varying float vFade;
void main() { vec2 q = vUv * 2.0 - 1.0; float a = pow(max(0.0, 1.0 - dot(q, q)), 1.5); gl_FragColor = vec4(uCol, a * vFade * uAmt); }`;

const FLOOR_VERT_PARS = /* glsl */`
varying vec3 vFloor;
`;
const FLOOR_FRAG_PARS = /* glsl */`
varying vec3 vFloor;
uniform sampler2D uSheet;
uniform vec4 uSheetRect;      // the old picture on the floor: x0, z0, 1/width, 1/depth
uniform vec3 uWave;           // centre x, z and radius of the inflating wave
uniform vec3 uFloorA, uFloorB, uLip;
uniform float uSheetOn, uLit, uRef, uLipAmt;
uniform vec2 uRing;           // the travelling crest: its radius and how bright its glint on the floor is
float floorHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`;
const FLOOR_MAP = /* glsl */`
{
  float fd = length(vFloor.xz - vec2(0.0, 0.6));
  diffuseColor.rgb = mix(uFloorA, uFloorB, smoothstep(5.0, 30.0, fd));
}
`;
const FLOOR_END = /* glsl */`
{
  float fw = length(vFloor.xz - uWave.xy);
  float passed = 1.0 - smoothstep(uWave.z - 0.22, uWave.z, fw);
  vec2 suv = (vFloor.xz - uSheetRect.xy) * uSheetRect.zw;
  vec2 se = smoothstep(vec2(0.0), vec2(0.0015), suv) * (1.0 - smoothstep(vec2(1.0 - 0.0015), vec2(1.0), suv));
  float sheet = se.x * se.y * (1.0 - passed) * uSheetOn;
  if (sheet > 0.0) {
    vec3 print = texture2D(uSheet, vec2(suv.x, 1.0 - suv.y)).rgb;
    float pm = min(print.r, min(print.g, print.b));
    print += (pm < 0.04 ? sqrt(pm / 6.25) : pm + 0.04) - pm;                         // the tone curve takes exactly this off again
    float lum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    float shade = mix(1.0, clamp(lum / uRef, 0.25, 1.12), uLit);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, print * shade, sheet);
  }
  // the wave's lip: a soft bright ring that everything inflates behind
  float lip = exp(-pow((fw - uWave.z + 0.12) / 0.24, 2.0)) * uLipAmt;
  gl_FragColor.rgb += uLip * lip;
  gl_FragColor.rgb += uLip * exp(-pow((length(vFloor.xz) - uRing.x) / 0.6, 2.0)) * uRing.y;
}
`;

function patch(mat, U, o = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    if (o.soft) {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + SOFT_VERT_PARS)
        .replace('#include <beginnormal_vertex>', SOFT_NORMAL)
        .replace('#include <begin_vertex>', SOFT_BEGIN);
    }
    if (o.floor) {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + FLOOR_VERT_PARS)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFloor = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    }
    if (!sh.fragmentShader) return;                 // the depth material has only the vertex part to change
    let f = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS + (o.floor ? FLOOR_FRAG_PARS : ''))
      .replace('#include <lights_fragment_maps>', THREE.ShaderChunk.lights_fragment_maps.replace(
        'iblIrradiance += getIBLIrradiance( geometryNormal );', 'iblIrradiance += getIBLIrradiance( geometryNormal ) * uIblDiffuse;'))
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directSpecular *= 0.0;\n#ifdef USE_CLEARCOAT\nclearcoatSpecularDirect *= 0.0;\n#endif')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + (o.floor ? FLOOR_END : '') + '\ngl_FragColor.a = vViewPosition.z;');
    if (o.sss) f = f.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + SSS);
    if (o.floor) f = f.replace('#include <map_fragment>', FLOOR_MAP);
    sh.fragmentShader = f;
  };
  mat.customProgramCacheKey = () => 'soft|' + (o.soft ? 's' : '') + (o.sss ? 'g' : '') + (o.floor ? 'f' : '');
  return mat;
}

// ---- the lights the glossy things reflect -----------------------------------------------------------------------------

function makeEnvironment(R) {
  const s = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(60, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`varying vec3 vP; void main() {
      float y = normalize(vP).y;
      vec3 top = vec3(0.92, 0.84, 0.90) * 0.62, mid = vec3(1.0, 0.80, 0.84) * 0.5, low = vec3(1.0, 0.62, 0.70) * 0.42;
      vec3 c = y > 0.0 ? mix(mid, top, smoothstep(0.0, 0.8, y)) : mix(mid, low, smoothstep(0.0, -0.5, y));
      gl_FragColor = vec4(c, 1.0); }`,
  }));
  s.add(dome);
  const panel = (dir, dist, w, h, rgb, gain, roll = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({
      side: THREE.DoubleSide, uniforms: { uC: { value: new THREE.Vector3(rgb[0] * gain, rgb[1] * gain, rgb[2] * gain) } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      // a softbox: bright and even, falling off softly toward its edge
      fragmentShader: 'uniform vec3 uC; varying vec2 vUv; void main() { vec2 q = abs(vUv * 2.0 - 1.0); float e = smoothstep(1.0, 0.86, max(q.x, q.y)); gl_FragColor = vec4(uC * (0.2 + 0.8 * e) * mix(0.45, 1.0, vUv.x) * step(max(q.x, q.y), 1.0), 1.0); }',
    }));
    m.position.copy(new THREE.Vector3(...dir).normalize().multiplyScalar(dist));
    m.lookAt(0, 0, 0);
    m.rotateZ(roll);
    s.add(m);
  };
  panel([-0.15, 1, -0.8], 30, 22, 9, [1.0, 0.97, 0.94], 36);            // the top-back softbox: what flat tops mirror
  panel([-0.95, 0.7, 0.1], 30, 10, 14, [1.0, 0.95, 0.92], 24, 0.2);      // key, from the left
  panel([0.95, 0.35, -0.3], 30, 2.2, 20, [0.92, 0.9, 1.0], 30);          // a strip on the right: the long thin streak
  panel([0.1, 0.35, 1], 30, 30, 10, [1.0, 0.9, 0.86], 2.2);              // a wide, weak fill from the camera side
  const pm = new THREE.PMREMGenerator(R);
  const rt = pm.fromScene(s, 0.012, 0.1, 200);
  pm.dispose();
  return rt.texture;
}

// ---- last passes -------------------------------------------------------------------------------------------------------

const ADD = /* glsl */`
uniform sampler2D tSrc; uniform float uWeight;
varying vec2 vUv;
void main() { vec4 c = texture2D(tSrc, vUv); gl_FragColor = vec4(min(c.rgb, vec3(3.5)), c.a) * uWeight; }`;

// Each pass saw the scene through one point of the lens, so a blurred thing is K sharp copies. This spreads every
// pixel over the gap between copies (a part of its blur circle), taking from a neighbour only as far as that
// neighbour's own blur reaches, so sharp things stay sharp beside soft ones.
const FILL = /* glsl */`
uniform sampler2D tAcc; uniform vec2 uTexel; uniform float uFocus, uCocK, uFill, uGather;
varying vec2 vUv;
float reach(float z) { return uFill * uCocK * abs(1.0 - uFocus / max(z, 0.1)); }
void main() {
  vec4 c0 = texture2D(tAcc, vUv);
  vec3 sum = c0.rgb; float wsum = 1.0;
  if (uGather > 0.5) {
    float rot = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    for (int i = 0; i < 40; i++) {
      float fi = float(i) + 0.5;
      float rr = sqrt(fi / 40.0) * uGather;
      float a = fi * 2.399963 + rot;
      vec4 c = texture2D(tAcc, vUv + vec2(cos(a), sin(a)) * rr * uTexel);
      float w = smoothstep(-0.6, 0.6, min(reach(c.a), uGather) - rr);
      sum += c.rgb * w; wsum += w;
    }
  }
  gl_FragColor = vec4(sum / wsum, 1.0);
}`;

// =======================================================================================================================

export function makeStudio(ctx, post, opt = {}) {
  const { W, H, useGL } = ctx;
  const R = useGL();
  const scene = new THREE.Scene();
  scene.environment = makeEnvironment(R);
  scene.environmentIntensity = 1;
  scene.fog = new THREE.Fog('#fbe2e4', 31, 56);
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 2, 140);

  // uniforms every patched material shares
  const U = {
    uIblDiffuse: { value: 0.15 }, uKeyView: { value: new THREE.Vector3(0, 1, 0) }, uSss: { value: new THREE.Vector3(0.4, 0.72, 0.95) },
    uSheet: { value: null }, uSheetRect: { value: new THREE.Vector4(-960 / PX0 + T0.x, -540 / PX0 + T0.z, PX0 / 1920, PX0 / 1080) },
    uWave: { value: new THREE.Vector3(0, 0, 0) }, uSheetOn: { value: 0 }, uLit: { value: 1 }, uRef: { value: 0.62 }, uLipAmt: { value: 0 }, uRing: { value: new THREE.Vector2(0, 0) },
    uFloorA: { value: new THREE.Color(PAL.floorA) }, uFloorB: { value: new THREE.Color(PAL.floorB) }, uLip: { value: new THREE.Color(PAL.lip) },
  };

  // ---- lights: a big soft key from the camera's left, a dome for ambient shading; the candy glows from a light behind ----
  const keyDir = new THREE.Vector3(-0.6, 1, 0.42).normalize();
  const backDir = new THREE.Vector3(-0.45, 0.55, -0.7).normalize();
  const key = new THREE.DirectionalLight('#fff3ea', 2.9);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02; key.shadow.radius = 6;
  const dome = new THREE.DirectionalLight('#ffeef0', 1.9);
  dome.castShadow = true;
  dome.shadow.mapSize.set(2048, 2048);
  dome.shadow.bias = -0.001; dome.shadow.normalBias = 0.03; dome.shadow.radius = 10;
  for (const [l, half] of [[key, 23], [dome, 24]]) {
    const c = l.shadow.camera;
    c.left = -half; c.right = half; c.top = half; c.bottom = -half; c.near = 1; c.far = 120;
    c.updateProjectionMatrix();
    scene.add(l, l.target);
  }
  const domeAxis = new THREE.Vector3(0.05, 1, 0.3).normalize();
  const hemi = new THREE.HemisphereLight('#fff6f2', '#ffb3c6', 0.32);
  scene.add(hemi);
  const lightAim = new THREE.Vector3(0, 0, -1.5);

  // ---- the floor: one big sheet of the sweep (the camera always looks down on it) ----
  const floorMat = patch(new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.62, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.55 }), U, { floor: true });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---- the cloner field ----
  const ball = ballGeometry(12);
  const gummy = patch(new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0, clearcoat: 0.85, clearcoatRoughness: 0.14, ior: 1.45 }), U, { soft: true, sss: true });
  const plastic = patch(new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.24, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, ior: 1.5 }), U, { soft: true, sss: true });
  const chrome = patch(new THREE.MeshPhysicalMaterial({ color: PAL.chrome, roughness: 0.15, metalness: 1 }), U, { soft: true });
  const softDepth = patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), U, { soft: true });

  const col = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
  const C = { pink: col(PAL.pink), peach: col(PAL.peach), cream: col(PAL.cream), lilac: col(PAL.lilac), hot: col(PAL.hot), white: [1, 1, 1] };
  const ringLook = (k) => (k <= 4 ? ['plastic', 'cream'] : k <= 6 ? ['gummy', 'peach'] : k <= 8 ? ['gummy', 'pink'] : ['plastic', 'lilac']);

  // slots: the centre pill (the cursor), then rings; small chrome pearls on two rings between
  const rnd = rng(1313);
  const slots = [];
  const visible = (x, z) => Math.abs(x) < 19.5 && z > -15.5 && z < 12.5 && Math.hypot(x, z) < 21.5;
  slots.push({ kind: 'pill', mat: 'gummy', colour: C.hot, rho: 0, phi: 0, x: 0, z: 0, jit: 0, cursor: true });
  for (let k = 1; k <= 13; k++) {
    const rho = k * RING, n = Math.round((2 * Math.PI * rho) / (RING * 1.02)), phi0 = k * 0.618 * 2.1;
    const [mat, cn] = ringLook(k);
    for (let i = 0; i < n; i++) {
      const phi = phi0 + (i / n) * Math.PI * 2, x = rho * Math.cos(phi), z = rho * Math.sin(phi);
      if (visible(x, z)) slots.push({ kind: 'pill', mat, colour: C[cn], rho, phi, x, z, jit: rnd() });
    }
  }
  for (const k of [4.5]) {
    const rho = k * RING, n = Math.round((2 * Math.PI * rho) / (RING * 1.02));
    for (let i = 0; i < n; i++) {
      const phi = 0.4 + k + (i / n) * Math.PI * 2, x = rho * Math.cos(phi), z = rho * Math.sin(phi);
      if (visible(x, z)) slots.push({ kind: 'pearl', mat: 'chrome', colour: C.white, rho, phi, x, z, jit: rnd() });
    }
  }
  // how the play button's edge relates to each slot: d < 0 is under it
  for (const s of slots) s.d = s.rho - HERO.R;

  const groups = {};
  for (const [name, mat] of [['gummy', gummy], ['plastic', plastic], ['chrome', chrome]]) {
    const list = slots.filter((s) => s.mat === name);
    const geo = ball.clone();
    const box = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 4), 4);
    const scl = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
    box.setUsage(THREE.DynamicDrawUsage); scl.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aBox', box); geo.setAttribute('aScl', scl);
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    mesh.customDepthMaterial = softDepth;
    list.forEach((s, i) => { s.i = i; mesh.setColorAt(i, new THREE.Color().setRGB(...s.colour)); });
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    groups[name] = { mesh, list, box, scl };
  }

  // ---- where each pill stands: a soft pool of shade ----
  const pills = slots.filter((s) => s.kind === 'pill');
  const cgeo = new THREE.PlaneGeometry(1, 1);
  cgeo.rotateX(-Math.PI / 2);
  const cfade = new THREE.InstancedBufferAttribute(new Float32Array(pills.length), 1);
  cfade.setUsage(THREE.DynamicDrawUsage);
  cgeo.setAttribute('aFade', cfade);
  const contacts = new THREE.InstancedMesh(cgeo, new THREE.ShaderMaterial({
    vertexShader: CONTACT_VERT, fragmentShader: CONTACT_FRAG, uniforms: { uCol: { value: new THREE.Color('#6f2346') }, uAmt: { value: 0.6 } },
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,          // alpha carries depth: leave it alone
  }), pills.length);
  contacts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  contacts.frustumCulled = false;
  pills.forEach((s, i) => { s.ci = i; });
  scene.add(contacts);
  const cm = new THREE.Matrix4();

  // ---- the play button ----
  const heroMat = patch(new THREE.MeshPhysicalMaterial({ color: PAL.hero, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.07, ior: 1.5 }), U, { sss: true });
  const triMat = patch(new THREE.MeshPhysicalMaterial({ color: PAL.tri, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, ior: 1.5 }), U, {});
  const hero = new THREE.Group();
  const disc = new THREE.Mesh(discGeometry(HERO), heroMat);
  const tri = new THREE.Mesh(triGeometry(TRI), triMat);
  for (const m of [disc, tri]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; hero.add(m); }
  const TRI_Y = HERO.Tb + HERO.T - 0.36;
  tri.position.set(TRI.x, TRI_Y, 0);
  scene.add(hero);

  // ---- targets and passes ----
  const hf = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const sceneRT = new THREE.WebGLRenderTarget(W, H, { ...hf, depthBuffer: true, samples: 0 });
  const accRT = new THREE.WebGLRenderTarget(W, H, { ...hf, depthBuffer: false });
  const pAdd = new Pass(ADD, { tSrc: { value: sceneRT.texture }, uWeight: { value: 1 } },
    { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor });
  const pFill = new Pass(FILL, { tAcc: { value: accRT.texture }, uTexel: { value: new THREE.Vector2(1 / W, 1 / H) }, uFocus: { value: 30 }, uCocK: { value: 0 }, uFill: { value: 0.3 }, uGather: { value: 0 } });

  // ---- the old picture's paper pieces: each one is given a slot to become ----
  let pieces = [];
  function setPieces(list) {
    for (const s of slots) s.piece = null;
    pieces = [];
    const free = slots.filter((s) => s.kind === 'pill' && !s.cursor && s.d > 1.0 && s.rho < 13);
    for (const p of list || []) {
      const [x, z] = toWorld(p.x, p.y);
      let best = null, bd = Infinity;
      for (const s of free) { if (s.piece) continue; const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } }
      if (!best) continue;
      const hw = Math.max(0.3, (p.w / 2) / PX0), hd = Math.max(0.3, (p.h / 2) / PX0);
      best.piece = { x, z, hw, hd, rot: p.rot || 0, colour: col(p.color || '#e8e0d0'), born: Math.hypot(x, z) / TL.WAVE_V };
      pieces.push(best);
    }
    // which other slots lie under a scrap
    for (const s of slots) {
      s.under = null;
      if (s.piece) continue;
      for (const q of pieces) {
        const p = q.piece, c = Math.cos(p.rot), n = Math.sin(p.rot), dx = s.x - p.x, dz = s.z - p.z;
        if (Math.abs(dx * c + dz * n) < p.hw + 0.7 && Math.abs(-dx * n + dz * c) < p.hd + 0.7) { s.under = p; break; }
      }
    }
  }

  // ---- what everything is doing at beat b ----
  const dummy = new THREE.Object3D(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), ax = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const tmpC = new THREE.Color(), tmpM = new THREE.Matrix4();
  const st = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), up: new THREE.Vector3(), focus: 30, aperture: 0, el: 0, dist: D0 };

  /**
   * A wave sent out from the button's edge at beat t0: one travelling crest. It lifts each pill as it passes, stretches
   * it a little, leans it away, and dies as it goes. out: { y, s, lean }.
   */
  function crest(b, spb, t0, rho, amp, out) {
    const tau = (b - t0) * spb;
    if (tau <= 0 || tau > 2.4) return;
    const d = rho - (HERO.R - 0.8 + TL.CREST_V * tau);
    if (d > 4.5 || d < -4.5) return;
    const a = amp * Math.exp(-tau / 0.62) * Math.exp(-(d * d) / (TL.CREST_W * TL.CREST_W));
    out.y += a; out.s += 0.2 * a; out.lean += a * d * 0.55;
  }
  /** How big the wave of beat n is: the landing's is the big one, the one three beats later the second, the rest small. */
  const crestAmp = (n) => (n === TL.DROP ? 0.8 : n === TL.DROP + 3 ? 0.42 : n === TL.SHEEN ? 0.26 : 0.17);

  /** After it has landed the button is pressed on every beat, a little less each time; the polish beat is the firm one. */
  const pressAmp = (n) => (n === TL.SHEEN ? 0.13 : Math.max(0.05, 0.11 - 0.015 * (n - TL.DROP - 1)));

  const hop = { y: 0, s: 0, lean: 0 };
  const END = opt.end ?? 8;                             // the shot's length: after it, everything lets go
  function pose(b, spb) {
    // ---- camera: straight down at beat 0, four fifths of the way to the hero frame a fifth of the way in, a slow push after ----
    const u = clamp(b / TL.CAM_END), e = b <= 0 ? 0 : 1 - Math.pow(1 - u, 7.2);
    const tau = (b - TL.DROP) * spb;
    const shake = tau > 0 ? Math.exp(-tau * 9) * Math.cos(tau * 42) : 0;
    // after the swing the camera never stops: a slow push in (about 7% closer by the end) on a small arc
    const pu = seg(b, 0.9, 10.5), pushIn = 0.5 * pu + 0.5 * ease.outQuad(pu);
    const el = lerp(Math.PI / 2, EL1, e) - 0.03 * pushIn;
    const az = 0.08 * pushIn;
    const dist = lerp(D0, D1, e) * (1 - 0.085 * pushIn) - 0.1 * shake;
    st.tgt.lerpVectors(T0, T1, e); st.tgt.y -= 0.16 * shake;
    st.pos.set(st.tgt.x + dist * Math.sin(az) * Math.cos(el), st.tgt.y + dist * Math.sin(el), st.tgt.z + dist * Math.cos(az) * Math.cos(el));
    st.up.set(-Math.sin(az) * Math.sin(el), Math.cos(el), -Math.cos(az) * Math.sin(el));
    st.el = el; st.dist = dist;
    st.focus = Math.hypot(st.pos.x, st.pos.y - 1.2, st.pos.z - 0.6);
    st.aperture = (opt.aperture ?? 0.62) * smooth(seg(b, 0.1, 1.3));

    // ---- the play button: falls from above the frame, lands on TL.DROP, jiggles on a damped spring ----
    const fall = seg(b, TL.DROP0, TL.DROP);
    const hy = b < TL.DROP0 ? 40 : b < TL.DROP ? 17 * (1 - fall * fall) : 0;
    let sy = 1, wob = 0;
    if (b >= TL.DROP) {
      sy = 1 - 0.36 * Math.exp(-tau * 4.6) * Math.cos(tau * 21); wob = Math.exp(-tau * 3.8) * Math.sin(tau * 15);
      for (let n = Math.max(TL.DROP + 1, Math.floor(b) - 2); n <= b && n < END; n++) { const t2 = (b - n) * spb; sy -= pressAmp(n) * Math.exp(-t2 * 7.5) * Math.cos(t2 * 19); }
    }
    else if (b > TL.DROP0) sy = 1 + 0.1 * fall;
    // the way out: the button breathes out (a sixth smaller in ten frames) and goes on sagging
    const te = (b - END) * spb;
    const exhale = te > 0 ? ease.outCubic(clamp(te / 0.17)) : 0, sag = te > 0 ? smooth(clamp((te - 0.08) / 0.85)) : 0;
    sy *= 1 - 0.34 * sag;
    const sxz = 1 / Math.sqrt(sy);
    hero.visible = b >= TL.DROP0;
    hero.position.set(0, hy, 0);
    disc.scale.set(sxz, sy, sxz);
    // the triangle rides the cushion and answers a moment later
    const tau2 = tau - 0.045;
    const ty = b >= TL.DROP && tau2 > 0 ? 1 - 0.3 * Math.exp(-tau2 * 4.2) * Math.cos(tau2 * 21) : sy;
    let press = 0;
    if (b >= TL.DROP) for (let n = Math.max(TL.DROP + 1, Math.floor(b) - 2); n <= b && n < END; n++) { const t2 = (b - n) * spb; press += pressAmp(n) * Math.exp(-t2 * 9) * Math.cos(t2 * 17); }
    tri.position.y = TRI_Y * sy - (b >= TL.DROP ? 0.16 * Math.exp(-tau * 6) * Math.cos(tau * 21) : 0) - 2.2 * press;
    tri.scale.set(1 / Math.sqrt(ty), ty * (1 - 0.3 * sag), 1 / Math.sqrt(ty));
    hero.rotation.set(0.05 * wob + (b < TL.DROP ? 0.22 * (1 - fall) : 0), (b < TL.DROP ? -0.5 * (1 - fall) * (1 - fall) : 0) + 0.02 * wob, -0.04 * wob + (b < TL.DROP ? -0.12 * (1 - fall) : 0));
    hero.scale.setScalar(1 - 0.15 * exhale);
    hero.updateMatrixWorld();
    const push = tau > 0 ? clamp(spring(tau, 2.7, 0.3), 0, 1.5) : 0;             // how far the field has been shoved aside
    const under = b < TL.DROP0 ? 99 : hy + 0.15;                                   // height of the button's underside

    // ---- the field ----
    const idleAmp = 0.1 + 0.16 * smooth(seg(b, 2.5, 5));
    for (const name in groups) {
      const G = groups[name], M = G.mesh, colours = M.instanceColor;
      let recolour = false;
      for (const s of G.list) {
        const i = s.i;
        let x = s.x, z = s.z, tilt = 0, turn = 0;
        let ex = PILL_R, ey = PILL_H, ez = PILL_R, er = PILL_R, sx = 1, syy = 1;
        if (s.kind === 'pearl') { ex = ey = ez = er = PEARL_R; }
        // born as the wave passes: a flat lentil that fills out with a little overshoot
        const born = s.under ? Math.max(s.rho / TL.WAVE_V, s.under.born + 0.44 / spb) + 0.1 * s.jit : s.rho / TL.WAVE_V + 0.06 * s.jit;
        let grow = clamp(spring((b - born) * spb, 2.6, 0.42), 0, 1.4);
        let wide = clamp(spring((b - born) * spb * 1.5, 2.6, 0.6), 0, 1.2);
        let y0 = 0;
        if (s.piece) {
          // a paper scrap: it lies flat, puffs into a pillow, then draws itself up into its pill and hops to its slot
          const p = s.piece, a = (b - p.born) * spb;
          const puff = clamp(spring(a, 3.0, 0.45), 0, 1.3), go = ease.inOutCubic(seg(a, 0.16, 0.56));
          const thick = Math.min(p.hw, p.hd) * 0.62 * puff;
          ex = lerp(p.hw * (1 - 0.1 * puff), PILL_R, go); ez = lerp(p.hd * (1 - 0.1 * puff), PILL_R, go);
          ey = lerp(Math.max(0.012, thick), PILL_H, go);
          er = lerp(Math.max(0.012, Math.min(thick, 0.6)), PILL_R, go);
          x = lerp(p.x, s.x, go); z = lerp(p.z, s.z, go);
          y0 = 1.5 * Math.sin(go * Math.PI);
          turn = -p.rot * (1 - go);
          grow = a < 0 ? 0 : 1 - 0.14 * Math.sin(go * Math.PI) + (go >= 1 ? -0.14 * Math.exp(-(a - 0.56) * 9) * Math.cos((a - 0.56) * 28) : 0);
          wide = a < 0 ? 0 : 1;
          tmpC.setRGB(lerp(p.colour[0], s.colour[0], go), lerp(p.colour[1], s.colour[1], go), lerp(p.colour[2], s.colour[2], go));
          colours.setXYZ(i, tmpC.r, tmpC.g, tmpC.b); recolour = true;
        }
        // the rings: one from the landing, a gentler one with the polish; and a slow breathing wave after
        hop.y = 0; hop.s = 0; hop.lean = 0;
        for (let n = Math.max(TL.DROP, Math.floor(b) - 5); n <= b && n < END; n++) crest(b, spb, n, s.rho, crestAmp(n), hop);
        const w = Math.sin(Math.PI * (b - s.rho / 4.2));
        hop.y += idleAmp * (0.5 + 0.5 * w) * smooth(seg(b, born + 0.6, born + 1.6));
        hop.s += 0.035 * w * smooth(seg(b, born + 0.6, born + 1.6));
        syy = grow * (1 + hop.s); sx = wide / Math.sqrt(Math.max(0.3, 1 + hop.s));
        let y = y0 + hop.y;
        // the play button: what it lands on is pressed flat, what is at its edge is shoved out and leans away
        if (s.d < 3.2) {
          const top = 2 * ey * syy + y;
          if (s.d < -0.35) {
            if (under < top) { const k = Math.max(0, under - y) / (2 * ey); y = Math.min(y, Math.max(0, under - 0.01)); syy = Math.max(0.0001, k); sx *= 1 + 0.3 * (1 - k / Math.max(1e-3, grow)); if (b >= TL.DROP) { syy = 0.0001; sx = 0.0001; } }
          } else if (push > 0) {
            const dd = Math.max(s.d, 0), shove = (0.78 * Math.exp(-dd / 1.7) + Math.max(0, -s.d)) * push;
            x += Math.cos(s.phi) * shove; z += Math.sin(s.phi) * shove;
            tilt = 0.4 * Math.exp(-dd / 1.1) * (0.55 * push + 0.45 * Math.min(1, push) * (1 + 0.5 * Math.exp(-tau * 3) * Math.sin(tau * 13)));
          }
        }
        tilt += hop.lean;
        // the way out: the pills sink into the floor, ring after ring from the centre (the pearls stay, catching the light)
        let gone = 0;
        if (te > 0 && s.kind === 'pill') {
          const t3 = te - (s.rho / RING) * 0.02;
          gone = ease.inOutCubic(clamp(t3 / 0.3));
          y -= 0.68 * gone + 1.5 * smooth(clamp((t3 - 0.3) / 0.75));
          syy *= 1 - 0.14 * gone; tilt *= 1 - gone;
        }
        if (s.kind === 'pill') {
          // its pool of shade: under the foot, weaker as the pill leaves the floor
          const rr = (Math.max(ex, ez) * sx + 0.36) * 2, f = syy < 0.01 ? 0 : clamp(1 - Math.max(0, y0 + hop.y) / 0.9) * clamp(syy * 3) * (1 - gone);
          cm.makeScale(rr * (ex / Math.max(ex, ez)) , 1, rr * (ez / Math.max(ex, ez)));
          if (turn) cm.premultiply(tmpM.makeRotationY(turn));
          cm.setPosition(x, 0.012, z);
          contacts.setMatrixAt(s.ci, cm);
          cfade.setX(s.ci, f);
        }
        // place it: stand on the floor, lean about the foot
        const h = ey * syy;
        dummy.quaternion.identity();
        if (tilt) { ax.set(Math.sin(s.phi), 0, -Math.cos(s.phi)); dummy.quaternion.setFromAxisAngle(ax, -tilt); }
        if (turn) { qb.setFromAxisAngle(Y, turn); dummy.quaternion.multiply(qb); }
        ax.set(0, h, 0).applyQuaternion(dummy.quaternion);
        dummy.position.set(x + ax.x, y + ax.y, z + ax.z);
        dummy.updateMatrix();
        M.setMatrixAt(i, dummy.matrix);
        if (s.kind === 'pearl') s.w = grow > 0.5 ? [dummy.position.x, dummy.position.y, dummy.position.z] : null;
        G.box.setXYZW(i, ex, ey, ez, er);
        G.scl.setXYZ(i, sx, syy, sx);
      }
      M.instanceMatrix.needsUpdate = true; G.box.needsUpdate = true; G.scl.needsUpdate = true;
      if (recolour) colours.needsUpdate = true;
    }

    contacts.instanceMatrix.needsUpdate = true; cfade.needsUpdate = true;

    // ---- the floor, the light ----
    // the newest crest shows on the floor too, as a faint ring of light
    let rr0 = 0, ra = 0;
    for (let n = Math.max(TL.DROP, Math.floor(b) - 2); n <= b && n < END; n++) { const t2 = (b - n) * spb; const a = crestAmp(n) * Math.exp(-t2 / 0.62); if (a > ra * 0.6) { ra = a; rr0 = HERO.R - 0.8 + TL.CREST_V * t2; } }
    U.uRing.value.set(rr0, 0.3 * ra);
    U.uWave.value.set(0, 0, Math.max(0, b) * TL.WAVE_V);
    U.uLipAmt.value = 0.62 * (1 - smooth(seg(b, 1.2, 2.2))) * (b > 0 ? 1 : 0);
    U.uLit.value = smooth(seg(b, 0.02, 0.5));
    // the softboxes drift, and sweep once on the polish
    scene.environmentRotation.y = 0.05 * Math.sin(b * 0.3) - 0.95 * ease.inOutCubic(seg(b, TL.SHEEN - 0.15, TL.SHEEN + 1.5)) + 0.5;
    return st;
  }

  /** Aim the camera and the lights for pass i of K (after pose). */
  const vx = new THREE.Vector3(), vy = new THREE.Vector3(), vd = new THREE.Vector3(), vf = new THREE.Vector3();
  const basis = (n) => { const up = Math.abs(n.y) < 0.95 ? vf.set(0, 1, 0) : vf.set(1, 0, 0); vx.crossVectors(up, n).normalize(); vy.crossVectors(n, vx).normalize(); };
  function aim(i, K) {
    cam.position.copy(st.pos);
    cam.up.copy(st.up);
    cam.lookAt(st.tgt);
    cam.updateProjectionMatrix();
    const one = K <= 1;
    const lr = one ? 0 : Math.sqrt((i + 0.5) / K) * st.aperture, la = i * GA + 0.7;
    const ex = lr * Math.cos(la), ey = lr * Math.sin(la);
    cam.translateX(ex); cam.translateY(ey);
    const th = Math.tan((FOV * Math.PI) / 360), F = st.focus;
    const el = cam.projectionMatrix.elements;
    const jx = one ? 0 : halton(i + 1, 2) - 0.5, jy = one ? 0 : halton(i + 1, 3) - 0.5;
    el[8] = -ex / (F * th * cam.aspect) + (2 * jx) / W;
    el[9] = -ey / (F * th) + (2 * jy) / H;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    cam.updateMatrixWorld(true);

    const j = one ? 0 : (i * 7 + 3) % K;
    const kr = one ? 0 : Math.sqrt((j + 0.5) / K) * (opt.keySize ?? 0.11), ka = j * GA + 1.9;
    basis(keyDir);
    vd.copy(keyDir).addScaledVector(vx, kr * Math.cos(ka)).addScaledVector(vy, kr * Math.sin(ka)).normalize();
    key.target.position.copy(lightAim); key.position.copy(lightAim).addScaledVector(vd, 60);
    key.target.updateMatrixWorld(); key.updateMatrixWorld();
    U.uKeyView.value.copy(backDir).transformDirection(cam.matrixWorldInverse);

    const m = one ? 0 : (i * 11 + 5) % K;
    const sr = one ? 0 : Math.sqrt((m + 0.5) / K) * 0.94, sa = m * GA + 0.3;
    basis(domeAxis);
    vd.copy(domeAxis).multiplyScalar(Math.sqrt(1 - sr * sr)).addScaledVector(vx, sr * Math.cos(sa)).addScaledVector(vy, sr * Math.sin(sa));
    if (vd.y < 0.58) vd.y = 0.58;
    vd.normalize();
    dome.target.position.copy(lightAim); dome.position.copy(lightAim).addScaledVector(vd, 60);
    dome.target.updateMatrixWorld(); dome.updateMatrixWorld();
  }

  /**
   * Draw beat b into post.accum (linear, ready for the kit's bloom and tone curve), averaged over K passes.
   * shutter: beats the shutter stays open. sheet: a canvas with the picture before this shot, or null.
   */
  let sheetTex = null, sheetOf = null;
  function draw(R2, b, spb, K, shutter, sheet) {
    R2.shadowMap.enabled = true;
    R2.shadowMap.type = THREE.PCFShadowMap;
    if (sheet) {
      if (sheetOf !== sheet) {
        if (sheetTex) sheetTex.dispose();
        sheetTex = new THREE.CanvasTexture(sheet);
        sheetTex.colorSpace = THREE.SRGBColorSpace; sheetTex.minFilter = THREE.LinearFilter; sheetTex.magFilter = THREE.LinearFilter; sheetTex.generateMipmaps = false;
        sheetOf = sheet;
      }
      sheetTex.needsUpdate = true;
      U.uSheet.value = sheetTex; U.uSheetOn.value = 1;
    } else U.uSheetOn.value = 0;

    R2.setRenderTarget(accRT);
    R2.setClearColor(0x000000, 0);
    R2.clear(true, false, false);
    for (let i = 0; i < K; i++) {
      const k2 = K <= 1 ? 0.5 : (((i * 5 + 2) % K) + 0.5) / K;
      pose(b + k2 * shutter, spb);
      aim(i, K);
      R2.setRenderTarget(sceneRT);
      R2.setClearColor(0xf6d0d4, 1);
      R2.render(scene, cam);
      pAdd.uniforms.uWeight.value = 1 / K;
      R2.autoClear = false;
      pAdd.render(R2, accRT);
      R2.autoClear = true;
    }
    pose(b + 0.5 * shutter, spb);
    // fill between the lens positions, into the kit's chain
    const pxPerUnit = (H / 2) / (st.focus * Math.tan((FOV * Math.PI) / 360));
    const cocK = st.aperture * pxPerUnit;
    const fill = K > 1 ? (opt.fill ?? 2.1) / Math.sqrt(K) : 0;
    pFill.uniforms.uFocus.value = st.focus;
    pFill.uniforms.uCocK.value = cocK;
    pFill.uniforms.uFill.value = fill;
    pFill.uniforms.uGather.value = Math.min(18, fill * cocK * 0.45);
    R2.setClearColor(0x000000, 0);
    pFill.render(R2, post.accum);
  }

  /** Where a point of the set lands in the frame at the centre of the lens (after pose and aim(0, 1)). */
  const pv = new THREE.Vector3();
  function project(x, y, z) {
    pv.set(x, y, z).project(cam);
    return [(pv.x * 0.5 + 0.5) * W, (0.5 - pv.y * 0.5) * H, pv.z];
  }
  /** Radius in pixels of the blur circle of a point at distance dz along the view axis. */
  function blurOf(x, y, z) {
    pv.set(x, y, z).applyMatrix4(cam.matrixWorldInverse);
    const depth = -pv.z, pxPerUnit = (H / 2) / (st.focus * Math.tan((FOV * Math.PI) / 360));
    return st.aperture * pxPerUnit * Math.abs(1 - st.focus / Math.max(0.1, depth));
  }

  const pearlAt = (s) => s.w || null;
  return { scene, cam, U, slots, groups, hero, pose, aim, draw, project, blurOf, setPieces, pearlAt, state: st, keyDir, key, dome, hemi, mats: { gummy, plastic, chrome, heroMat, floorMat } };
}
