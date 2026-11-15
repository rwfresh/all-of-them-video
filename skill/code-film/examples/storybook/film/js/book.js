// The pop-up book: stiff card leaves hinged on a spine, and V-folds that stand up as a spread opens.
//
// The book lies on the table (y = 0), spine along z, front edge toward the camera (+z).
// leaves[0] is the front cover; `base` is the back cover and never turns. Leaf i turns by phi[i]: 0 = lying on the
// right, PI = turned over to the left. Spread k (1..n) is what you see between leaf k-1 (turned) and leaf k (or the
// base): its left page is the back of leaf k-1, its right page the front of leaf k.
//
// Page coordinates (for anything lying on a page): x right from the gutter, y up the page (away from the reader),
// z = height off the paper. Right pages span x in [gap, gap + W], left pages x in [-gap - W, -gap].
//
// A V-fold is two wings glued to the two pages along lines that meet on the spine at angle beta. Its geometry is
// the real one: each wing contains its glue line and the shared centre crease, so it folds flat when the book shuts
// and stands when the spread is open. Wing coordinates: x away from the crease (right wing +, left wing -), y up
// the crease, z toward the reader.

import * as THREE from 'three';
import { paperMat, rr, piece, PAL } from './paper.js';

const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), T = new THREE.Vector3();

export class Book {
  /** o.leaves: [{ th, board, front, back, w, d }] from the front cover inward; o.base: the back cover. */
  constructor(o) {
    this.W = o.pageW ?? 3.2; this.D = o.pageD ?? 2.6; this.gap = o.gap ?? 0.035;
    this.group = new THREE.Group();
    this.leaves = o.leaves.map((l, i) => this._leaf(l, i));
    this.base = this._leaf(o.base, -1);
    this.n = this.leaves.length;
    this.phi = new Array(this.n).fill(0);
    this.folds = [];
    // cloth spine lying between the two stacks
    const spine = piece(rr(0.13, (o.base.d ?? this.D) - 0.02, 0.02), o.spine ?? PAL.navy, {});
    spine.rotation.x = -Math.PI / 2; spine.position.y = 0.004;
    this.group.add(spine);
    this.setTurns(this.phi);
  }

  _leaf(l, i) {
    const w = l.w ?? this.W, d = l.d ?? this.D, th = l.th ?? 0.03, r = l.r ?? 0.12;
    const shape = rr(w, d, [r, r, r, r], this.gap + w / 2, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: false, curveSegments: 10 });
    geo.rotateX(-Math.PI / 2);                 // shape y -> -z, thickness -> +y
    const board = new THREE.Mesh(geo, paperMat(l.board ?? PAL.cream, { bump: 0.5 }));
    board.castShadow = true; board.receiveShadow = true;
    const pivot = new THREE.Group();
    pivot.add(board);
    // the two faces, as sheets of coloured paper glued to the board
    const front = new THREE.Group(); front.rotation.x = -Math.PI / 2; front.position.y = th;
    const flip = new THREE.Group(); flip.rotation.z = Math.PI;
    const back = new THREE.Group(); back.rotation.x = -Math.PI / 2;
    flip.add(back); pivot.add(front, flip);
    const fs = piece(rr(w, d, r, this.gap + w / 2, 0), l.front ?? PAL.cream, { z: 0.0015, cast: false });
    const bs = piece(rr(w, d, r, -this.gap - w / 2, 0), l.back ?? PAL.cream, { z: 0.0015, cast: false });
    front.add(fs); back.add(bs);
    this.group.add(pivot);
    return { pivot, front, back, board, th, w, d, index: i, frontSheet: fs, backSheet: bs };
  }

  /** Set every leaf's turn angle (radians, 0..PI) and restack the two piles. */
  setTurns(phi) {
    this.phi = phi.slice();
    const tb = this.base.th;
    this.base.pivot.position.set(0, 0, 0);
    let below = 0;
    const left = this.leaves.map((l) => { const y = below; below += l.th; return y; });        // resting height when turned
    let above = tb;
    const right = new Array(this.n);
    for (let i = this.n - 1; i >= 0; i--) { right[i] = above; above += this.leaves[i].th; }     // resting height unturned
    this.leaves.forEach((l, i) => {
      const u = phi[i] / Math.PI;
      l.pivot.position.set(0, right[i] + (left[i] + l.th - right[i]) * u, 0);
      l.pivot.rotation.z = phi[i];
    });
    this.group.updateMatrixWorld(true);
    for (const f of this.folds) f.update();
  }

  /** The two pages of spread k: { left, right } groups in page coordinates (left is null for the closed cover). */
  pages(k) {
    return { left: k > 0 ? this.leaves[k - 1].back : null, right: k < this.n ? this.leaves[k].front : this.base.front };
  }

  /** How far spread k is open: 0 shut .. PI flat. */
  openAngle(k) { return (k > 0 ? this.phi[k - 1] : 0) - (k < this.n ? this.phi[k] : 0); }

  /** Add a V-fold to spread k. o: z (where its point sits on the spine), beta (degrees between glue line and spine),
   *  gamma (degrees between glue line and crease, 90 = stands straight up), valley (true: wings come toward the reader). */
  vfold(k, o = {}) { const f = new VFold(this, k, o); this.folds.push(f); f.update(); return f; }
}

class VFold {
  constructor(book, k, o) {
    this.book = book; this.k = k;
    this.z0 = o.z ?? 0;
    this.beta = ((o.beta ?? 70) * Math.PI) / 180;
    this.gamma = ((o.gamma ?? 90) * Math.PI) / 180;
    this.dir = o.valley === false ? -1 : 1;
    this.R = new THREE.Group(); this.L = new THREE.Group();
    this.R.matrixAutoUpdate = false; this.L.matrixAutoUpdate = false;
    this.clipR = new THREE.Plane(); this.clipL = new THREE.Plane();
    this.clipR.uuid = THREE.MathUtils.generateUUID(); this.clipL.uuid = THREE.MathUtils.generateUUID();   // material cache keys
    this.layers = [];
    this.open = 0;
    book.group.add(this.R, this.L);
  }

  /** A group riding on a wing, held `d` in front of it by paper struts: it sinks flat as the book shuts. */
  layer(side, d, o = {}) {
    const g = new THREE.Group();
    g.userData.d = d;
    g.position.set(o.x ?? 0, o.y ?? 0, 0);
    (side === 'L' ? this.L : this.R).add(g);
    this.layers.push(g);
    return g;
  }

  update() {
    const b = this.book, k = this.k;
    const pL = b.phi[k - 1], pR = k < b.n ? b.phi[k] : 0;
    const theta = Math.max(0, pL - pR);
    this.open = theta / Math.PI;
    // pop-ups stay low while the spread is mostly shut and stand up as the page lands (and sink first when it closes),
    // so nothing pokes through a turning page
    const ru = Math.min(1, Math.max(0, (this.open - 0.45) / 0.45));
    this.rise = ru * ru * (3 - 2 * ru);
    const rightLeaf = k < b.n ? b.leaves[k] : b.base, leftLeaf = b.leaves[k - 1];
    // where the two page surfaces meet the gutter
    const yr = rightLeaf.pivot.position.y + rightLeaf.th * Math.cos(pR), xr = -rightLeaf.th * Math.sin(pR);
    const yl = leftLeaf.pivot.position.y;
    const ax = xr / 2, ay = (yr + yl) / 2 + 0.002, az = this.z0, shear = (yr - yl) / 2;
    const mid = (pL + pR) / 2;
    // crease direction: in the plane that bisects the pages
    const A = Math.cos(this.beta), B = Math.sin(this.beta) * Math.cos(theta / 2), Rr = Math.hypot(A, B);
    const psi = Math.atan2(B, A) + Math.acos(Math.max(-1, Math.min(1, Math.cos(this.gamma) / Rr)));
    // A fold that faces the reader almost flat (beta near 90) would, by true paper geometry, lie back the moment the
    // spread starts to close and sweep through the scenery behind it. Those folds stay upright in the plane between
    // the pages and simply sink (see `rise`); only the back walls (beta up to about 72) lean back like real paper.
    const lean = Math.min(1, Math.max(0, (80 - (this.beta * 180) / Math.PI) / 8));
    const psiE = Math.PI / 2 + (psi - Math.PI / 2) * lean;
    const cx = Math.sin(psiE) * Math.cos(mid), cy = Math.sin(psiE) * Math.sin(mid), cz = Math.cos(psiE) * this.dir;
    const wing = (grp, phi, sign, plane) => {
      // glue line on this page, then the wing's own axes
      const hx = Math.sin(this.beta) * Math.cos(phi), hy = Math.sin(this.beta) * Math.sin(phi), hz = Math.cos(this.beta) * this.dir;
      const dot = hx * cx + hy * cy + hz * cz;
      X.set(hx - dot * cx, hy - dot * cy, hz - dot * cz).normalize().multiplyScalar(sign);
      Y.set(cx, cy, cz);
      Z.crossVectors(X, Y).normalize();
      Y.multiplyScalar(Math.max(0.002, this.rise));
      // the two piles of pages are not the same height: lean each wing a hair so its foot meets its own page
      X.y += (shear / b.W) * this.open * this.open;
      grp.matrix.makeBasis(X, Y, Z).setPosition(ax, ay, az);
      grp.matrixWorldNeedsUpdate = true;
      T.copy(X).setY(X.y - (shear / b.W) * this.open * this.open).multiplyScalar(sign).transformDirection(b.group.matrixWorld);
      plane.setFromNormalAndCoplanarPoint(T, new THREE.Vector3(ax, ay, az).applyMatrix4(b.group.matrixWorld));
    };
    wing(this.R, pR, 1, this.clipR);
    wing(this.L, pL, -1, this.clipL);
    const s = Math.sin(theta / 2);
    for (const g of this.layers) g.position.z = g.userData.d * s * s;
    this.R.updateMatrixWorld(true); this.L.updateMatrixWorld(true);
  }
}
