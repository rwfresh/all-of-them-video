// Shot 3, the product hero: the big box on a glossy studio floor, fourteen discs bursting out into a rainbow arch.

import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeBackdrop, makeGlint } from '../stage.js';
import { makeDisc, makeBox } from '../product.js';
import { ease, tw, seg, spring, decay, clamp, lerp, rng, noise1, smooth, TAU, deg } from '../util.js';
import { superText, fills, burst, FONT } from '../supers.js';

const FLOOR = {
  name: 'StudioFloor',
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix; varying vec4 vUv4; varying vec3 vWorld;
    void main() {
      vUv4 = textureMatrix * vec4(position, 1.0);
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 color; uniform sampler2D tDiffuse; varying vec4 vUv4; varying vec3 vWorld;
    void main() {
      vec2 uv = vUv4.xy / vUv4.w;
      // the reflection softens with distance from the product, like a polished but not perfect floor
      float dist = length(vWorld.xz - vec2(0.0, 0.2));
      float rad = 0.0012 + 0.0035 * smoothstep(0.5, 6.0, dist);
      vec3 refl = vec3(0.0); float ws = 0.0;
      for (int i = -3; i <= 3; i++) for (int j = -1; j <= 1; j++) {
        float w = exp(-float(i * i + j * j * 4) / 6.0);
        refl += texture2D(tDiffuse, uv + vec2(float(i), float(j) * 2.0) * rad).rgb * w; ws += w;
      }
      refl /= ws;
      vec3 V = normalize(cameraPosition - vWorld);
      float fres = pow(1.0 - max(V.y, 0.0), 3.0);
      float fade = smoothstep(11.0, 1.0, dist);
      vec3 base = vec3(0.004, 0.010, 0.05) * (0.4 + 0.6 * fade);
      gl_FragColor = vec4(base + min(refl, vec3(6.0)) * color * (0.34 + 0.6 * fres) * fade, 1.0);
    }`,
};

export function makeDiscs(ctx) {
  const { shot, mark, renderer } = ctx;
  const S = shot.discs;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 200);
  const backdrop = makeBackdrop({ rays: 0.3, inner: '#4a1ed0', outer: '#08021c', rayColor: '#a868ff', stars: 0.8 });
  scene.add(backdrop);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const key = new THREE.DirectionalLight('#fff4e0', 2.6); key.position.set(2.5, 4, 6); scene.add(key);
  const rim = new THREE.DirectionalLight('#5a8cff', 2.2); rim.position.set(-4, 3, -3); scene.add(rim);

  const floor = new Reflector(new THREE.PlaneGeometry(60, 60), { textureWidth: 1920, textureHeight: 1080, color: 0xffffff, shader: FLOOR, clipBias: 0.002 });
  floor.rotation.x = -Math.PI / 2;
  // the mirror pass skips the backdrop sparkles: blurred, they turn into dot grids on the floor
  const mirror = floor.onBeforeRender;
  floor.onBeforeRender = function (...a) { const u = backdrop.material.uniforms, s = u.uStars.value; u.uStars.value = 0; mirror.apply(this, a); u.uStars.value = s; };
  scene.add(floor);

  const box = makeBox();
  scene.add(box);

  const N = 14;
  const arch = { cx: 0, cy: 0.8, cz: -0.55, r: 2.78, a0: deg(174), a1: deg(6) };
  const rnd = rng(1998);
  const discs = Array.from({ length: N }, (_, i) => {
    const mesh = makeDisc(i + 1);
    mesh.scale.setScalar(0.62);
    scene.add(mesh);
    const a = lerp(arch.a0, arch.a1, i / (N - 1));
    return {
      mesh, i, a,
      home: new THREE.Vector3(arch.cx + Math.cos(a) * arch.r, arch.cy + Math.sin(a) * arch.r, arch.cz + (6.5 - Math.abs(i - 6.5)) * 0.14),   // shingled: the middle discs sit in front
      s: { p: rnd() * TAU, q: rnd() * TAU, k: 0.7 + rnd() * 0.6 },
    };
  });

  const glints = [0, 1, 2].map(() => { const g = makeGlint('#ffffff'); scene.add(g); return g; });

  const tF = mark('discs', 'fourteen') - S.t0;      // "fourteen" is spoken here
  const tOut = S.dur - 0.42;                        // one disc leaves for the camera
  const launch = (i) => 0.04 + i * 0.066;       // two frames apart
  const HERO = 6;                                   // the disc that flies at the lens

  function pose(lt) {
    // box: spins in and settles, then turns slowly
    const bi = tw(lt, -0.1, 0.5, ease.outBack);
    box.rotation.y = lerp(-2.2, -0.52, bi) + 0.1 * Math.sin(lt * 0.9);
    box.userData.glare.uniforms.uSweep.value = lerp(-0.7, 2.2, seg(lt, 1.0, 1.6));
    box.scale.setScalar(lerp(0.6, 1.3, bi));
    box.position.set(0, 0, 0.3);

    // lights that make the rainbows sweep
    const sweep = lt * 0.85;
    const L = [
      new THREE.Vector3(-4.0 + 3.0 * Math.sin(sweep), 4.2, 7.0),
      new THREE.Vector3(4.5 - 3.0 * Math.sin(sweep * 0.8 + 1.0), 2.4 + 1.2 * Math.cos(sweep), 8.0),
      new THREE.Vector3(1.5 * Math.sin(sweep * 1.3), 7.5, 3.0),
    ];

    for (const d of discs) {
      const t0 = launch(d.i);
      const p = tw(lt, t0, t0 + 0.55, ease.outCubic);
      const settle = clamp(spring(lt - t0 - 0.1, 2.6, 0.5), 0, 1.3);
      const m = d.mesh;
      m.visible = lt >= t0;
      // path: up out of the box, then out along the arch
      const from = new THREE.Vector3(0, 2.25, 0.3);     // out of the top of the box
      const pos = from.clone().lerp(d.home, p);
      pos.y += Math.sin(p * Math.PI) * 0.9;
      m.position.copy(pos);
      // flip wave: label side first, then every disc turns its data side to the lens
      const flip = tw(lt, tF + d.i * 0.035, tF + d.i * 0.035 + 0.4, ease.inOutCubic);
      const wob = 1 - 0.0 * p;
      m.rotation.set(
        lerp(-1.5, 0, p) + 0.13 * Math.sin(lt * 1.3 * d.s.k + d.s.p) * wob,
        Math.PI * (1 - flip) + 0.15 * Math.cos(lt * 1.1 * d.s.k + d.s.q) + (Math.cos(d.a)) * 0.2,
        lerp(6, 0, p) + lt * 0.4,
      );
      m.scale.setScalar(0.62 * lerp(0.25, 1, clamp(settle)));
      const u = m.material.uniforms;
      u.uL.value[0].copy(L[0]); u.uL.value[1].copy(L[1]); u.uL.value[2].copy(L[2]);
      u.uRainbow.value = 1.6;
    }

    // hero disc heads for the lens at the end
    const out = tw(lt, tOut, S.dur, ease.inCubic);
    if (out > 0) {
      const d = discs[HERO];
      d.mesh.position.lerp(new THREE.Vector3(0.0, 1.5, 7.4), out);
      d.mesh.rotation.x = lerp(d.mesh.rotation.x, 0, out); d.mesh.rotation.y = lerp(d.mesh.rotation.y, 0, out);
      d.mesh.scale.setScalar(0.62 * lerp(1, 1.6, out));
    }

    // camera: low hero angle, slow arc, a kick as the discs land
    const arc = lerp(-0.22, 0.2, smooth(seg(lt, 0, S.dur)));
    const kick = decay(lt - tF, 0.1) * 0.05;
    cam.position.set(Math.sin(arc) * 9.3 + (noise1(lt * 41) - 0.5) * kick * 5, 1.0 + (noise1(lt * 37 + 5) - 0.5) * kick * 5, Math.cos(arc) * 9.3 - 0.5 * seg(lt, 0, S.dur));
    cam.lookAt(0, 1.6, 0);

    const bu = backdrop.material.uniforms;
    bu.uTime.value = lt + 11; bu.uCenter.value.set(0.5, 0.52);
    bu.uRays.value = 0.25 + 0.4 * decay(lt - tF, 0.4);

    glints.forEach((g, i) => {
      const d = discs[[2, 7, 11][i]];
      const a = lt - (launch(d.i) + 0.5);
      const v = a < 0 ? 0 : Math.exp(-a * 3.5) + 0.25 * Math.pow(Math.max(0, Math.sin(lt * 2.6 + i * 2.1)), 6);
      g.position.copy(d.mesh.position).add(new THREE.Vector3(0.25, 0.3, 0.3));
      g.scale.setScalar(0.5 + 0.6 * Math.min(1, v));
      g.material.uniforms.uGain.value = v * 2.2;
      g.material.uniforms.uRot.value = lt * 0.7 + i;
      g.visible = v > 0.01;
    });
  }

  return {
    name: 'discs',
    sfx: [{ t: 0, s: 'whip', g: 0.7 }, { t: 0.02, s: 'discs_whoosh' }, { t: tF, s: 'pop', g: 0.8 }, { t: tF + 0.05, s: 'cd_shimmer', g: 0.8 }, { t: tOut, s: 'whip' }],
    samples: (lt) => (lt < 1.3 || lt > tOut ? 12 : 4),
    render(lt, post, r) {
      pose(lt);
      r.setRenderTarget(post.scene);
      r.render(scene, cam);
    },
    overlay(g, lt) {
      const b = lt - tF;
      if (b <= 0) return false;
      const landed = clamp(Math.floor((lt - 0.3) / 0.066) + 1, 1, 14);
      const s = lerp(2.2, 1, clamp(spring(b, 4, 0.42)));
      const out = 1 - tw(lt, tOut, S.dur - 0.1, ease.inCubic);
      superText(g, 'ON', 300, 930, { font: FONT.black, size: 76, fill: fills.white, strokeW: 11, skew: 0.14, alpha: out * clamp(b / 0.05), scale: s });
      superText(g, String(landed), 500, 946, { font: FONT.impact, size: 190, fill: fills.yellow, strokeW: 16, shadow: 9, skew: 0.12, alpha: out * clamp(b / 0.05), scale: s });
      superText(g, 'CD-ROMs!', 1490, 936, { font: FONT.impact, size: 136, fill: fills.yellow, strokeW: 14, shadow: 8, skew: 0.12, alpha: out * clamp(b / 0.05), scale: s, tracking: 2 });
      return true;
    },
    look(lt) {
      const out = tw(lt, tOut + 0.12, S.dur, ease.inQuad);
      return {
        bloom: 0.32 + 0.3 * decay(lt - tF, 0.25), streak: 0.3, thresh: 1.1, exposure: 1.05,
        flash: 0.15 * decay(lt, 0.05) + 1.0 * out * out, flashColor: new THREE.Color(1, 1, 1),
        vhs: 1, glitch: 0.6 * decay(lt, 0.03), noise: 0.8, scan: 0.1,
      };
    },
  };
}
