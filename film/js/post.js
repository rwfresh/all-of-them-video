// Post chain: motion-blur accumulation -> bloom + lens streak -> tone map -> VHS tape degrade.
// Shots render linear HDR into `post.scene`; the chain turns that into the final frame on the canvas.

import * as THREE from 'three';

const VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export class Pass {
  constructor(frag, uniforms = {}, opts = {}) {
    this.uniforms = uniforms;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...opts,
    });
    const mesh = new THREE.Mesh(Pass.geo, this.material);
    mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(mesh);
  }
  render(renderer, target) {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, Pass.cam);
  }
}
Pass.geo = new THREE.PlaneGeometry(2, 2);
Pass.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const NOISE = /* glsl */`
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}`;

// Adds one motion-blur sample: scene + the 2D overlay (supers, captions), weighted, into the accumulator.
const ADD = /* glsl */`
uniform sampler2D tScene, tOver;
uniform float uWeight, uOverGain, uHasOver;
varying vec2 vUv;
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
void main() {
  vec3 col = texture2D(tScene, vUv).rgb;
  if (uHasOver > 0.5) {
    vec4 o = texture2D(tOver, vUv);
    col = mix(col, toLinear(o.rgb) * uOverGain, o.a);
  }
  gl_FragColor = vec4(min(col, vec3(48.0)) * uWeight, 1.0);
}`;

const DOWN = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uFirst, uThresh, uKnee;
varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2)), d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
  vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2)), j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (uFirst > 0.5) {
    float br = max(col.r, max(col.g, col.b));
    float soft = clamp(br - uThresh + uKnee, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 1e-4);
    col *= max(soft, br - uThresh) / max(br, 1e-4);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const UP = /* glsl */`
uniform sampler2D tSrc, tAdd; uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 d = uTexel;
  vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += (texture2D(tSrc, vUv + vec2(d.x, 0)).rgb + texture2D(tSrc, vUv - vec2(d.x, 0)).rgb
      + texture2D(tSrc, vUv + vec2(0, d.y)).rgb + texture2D(tSrc, vUv - vec2(0, d.y)).rgb) * 2.0;
  c += texture2D(tSrc, vUv + d).rgb + texture2D(tSrc, vUv - d).rgb
     + texture2D(tSrc, vUv + vec2(d.x, -d.y)).rgb + texture2D(tSrc, vUv + vec2(-d.x, d.y)).rgb;
  gl_FragColor = vec4(c / 16.0 + texture2D(tAdd, vUv).rgb, 1.0);
}`;

// Horizontal blur for the star-filter streak that 90s product shots love.
const STREAK = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uStride;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0); float wsum = 0.0;
  for (int i = -8; i <= 8; i++) {
    float w = exp(-float(i * i) / 22.0);
    c += texture2D(tSrc, vUv + vec2(float(i) * uStride * uTexel.x, 0.0)).rgb * w; wsum += w;
  }
  gl_FragColor = vec4(c / wsum, 1.0);
}`;

const COMPOSITE = /* glsl */`
uniform sampler2D tHdr, tBloom, tStreak;
uniform float uBloom, uStreak, uExposure, uFlash, uFade, uSat, uNeutral;
uniform vec3 uFlashColor;
varying vec2 vUv;
vec3 tonemap(vec3 x) { x = max(x, 0.0); return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
// Khronos PBR Neutral: leaves colours below the shoulder alone, so paper keeps the colour it was cut from.
vec3 neutral(vec3 color) {
  const float startCompression = 0.76, desaturation = 0.15;
  color = max(color, 0.0);
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}
void main() {
  vec3 c = texture2D(tHdr, vUv).rgb;
  c += texture2D(tBloom, vUv).rgb * uBloom;
  c += texture2D(tStreak, vUv).rgb * uStreak * vec3(0.55, 0.75, 1.0);
  c += uFlashColor * uFlash;
  c *= uExposure * uFade;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  gl_FragColor = vec4(toSRGB(uNeutral > 0.5 ? neutral(c) : tonemap(c)), 1.0);
}`;

// The tape. Works on the encoded signal, the way a VCR does: luma keeps most of its detail, chroma is smeared and
// arrives late, lines wobble, the bottom of the picture tears where the heads switch, and the tape drops out.
const VHS = /* glsl */`
uniform sampler2D tSrc;
uniform vec2 uRes;
uniform float uTime, uFrame, uAmt, uGlitch, uBW, uScan, uNoise, uRoll, uVignette;
varying vec2 vUv;
${NOISE}
vec3 rgb2yiq(vec3 c) { return vec3(dot(c, vec3(0.299, 0.587, 0.114)), dot(c, vec3(0.5959, -0.2746, -0.3213)), dot(c, vec3(0.2115, -0.5227, 0.3112))); }
vec3 yiq2rgb(vec3 c) { return vec3(c.x + 0.956 * c.y + 0.619 * c.z, c.x - 0.272 * c.y - 0.647 * c.z, c.x - 1.106 * c.y + 1.703 * c.z); }
void main() {
  vec2 uv = vUv;
  float px = 1.0 / uRes.x;
  float line = floor(uv.y * 486.0);

  // vertical roll while the picture loses sync
  uv.y = fract(uv.y + uRoll);

  // line wobble: slow sway + per-line jitter
  float wob = (vnoise(vec2(line * 0.045, uTime * 2.3)) - 0.5) * 2.2 + (hash21(vec2(line, uFrame)) - 0.5) * 0.7;
  uv.x += wob * px * 1.1 * uAmt;

  // head-switching tear in the bottom lines
  float hs = smoothstep(0.022, 0.0, vUv.y);
  uv.x += hs * (0.012 + 0.02 * vnoise(vec2(uTime * 9.0, line * 0.5))) * uAmt;

  // tracking tear: bands slide sideways
  float band = floor(vUv.y * 22.0 + uFrame * 3.7);
  float tear = (hash21(vec2(band, floor(uFrame))) - 0.5);
  float tearMask = step(0.45, hash21(vec2(band * 1.7, floor(uFrame) + 5.0)));
  uv.x += tear * tearMask * 0.22 * uGlitch;
  float gl = uGlitch * tearMask;

  // luma: narrow blur; chroma: wide blur, delayed
  float y = 0.0, yw = 0.0, wsum = 0.0, wwsum = 0.0; vec2 iq = vec2(0.0);
  float spreadY = 1.55 * (0.35 + 0.65 * uAmt), spreadC = 3.3 * uAmt + 0.001;
  for (int i = -4; i <= 4; i++) {
    float w = exp(-float(i * i) / 5.0);
    y += rgb2yiq(texture2D(tSrc, uv + vec2(float(i) * spreadY * px, 0.0)).rgb).x * w; wsum += w;
  }
  y /= wsum;
  for (int i = -7; i <= 7; i++) {
    float w = exp(-float(i * i) / 18.0);
    vec3 q = rgb2yiq(texture2D(tSrc, uv + vec2((float(i) * spreadC - 6.0 * uAmt) * px, 0.0)).rgb);
    iq += q.yz * w; yw += q.x * w; wwsum += w;
  }
  iq /= wwsum; yw /= wwsum;

  // edge ringing: the bright halo right of hard edges
  y += (y - yw) * 0.42 * uAmt;

  // tape noise: fine luma grain, blotchy chroma
  float n = hash21(vUv * uRes + uFrame * 17.13) - 0.5;
  y += n * 0.055 * uNoise;
  iq += (vec2(vnoise(vec2(vUv.x * 150.0, line * 0.8 + uFrame * 3.1)), vnoise(vec2(vUv.x * 150.0 + 40.0, line * 0.8 - uFrame * 2.3))) - 0.5) * 0.07 * uNoise;

  // dropouts: short white streaks with a tail
  float dl = hash21(vec2(line * 0.5, floor(uFrame)));
  float dstart = hash21(vec2(line * 0.5 + 9.0, floor(uFrame)));
  float dx = vUv.x - dstart;
  float drop = step(0.9965 - 0.05 * uGlitch, dl) * step(0.0, dx) * exp(-dx * 26.0);
  y = mix(y, 1.0, drop * (0.8 * uAmt + uGlitch));

  // tear bands lose colour and fill with snow
  iq *= 1.0 - 0.85 * gl;
  y = mix(y, hash21(vec2(vUv.x * uRes.x * 0.5, line + uFrame * 7.0)), 0.55 * gl);

  // head-switch band: noisy
  y = mix(y, y * 0.6 + 0.4 * hash21(vec2(vUv.x * 300.0, uFrame + line)), hs * 0.7 * uAmt);

  iq *= mix(1.0, 0.0, uBW);
  vec3 c = yiq2rgb(vec3(y, iq * (1.0 + 0.12 * uAmt)));

  // scanlines
  c *= 1.0 - uScan * (0.5 + 0.5 * cos(vUv.y * 486.0 * 6.2831853)) * 0.5;

  // tape colour: lifted blacks, soft shoulder
  c = mix(c, c * 0.93 + 0.035, uAmt);

  // vignette and soft corners
  vec2 q = vUv * 2.0 - 1.0;
  float vig = 1.0 - uVignette * pow(dot(q * vec2(0.82, 0.95), q * vec2(0.82, 0.95)), 1.6) * 0.42;
  c *= vig;

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

// The clean finish for films that are not on tape: a soft vignette and a breath of grain, nothing else.
const GRADE = /* glsl */`
uniform sampler2D tSrc;
uniform vec2 uRes;
uniform float uFrame, uGrain, uVignette;
varying vec2 vUv;
${NOISE}
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb;
  vec2 q = vUv * 2.0 - 1.0;
  float d = dot(q * vec2(0.80, 0.92), q * vec2(0.80, 0.92));
  c *= 1.0 - uVignette * pow(d, 1.5) * 0.36;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  float n = hash21(vUv * uRes + uFrame * 17.13) + hash21(vUv * uRes * 0.5 + uFrame * 7.7) - 1.0;
  c += n * uGrain * (0.6 + 0.4 * (1.0 - l));
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export class Post {
  constructor(renderer, W, H) {
    this.renderer = renderer;
    this.W = W; this.H = H;
    const hf = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.scene = new THREE.WebGLRenderTarget(W, H, { ...hf, depthBuffer: true, samples: 4 });
    this.accum = new THREE.WebGLRenderTarget(W, H, hf);
    this.down = []; this.up = [];
    let w = W, h = H;
    for (let i = 0; i < 6; i++) {
      w = Math.max(2, w >> 1); h = Math.max(2, h >> 1);
      this.down.push(new THREE.WebGLRenderTarget(w, h, hf));
      this.up.push(new THREE.WebGLRenderTarget(w, h, hf));
    }
    this.streakA = new THREE.WebGLRenderTarget(this.down[1].width, this.down[1].height, hf);
    this.streakB = new THREE.WebGLRenderTarget(this.down[1].width, this.down[1].height, hf);
    this.ldr = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });

    this.pAdd = new Pass(ADD, {
      tScene: { value: this.scene.texture }, tOver: { value: null },
      uWeight: { value: 1 }, uOverGain: { value: 1 }, uHasOver: { value: 0 },
    }, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
    this.pDown = new Pass(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uFirst: { value: 0 }, uThresh: { value: 1.0 }, uKnee: { value: 0.5 } });
    this.pUp = new Pass(UP, { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.pStreak = new Pass(STREAK, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uStride: { value: 1 } });
    this.pComp = new Pass(COMPOSITE, {
      tHdr: { value: this.accum.texture }, tBloom: { value: null }, tStreak: { value: this.streakB.texture },
      uBloom: { value: 0.12 }, uStreak: { value: 0.1 }, uExposure: { value: 1 }, uFlash: { value: 0 }, uFade: { value: 1 },
      uSat: { value: 1 }, uFlashColor: { value: new THREE.Color(1, 1, 1) }, uNeutral: { value: 0 },
    });
    this.pVhs = new Pass(VHS, {
      tSrc: { value: this.ldr.texture }, uRes: { value: new THREE.Vector2(W, H) },
      uTime: { value: 0 }, uFrame: { value: 0 }, uAmt: { value: 1 }, uGlitch: { value: 0 }, uBW: { value: 0 },
      uScan: { value: 0.12 }, uNoise: { value: 1 }, uRoll: { value: 0 }, uVignette: { value: 1 },
    });
    this.pGrade = new Pass(GRADE, {
      tSrc: { value: this.ldr.texture }, uRes: { value: new THREE.Vector2(W, H) }, uFrame: { value: 0 }, uGrain: { value: 0 }, uVignette: { value: 0 },
    });
  }

  begin() {
    const r = this.renderer;
    r.setRenderTarget(this.accum);
    r.setClearColor(0x000000, 0);
    r.clear(true, false, false);
  }

  /** Add the frame currently in `this.scene` as one motion-blur sample. */
  add(weight, overlay = null, overlayGain = 1) {
    const u = this.pAdd.uniforms;
    u.uWeight.value = weight;
    u.tOver.value = overlay;
    u.uHasOver.value = overlay ? 1 : 0;
    u.uOverGain.value = overlayGain;
    const r = this.renderer;
    const auto = r.autoClear;
    r.autoClear = false;
    this.pAdd.render(r, this.accum);
    r.autoClear = auto;
  }

  /** Bloom, tone map and tape degrade to the canvas. `p` holds the look for this frame. */
  finish(t, p = {}) {
    const r = this.renderer;
    const look = {
      bloom: 0.14, streak: 0.1, thresh: 1.0, knee: 0.6, exposure: 1, flash: 0, fade: 1, sat: 1, flashColor: null,
      vhs: 1, glitch: 0, bw: 0, scan: 0.12, noise: 1, roll: 0, vignette: 1, ...p,
    };

    // bloom pyramid
    let src = this.accum;
    for (let i = 0; i < this.down.length; i++) {
      const u = this.pDown.uniforms;
      u.tSrc.value = src.texture;
      u.uTexel.value.set(1 / src.width, 1 / src.height);
      u.uFirst.value = i === 0 ? 1 : 0;
      u.uThresh.value = look.thresh; u.uKnee.value = look.knee;
      this.pDown.render(r, this.down[i]);
      src = this.down[i];
    }
    let low = this.down[this.down.length - 1];
    for (let i = this.down.length - 2; i >= 0; i--) {
      const u = this.pUp.uniforms;
      u.tSrc.value = low.texture; u.tAdd.value = this.down[i].texture;
      u.uTexel.value.set(1 / low.width, 1 / low.height);
      this.pUp.render(r, this.up[i]);
      low = this.up[i];
    }

    // lens streak from the quarter-res highlights
    const s = this.pStreak.uniforms;
    s.tSrc.value = this.down[1].texture; s.uTexel.value.set(1 / this.down[1].width, 1 / this.down[1].height); s.uStride.value = 2.5;
    this.pStreak.render(r, this.streakA);
    s.tSrc.value = this.streakA.texture; s.uStride.value = 9;
    this.pStreak.render(r, this.streakB);

    const c = this.pComp.uniforms;
    c.tBloom.value = this.up[0].texture;
    c.uBloom.value = look.bloom / this.down.length * 2.0; c.uStreak.value = look.streak;
    c.uExposure.value = look.exposure; c.uFlash.value = look.flash; c.uFade.value = look.fade; c.uSat.value = look.sat; c.uNeutral.value = look.paper ? 1 : 0;
    if (look.flashColor) c.uFlashColor.value.copy(look.flashColor); else c.uFlashColor.value.setRGB(1, 1, 1);
    this.pComp.render(r, this.ldr);

    if (look.paper) {
      // no tape: grade straight to the canvas. Grain holds for two frames, like the paper it sits on.
      const gr = this.pGrade.uniforms;
      gr.uFrame.value = Math.floor(Math.round(t * 30) / 2); gr.uGrain.value = look.grain ?? 0.03; gr.uVignette.value = look.vignette;
      this.pGrade.render(r, null);
      return;
    }
    const v = this.pVhs.uniforms;
    v.uTime.value = t; v.uFrame.value = Math.round(t * 30);
    v.uAmt.value = look.vhs; v.uGlitch.value = look.glitch; v.uBW.value = look.bw;
    v.uScan.value = look.scan; v.uNoise.value = look.noise; v.uRoll.value = look.roll; v.uVignette.value = look.vignette;
    this.pVhs.render(r, null);
  }
}
