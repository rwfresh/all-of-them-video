// Camera and lights for a tabletop shot of paper, built for accumulation rendering.
// The director draws each frame K times and averages. On every pass this rig moves three things a little:
//   the lens position across the aperture      -> real depth of field
//   the key light across its face              -> soft shadows that sharpen where paper touches paper
//   a dome light around the sky                -> ambient shading in the folds and under the pieces
// plus a sub-pixel shift for antialiasing. The pattern is fixed, so a frame always renders the same.

import * as THREE from 'three';

const GA = 2.399963229728653;      // golden angle
const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };

export class Rig {
  constructor(scene, o = {}) {
    this.cam = new THREE.PerspectiveCamera(o.fov ?? 26, 16 / 9, 0.5, 260);
    this.pos = new THREE.Vector3(0, 6, 10);
    this.target = new THREE.Vector3(0, 0.5, 0);
    this.focus = new THREE.Vector3(0, 0.5, 0);
    this.aperture = 0.12;          // lens radius in units
    this.roll = 0;

    this.keyDir = new THREE.Vector3(-0.55, 1, 0.45).normalize();   // from the subject toward the light
    this.keySize = 0.055;          // tan of the light's half angle: bigger = softer shadows
    this.keyTarget = new THREE.Vector3(0, 0, 0);
    this.key = new THREE.DirectionalLight('#fff1dd', o.key ?? 2.5);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(4096, 4096);
    const kc = this.key.shadow.camera;
    kc.left = -8.5; kc.right = 8.5; kc.top = 8.5; kc.bottom = -8.5; kc.near = 1; kc.far = 70;
    this.key.shadow.bias = -0.0005; this.key.shadow.normalBias = 0.006; this.key.shadow.radius = 1.5;
    scene.add(this.key, this.key.target);

    this.dome = new THREE.DirectionalLight('#e9efff', o.dome ?? 1.5);
    this.dome.castShadow = true;
    this.dome.shadow.mapSize.set(2048, 2048);
    const dc = this.dome.shadow.camera;
    dc.left = -9; dc.right = 9; dc.top = 9; dc.bottom = -9; dc.near = 1; dc.far = 70;
    this.dome.shadow.bias = -0.0008; this.dome.shadow.normalBias = 0.01; this.dome.shadow.radius = 2.5;
    this.domeBias = new THREE.Vector3(0.1, 1, 0.35).normalize();   // the sky is brightest above and a little toward camera
    scene.add(this.dome, this.dome.target);

    this.hemi = new THREE.HemisphereLight('#fff7ea', o.ground ?? '#f2c14e', o.hemi ?? 0.42);
    scene.add(this.hemi);

    this._x = new THREE.Vector3(); this._y = new THREE.Vector3(); this._d = new THREE.Vector3(); this._f = new THREE.Vector3();
  }

  /** Size the shadow boxes around the part of the table in use. */
  setShadowBox(half, target) {
    for (const [l, k] of [[this.key, 1], [this.dome, 1.06]]) {
      const c = l.shadow.camera;
      c.left = -half * k; c.right = half * k; c.top = half * k; c.bottom = -half * k;
      c.updateProjectionMatrix();
    }
    if (target) this.keyTarget.copy(target);
  }

  /** Pose the camera and lights for accumulation pass i of K. W, H: frame size in pixels. */
  sample(i, K, W, H) {
    const cam = this.cam;
    cam.position.copy(this.pos);
    cam.up.set(Math.sin(this.roll), Math.cos(this.roll), 0);
    cam.lookAt(this.target);
    cam.updateProjectionMatrix();

    // lens: a point on the aperture disc (Vogel spiral), with the projection sheared so the focus plane stays put
    const one = K <= 1;
    const lr = one ? 0 : Math.sqrt((i + 0.5) / K) * this.aperture, la = i * GA + 0.7;
    const ex = lr * Math.cos(la), ey = lr * Math.sin(la);
    cam.translateX(ex); cam.translateY(ey);
    cam.getWorldDirection(this._f);
    const F = Math.max(0.5, this._d.subVectors(this.focus, this.pos).dot(this._f));
    const th = Math.tan((cam.fov * Math.PI) / 360);
    const e = cam.projectionMatrix.elements;
    // sub-pixel jitter for antialiasing (Halton 2, 3)
    const jx = one ? 0 : halton(i + 1, 2) - 0.5, jy = one ? 0 : halton(i + 1, 3) - 0.5;
    e[8] = -ex / (F * th * cam.aspect) + (2 * jx) / W;
    e[9] = -ey / (F * th) + (2 * jy) / H;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    cam.updateMatrixWorld(true);

    // key light: a direction inside the light's face. The index is shuffled so it is not tied to the lens point.
    const j = one ? 0 : (i * 7 + 3) % K;
    const kr = one ? 0 : Math.sqrt((j + 0.5) / K) * this.keySize, ka = j * GA + 1.9;
    this._basis(this.keyDir);
    this._d.copy(this.keyDir).addScaledVector(this._x, kr * Math.cos(ka)).addScaledVector(this._y, kr * Math.sin(ka)).normalize();
    this.key.target.position.copy(this.keyTarget);
    this.key.position.copy(this.keyTarget).addScaledVector(this._d, 30);
    this.key.target.updateMatrixWorld(); this.key.updateMatrixWorld();

    // dome: directions spread over the sky around domeBias, denser near it
    const m = one ? 0 : (i * 11 + 5) % K;
    const sr = one ? 0 : Math.sqrt((m + 0.5) / K) * 0.96, sa = m * GA + 0.3;      // sin of the angle from the dome axis
    this._basis(this.domeBias);
    this._d.copy(this.domeBias).multiplyScalar(Math.sqrt(1 - sr * sr)).addScaledVector(this._x, sr * Math.cos(sa)).addScaledVector(this._y, sr * Math.sin(sa));
    if (this._d.y < 0.12) { this._d.y = 0.12; }
    this._d.normalize();
    this.dome.target.position.copy(this.keyTarget);
    this.dome.position.copy(this.keyTarget).addScaledVector(this._d, 30);
    this.dome.target.updateMatrixWorld(); this.dome.updateMatrixWorld();
  }

  _basis(n) {
    const up = Math.abs(n.y) < 0.95 ? this._f.set(0, 1, 0) : this._f.set(1, 0, 0);
    this._x.crossVectors(up, n).normalize();
    this._y.crossVectors(n, this._x).normalize();
  }
}
