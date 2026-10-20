/**
 * Omino 3D degli esercizi: costruisce con three.js il personaggio e gli attrezzi a partire dallo scheletro di lato di `poses.ts`
 * (stesse pose di partenza e arrivo) e lo porta da una posa all'altra. Nessun codice di React Native: serve solo un renderer.
 * Unità: quelle dello scheletro (circa 2 cm); +X davanti alla figura, +Y in alto, +Z verso chi guarda (lato vicino).
 */
import * as THREE from 'three';
import { skeleton, type Family, type Pose, type Pt, type Skeleton } from './poses.ts';

export type RigColors = { shirt: string; shirtDark: string; shorts: string; shortsDark: string; skin: string; skinDark: string; hair: string; shoe: string; sole: string; metal: string; metalDark: string; pad: string; padTop: string; plate: string; floor: string };
export const RIG_COLORS: RigColors = { shirt: '#ff7a45', shirtDark: '#d4572a', shorts: '#2f3b5c', shortsDark: '#212a45', skin: '#f0b995', skinDark: '#c98e6c', hair: '#4a2f22', shoe: '#f4f6fa', sole: '#8d97ad', metal: '#b9c2d6', metalDark: '#6f7a92', pad: '#3d4a6b', padTop: '#5b6b94', plate: '#222836', floor: '#2a3550' };

const NUM_KEYS = ['t', 'ua', 'fa', 'th', 'sh'] as const;
const OPT_KEYS = ['h', 'ua2', 'fa2', 'th2', 'sh2', 'ft', 'ft2', 'lift', 'shr'] as const;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Posa intermedia tra due pose (k da 0 a 1): ogni angolo si interpola; gli attrezzi restano quelli della posa di partenza. */
export function blendPose(a: Pose, b: Pose | undefined, k: number): Pose {
  if (!b) return a;
  const out: Pose = { ...a };
  for (const n of NUM_KEYS) out[n] = lerp(a[n], b[n], k);
  for (const n of OPT_KEYS) {
    const av = a[n] ?? (n === 'ft' || n === 'ft2' ? 90 : n === 'lift' || n === 'shr' ? 0 : undefined), bv = b[n] ?? (n === 'ft' || n === 'ft2' ? 90 : n === 'lift' || n === 'shr' ? 0 : undefined);
    if (av === undefined && bv === undefined) continue;
    /* gli angoli non indicati seguono il valore principale (come fa lo scheletro) */
    const fallA = n === 'h' ? a.t : n === 'ua2' ? a.ua : n === 'fa2' ? a.fa : n === 'th2' ? a.th : n === 'sh2' ? a.sh : 0;
    const fallB = n === 'h' ? b.t : n === 'ua2' ? b.ua : n === 'fa2' ? b.fa : n === 'th2' ? b.th : n === 'sh2' ? b.sh : 0;
    out[n] = lerp(av ?? fallA, bv ?? fallB, k);
  }
  return out;
}

type Kind = 'cyl' | 'sph' | 'box';
const P3 = (p: Pt, z = 0): THREE.Vector3 => new THREE.Vector3(p[0], -p[1], z);

export type Rig = {
  group: THREE.Group;
  /** posa tra partenza (0) e arrivo (1) */
  update: (k: number) => void;
  /** centro e dimensione della scena, per inquadrarla */
  bounds: { center: THREE.Vector3; size: number };
  dispose: () => void;
};

export function buildRig(fam: Family, colors: RigColors = RIG_COLORS): Rig {
  const group = new THREE.Group();
  const geo = { cyl: new THREE.CylinderGeometry(1, 1, 1, 14), sph: new THREE.SphereGeometry(1, 16, 12), box: new THREE.BoxGeometry(1, 1, 1) };
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (hex: string, rough = 0.7, metal = 0) => { const key = `${hex}${rough}${metal}`; let m = mats.get(key); if (!m) { m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal }); mats.set(key, m); } return m; };
  const pool: Record<Kind, THREE.Mesh[]> = { cyl: [], sph: [], box: [] };
  let used: Record<Kind, number> = { cyl: 0, sph: 0, box: 0 };
  const take = (kind: Kind, m: THREE.Material): THREE.Mesh => {
    let mesh = pool[kind][used[kind]];
    if (!mesh) { mesh = new THREE.Mesh(geo[kind], m); pool[kind].push(mesh); group.add(mesh); }
    used[kind]++; mesh.material = m; mesh.visible = true; mesh.rotation.set(0, 0, 0); mesh.quaternion.identity(); return mesh;
  };
  const UP = new THREE.Vector3(0, 1, 0);
  /** cilindro tra due punti con raggi (rx lungo X locale, rz lungo Z locale per il busto largo) */
  const cyl = (a: THREE.Vector3, b: THREE.Vector3, rx: number, m: THREE.Material, rz = rx) => {
    const mesh = take('cyl', m); const d = b.clone().sub(a); const len = Math.max(0.01, d.length());
    mesh.position.copy(a).add(b).multiplyScalar(0.5); mesh.quaternion.setFromUnitVectors(UP, d.normalize()); mesh.scale.set(rx, len, rz);
  };
  const sph = (c: THREE.Vector3, r: number, m: THREE.Material, sx = 1, sy = 1, sz = 1) => { const mesh = take('sph', m); mesh.position.copy(c); mesh.scale.set(r * sx, r * sy, r * sz); };
  const box = (c: THREE.Vector3, w: number, h: number, d: number, m: THREE.Material, rotZ = 0) => { const mesh = take('box', m); mesh.position.copy(c); mesh.scale.set(w, h, d); mesh.rotation.z = rotZ; };
  const limb = (a: THREE.Vector3, b: THREE.Vector3, r1: number, r2: number, m: THREE.Material) => { cyl(a, b, (r1 + r2) / 2, m); sph(a, r1, m); sph(b, r2, m); };

  const SH = 7.6, HP = 4.8; // mezza larghezza di spalle e anche
  const frame = (s: Skeleton, prop: string | undefined, hold: Pose['hold']) => {
    used = { cyl: 0, sph: 0, box: 0 };
    const skin = mat(colors.skin, 0.75), skinD = mat(colors.skinDark, 0.8), shirt = mat(colors.shirt, 0.8), shirtD = mat(colors.shirtDark, 0.85), shorts = mat(colors.shorts, 0.85), shortsD = mat(colors.shortsDark, 0.9), shoe = mat(colors.shoe, 0.6), sole = mat(colors.sole, 0.8);
    const leg = (hip: Pt, k: Pt, a: Pt, toe: Pt, z: number, far: boolean) => {
      const H = P3(hip, z), K = P3(k, z * 0.9), A = P3(a, z * 0.9), T = P3(toe, z * 0.9);
      const m = H.clone().lerp(K, 0.62);
      limb(K, A, 3.3, 2.5, far ? skinD : skin);
      limb(H, K, 5.1, 3.7, far ? skinD : skin);
      cyl(H, m, 5.1, far ? shortsD : shorts); sph(H, 5.1, far ? shortsD : shorts); sph(m, 4.5, far ? shortsD : shorts);
      const dir = T.clone().sub(A); const L = dir.length() || 1; dir.normalize();
      const toeEnd = T.clone().add(dir.clone().multiplyScalar(3));
      const heel = A.clone().sub(dir.clone().multiplyScalar(1.6));
      cyl(heel, toeEnd, 2.6, far ? sole : shoe, 2.9); sph(toeEnd, 2.6, far ? sole : shoe, 1, 1, 1.1);
      void L;
    };
    const arm = (S: Pt, e: Pt, w: Pt, z: number, far: boolean) => {
      const Sh = P3(S, z), E = P3(e, z * 1.1), W = P3(w, z * 1.1), M = Sh.clone().lerp(E, 0.9);
      limb(E, W, 2.5, 2, far ? skinD : skin); sph(W, 2.4, far ? skinD : skin);
      limb(Sh, E, 3.9, 3, far ? skinD : skin);
      cyl(Sh, M, 4.4, far ? shirtD : shirt); sph(Sh, 4.8, far ? shirtD : shirt); sph(M, 3.8, far ? shirtD : shirt);
    };
    leg(s.hip, s.far.knee, s.far.ankle, s.far.toe, -HP, true);
    arm(s.neck, s.far.elbow, s.far.wrist, -SH, true);
    /* busto: bacino e petto larghi lateralmente, più stretti in profondità */
    const Hc = P3(s.hip), Sc = P3(s.neck);
    const chest = Hc.clone().lerp(Sc, 0.78), waist = Hc.clone().lerp(Sc, 0.15);
    cyl(Hc, waist, 6.4, shorts, 8.8); cyl(waist, chest, 6.8, shirt, 9.6); cyl(chest, Sc, 7.4, shirt, 11.4);
    sph(Sc, 7.4, shirt, 1, 0.75, 1.55); sph(Hc, 6.3, shorts, 1, 0.8, 1.4);
    leg(s.hip, s.near.knee, s.near.ankle, s.near.toe, HP, false);
    arm(s.neck, s.near.elbow, s.near.wrist, SH, false);
    /* testa */
    const n = new THREE.Vector3(s.head[0] - s.neck[0], -(s.head[1] - s.neck[1]), 0).normalize();
    const face = new THREE.Vector3(n.y, -n.x, 0);
    const Hd = P3(s.head);
    cyl(Sc, Hd, 2.9, skin);
    sph(Hd, 6, skin, 0.98, 1.08, 0.95);
    sph(Hd.clone().add(n.clone().multiplyScalar(1.7)).sub(face.clone().multiplyScalar(1.5)), 6.3, mat(colors.hair, 0.9), 1, 1, 1);
    for (const z of [-2.3, 2.3]) sph(Hd.clone().add(face.clone().multiplyScalar(5.3)).add(n.clone().multiplyScalar(0.8)).add(new THREE.Vector3(0, 0, z)), 0.7, mat('#241c26', 0.5));
    sph(Hd.clone().add(face.clone().multiplyScalar(6)).sub(n.clone().multiplyScalar(0.8)), 1, skinD);

    equipment(s, prop, hold);
  };

  const equipment = (s: Skeleton, prop: string | undefined, hold: Pose['hold']) => {
    const metal = mat(colors.metal, 0.35, 0.7), metalD = mat(colors.metalDark, 0.5, 0.5), pad = mat(colors.pad, 0.9), padT = mat(colors.padTop, 0.9), plate = mat(colors.plate, 0.5, 0.3), hub = mat('#cdd5e6', 0.3, 0.6);
    const Wn = s.near.wrist, Wf = s.far.wrist, Ss = s.neck, Hh = s.hip;
    for (const p of s.props) {
      if (p.k !== 'line') continue;
      const horiz = Math.abs(p.a[1] - p.b[1]) < 0.01, vert = Math.abs(p.a[0] - p.b[0]) < 0.01;
      const x0 = Math.min(p.a[0], p.b[0]), x1 = Math.max(p.a[0], p.b[0]);
      if (prop === 'wall') { box(new THREE.Vector3(p.a[0] - 2, 30, 0), 3, 62, 70, mat('#39425e', 0.95)); continue; }
      if (prop === 'pullbar') { const y = -p.a[1], x = p.a[0] + 16; cyl(new THREE.Vector3(p.a[0], y, -22), new THREE.Vector3(p.a[0], y, 22), 1.4, metal); void x; for (const z of [-22, 22]) { box(new THREE.Vector3(p.a[0], y - 30, z), 3, 62 + y * 0 + 0, 3, metalD); box(new THREE.Vector3(p.a[0], 0.8, z), 10, 1.6, 8, metalD); } continue; }
      if (prop === 'band' || prop === 'rope') { cyl(P3(p.a, 0), P3(p.b, 0), 0.7, mat('#e5528b', 0.6)); continue; }
      if (horiz && p.w >= 3.9) { const y = -p.a[1]; box(new THREE.Vector3((x0 + x1) / 2, y, 0), x1 - x0, 5.5, 15, pad); box(new THREE.Vector3((x0 + x1) / 2, y + 2.4, 0), x1 - x0 - 1, 1.2, 14, padT); continue; }
      if (vert && p.w >= 2.4 && p.w < 3) { const top = -p.a[1], h = Math.max(1, top); for (const z of [-5.5, 5.5]) { box(new THREE.Vector3(p.a[0], h / 2, z), 2.4, h, 2.4, metalD); box(new THREE.Vector3(p.a[0], 0.7, z), 2.4, 1.4, 6, metalD); } continue; }
      cyl(P3(p.a), P3(p.b), p.w / 2, metalD);
    }
    for (const p of s.props) if (p.k === 'circle' && prop === 'band') box(new THREE.Vector3(p.c[0], -p.c[1], 0), 3, 18, 18, metalD);
    if (prop === 'seat') {
      const y = -(Hh[1] + 5);
      box(new THREE.Vector3(Hh[0] - 14, y + 17, 0), 4.5, 36, 16, pad);
      if (hold === 'bar') { const top = new THREE.Vector3(Wn[0], 34, 0); cyl(P3(Wn), top, 0.45, hub); box(top.clone().add(new THREE.Vector3(0, 6, 0)), 10, 8, 14, metalD); box(new THREE.Vector3(Wn[0] + 12, 18, 0), 4, 62, 14, metalD); }
    }
    const barbell = (c: THREE.Vector3) => {
      cyl(c.clone().add(new THREE.Vector3(0, 0, -34)), c.clone().add(new THREE.Vector3(0, 0, 34)), 1.1, metal);
      for (const z of [-26, 26]) for (const [dz, r] of [[0, 9], [2.6, 7]] as [number, number][]) { const e = z < 0 ? -dz : dz; const m = take('cyl', plate); m.position.set(c.x, c.y, z + e); m.rotation.x = Math.PI / 2; m.scale.set(r, 2.2, r); }
    };
    if (hold === 'bar') barbell(P3(Wn));
    if (hold === 'barback') barbell(new THREE.Vector3(Ss[0] - 1, -(Ss[1] - 2), 0));
    if (hold === 'db') for (const W of [Wn, Wf]) { const c = P3(W, W === Wn ? SH * 1.1 : -SH * 1.1); cyl(c.clone().add(new THREE.Vector3(0, 0, -3.4)), c.clone().add(new THREE.Vector3(0, 0, 3.4)), 0.9, metal); for (const dz of [-3.6, 3.6]) { const m = take('cyl', plate); m.position.set(c.x, c.y, c.z + dz); m.rotation.x = Math.PI / 2; m.scale.set(3.6, 1.6, 3.6); } }
    if (hold === 'ball') sph(P3(Wn), 6, mat('#e5528b', 0.6));
  };

  const prop = fam.a.prop ?? fam.prop;
  const sks: { s: Skeleton; p: Pose }[] = [fam.a, ...(fam.b ? [fam.b] : [])].map((p) => ({ s: skeleton(p, p.prop ?? fam.prop), p }));
  /* inquadratura: la scena più grande tra le due pose */
  const box3 = new THREE.Box3();
  for (const { s } of sks) {
    const pts: Pt[] = [s.head, s.neck, s.hip, ...Object.values(s.near), ...Object.values(s.far)];
    for (const pr of s.props) { if (pr.k === 'line') pts.push(pr.a, pr.b); else pts.push(pr.c); }
    for (const q of pts) box3.expandByPoint(new THREE.Vector3(q[0], -q[1], 0));
  }
  box3.expandByPoint(new THREE.Vector3(box3.min.x, 0, -20)); box3.expandByPoint(new THREE.Vector3(box3.max.x, 0, 20));
  const center = box3.getCenter(new THREE.Vector3()), size = Math.max(box3.max.x - box3.min.x, box3.max.y - box3.min.y) * 1.15 + 16;

  /* pavimento: disco che dà un appoggio alla figura */
  const floorMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 40), mat(colors.floor, 0.95));
  floorMesh.position.set(center.x, -0.4, 0); floorMesh.scale.set(size * 0.62, 1, size * 0.62); group.add(floorMesh);

  const update = (k: number) => {
    const p = blendPose(fam.a, fam.b, Math.max(0, Math.min(1, k)));
    const s = skeleton(p, fam.a.prop ?? fam.prop);
    frame(s, prop, fam.a.hold ?? p.hold);
    for (const kind of ['cyl', 'sph', 'box'] as Kind[]) for (let i = used[kind]; i < pool[kind].length; i++) pool[kind][i].visible = false;
  };
  update(0);
  return {
    group, update, bounds: { center, size },
    dispose: () => { for (const g of Object.values(geo)) g.dispose(); floorMesh.geometry.dispose(); for (const m of mats.values()) m.dispose(); },
  };
}
