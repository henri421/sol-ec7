/**
 * Stabilite generale d'un talus, d'un deblai ou d'un remblai en deformation plane :
 * methode de Bishop simplifiee sur des cercles (EN 1997-1:2004, section 11 et
 * annexe A ; EN 1997-3:2025, 4.6.3). Noyau pur, sans dependance.
 *
 * Unites : m, kN/m, kPa, kN/m3 ; angles en radians. x horizontal croissant, y altitude.
 * Tranches : W poids propre du sol (kN/m), G surcharge permanente (kN/m), Q surcharge
 * variable (kN/m), toutes caracteristiques ; u pression interstitielle a la base (kPa).
 *
 * Choix de modelisation : arc de glissement = partie de l'arc inferieur du cercle sous
 * le terrain, sans reprise de la partie superieure ; tranches a midpoint, poids integre
 * par morceaux entre les couches et la ligne piezometrique, ce qui suit la geometrie
 * au nombre de tranches retenu.
 */
import type { CombinaisonStabilite } from './coefficients';

export interface Point {
  x: number;
  y: number;
}

/** Couche a limites horizontales, cotes de base, triees du haut vers le bas. */
export interface CoucheTalus {
  nom: string;
  /** Cote de la base de la couche (m). */
  base: number;
  gamma: number;
  gammaSat: number;
  drainage: 'draine' | 'non_draine';
  /** Draine : phi' en radians, dans ]0 ; pi/2[. */
  phi?: number;
  /** Draine : c' >= 0 (kPa). */
  c?: number;
  /** Non draine : cu > 0 (kPa). */
  cu?: number;
}

/** Bande de charge uniforme sur le terrain, q en kPa, nature permanente (G) ou variable (Q). */
export interface Bande {
  x0: number;
  x1: number;
  q: number;
  nature: 'G' | 'Q';
}

export interface Cercle {
  xc: number;
  yc: number;
  R: number;
}

/**
 * Materiau impose dans x in [xMin ; xMax] et y >= yMin (massif renforce). Hors de toute
 * zone, la couche de la hauteur s'applique. Premiere zone qui contient un point : elle gagne.
 */
export interface ZoneMateriau {
  xMin: number;
  xMax: number;
  yMin: number;
  couche: CoucheTalus;
}

/**
 * Lit d'armatures horizontal, de x0 a x1 a la cote y. Rt (kN/m) et rpo (kN/m par metre
 * ancre) sont des valeurs de calcul, deja divisees par leurs gammas. Annexe F.3.1 de
 * l'EN 1997-3:2025 : ces forces entrent dans Bishop sans multiplication par gammaG ni gammaQ.
 */
export interface Renfort {
  y: number;
  x0: number;
  x1: number;
  Rt: number;
  rpo: number;
}

export interface DonneesBishop {
  profil: Point[];
  couches: CoucheTalus[];
  /** Ligne piezometrique polyligne, ou null (sol sec). */
  piezo: Point[] | null;
  gammaW: number;
  bandes: Bande[];
  combinaison: CombinaisonStabilite;
  /** Nombre de tranches, defaut 50 : le meme pour la recherche et le cercle rendu. */
  nbTranches?: number;
  /** Zones de materiau (massif renforce) ; absent ou vide : couches seules. */
  zones?: ZoneMateriau[];
  /** Lits d'armatures ; absent ou vide : aucune force. */
  renforts?: Renfort[];
}

export interface Tranche {
  /** Milieu de la tranche (m). */
  x: number;
  b: number;
  ySol: number;
  yBase: number;
  /** Pente de la base (rad), positive quand la base remonte vers la droite. */
  alpha: number;
  W: number;
  G: number;
  Q: number;
  /** Vrai si la surcharge variable est comptee (faux si elle stabilise). */
  qRetenue: boolean;
  u: number;
  materiau: string;
  mAlpha: number;
}

export type ResultatCercle =
  | {
      valide: true;
      F: number;
      taux: number;
      sens: 1 | -1;
      momentMoteur: number;
      tranches: Tranche[];
      avertissements: string[];
      /** Armatures comptees dans le cercle (sens = +1 seulement) ; [] sinon. */
      renforts: { y: number; xCoupe: number; T: number }[];
    }
  | { valide: false; motif: string };

export interface OptionsRecherche {
  coteLimite?: number;
  /**
   * Abscisse maximale de l'extremite gauche de l'arc (m). Ecarte les cercles qui sortent plus
   * a droite, par exemple par un parement retenu (mur en sol renforce : sortie au pied ou devant).
   */
  xGaucheMax?: number;
}

const NB_TRANCHES_DEFAUT = 50;
const ITERATIONS_MAX = 200;
const TOLERANCE_F = 1e-7;
/** Borne basse de m_alpha : une sortie plus raide est bornee, avec avertissement. */
const M_ALPHA_MIN = 0.2;
const EPS = 1e-9;

/** Interpolation lineaire sur une polyligne ; hors de son emprise, prolongement horizontal. */
function interpoler(pts: Point[], x: number): number {
  if (x <= pts[0].x) return pts[0].y;
  const dernier = pts[pts.length - 1];
  if (x >= dernier.x) return dernier.y;
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i];
    const q = pts[i + 1];
    if (x <= q.x) return p.y + ((q.y - p.y) * (x - p.x)) / (q.x - p.x);
  }
  return dernier.y;
}

/** Cote de l'arc inferieur du cercle en x (x dans [xc - R ; xc + R]). */
function ordonneeArc(c: Cercle, x: number): number {
  return c.yc - Math.sqrt(Math.max(0, c.R * c.R - (x - c.xc) * (x - c.xc)));
}

/** Leve sur une saisie incoherente, en nommant la grandeur fautive. */
function verifierDonnees(d: DonneesBishop): number {
  const n = d.nbTranches ?? NB_TRANCHES_DEFAUT;
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('Le nombre de tranches doit être un entier au moins égal à 1.');
  }
  if (!d.profil || d.profil.length < 2) {
    throw new Error('Le profil du talus doit compter au moins 2 points.');
  }
  for (let i = 1; i < d.profil.length; i++) {
    if (!(d.profil[i].x > d.profil[i - 1].x)) {
      throw new Error('Les x du profil doivent être strictement croissants.');
    }
  }
  if (!d.couches || d.couches.length === 0) {
    throw new Error('Au moins une couche est nécessaire.');
  }
  d.couches.forEach((c, k) => {
    if (!(c.gamma > 0) || !(c.gammaSat > 0)) {
      throw new Error(`Les poids volumiques de la couche ${c.nom} doivent être strictement positifs (kN/m³).`);
    }
    if (k > 0 && !(c.base < d.couches[k - 1].base)) {
      throw new Error(`Les cotes de base des couches doivent être strictement décroissantes, du haut vers le bas (couche ${c.nom}).`);
    }
    if (c.drainage === 'draine') {
      if (c.phi === undefined || !(c.phi > 0 && c.phi < Math.PI / 2)) {
        throw new Error(`L'angle de frottement φ' de la couche ${c.nom} doit être dans ]0 ; π/2[ (rad).`);
      }
      if (c.c === undefined) {
        throw new Error(`La cohésion c' de la couche ${c.nom} est absente.`);
      }
      if (!(c.c >= 0)) {
        throw new Error(`La cohésion c' de la couche ${c.nom} doit être positive ou nulle (kPa).`);
      }
    } else {
      if (c.cu === undefined || !(c.cu > 0)) {
        throw new Error(`La résistance non drainée cu de la couche ${c.nom} doit être strictement positive (kPa).`);
      }
    }
  });
  if (d.piezo) {
    if (d.piezo.length < 2) {
      throw new Error('La ligne piézométrique doit compter au moins 2 points.');
    }
    for (let i = 1; i < d.piezo.length; i++) {
      if (!(d.piezo[i].x > d.piezo[i - 1].x)) {
        throw new Error('Les x de la ligne piézométrique doivent être strictement croissants.');
      }
    }
  }
  if (!(d.gammaW > 0)) {
    throw new Error('Le poids volumique de l\'eau doit être strictement positif (kN/m³).');
  }
  for (const bd of d.bandes) {
    if (!(bd.x0 < bd.x1)) {
      throw new Error('Une bande de charge doit avoir x0 < x1.');
    }
    if (!(bd.q >= 0)) {
      throw new Error('La charge q d\'une bande doit être positive ou nulle (kPa).');
    }
  }
  for (const z of d.zones ?? []) {
    if (!(z.xMin < z.xMax)) {
      throw new Error('Une zone de matériau doit avoir xMin < xMax (m).');
    }
    const cz = z.couche;
    if (!(cz.gamma > 0) || !(cz.gammaSat > 0)) {
      throw new Error(`Les poids volumiques de la couche ${cz.nom} de la zone doivent être strictement positifs (kN/m³).`);
    }
    if (cz.drainage === 'draine') {
      if (cz.phi === undefined || !(cz.phi > 0 && cz.phi < Math.PI / 2)) {
        throw new Error(`L'angle de frottement φ' de la couche ${cz.nom} de la zone doit être dans ]0 ; π/2[ (rad).`);
      }
      if (cz.c === undefined || !(cz.c >= 0)) {
        throw new Error(`La cohésion c' de la couche ${cz.nom} de la zone doit être positive ou nulle (kPa).`);
      }
    } else if (cz.cu === undefined || !(cz.cu > 0)) {
      throw new Error(`La résistance non drainée cu de la couche ${cz.nom} de la zone doit être strictement positive (kPa).`);
    }
  }
  for (const r of d.renforts ?? []) {
    if (!Number.isFinite(r.y) || !Number.isFinite(r.x0) || !Number.isFinite(r.x1)) {
      throw new Error('Les cote et abscisses d\'un renfort doivent être finies (m).');
    }
    if (!(r.x0 < r.x1)) {
      throw new Error('Un renfort doit avoir x0 < x1 (m).');
    }
    if (!(r.Rt >= 0)) {
      throw new Error('La résistance de calcul Rt d\'un renfort doit être positive ou nulle (kN/m).');
    }
    if (!(r.rpo >= 0)) {
      throw new Error('La résistance d\'arrachement rpo d\'un renfort doit être positive ou nulle (kN/m par m ancré).');
    }
  }
  return n;
}

function verifierCercle(c: Cercle): void {
  if (!Number.isFinite(c.xc) || !Number.isFinite(c.yc)) {
    throw new Error('Le centre du cercle doit avoir des coordonnées finies (m).');
  }
  if (!(c.R > 0) || !Number.isFinite(c.R)) {
    throw new Error('Le rayon du cercle doit être strictement positif (m).');
  }
}

/**
 * Arc de glissement : partie de l'arc inferieur du cercle sous le terrain. Rend
 * l'abscisse de ses deux extremites, ou le motif d'invalidite. Les racines sont
 * calculees exactement sur chaque segment du profil (intersection droite-cercle) ;
 * le signe de « terrain - arc » est lu au milieu de chaque morceau.
 */
function arcSousTerrain(profil: Point[], c: Cercle): { xa: number; xb: number } | string {
  const { xc, yc, R } = c;
  const X0 = profil[0].x;
  const X1 = profil[profil.length - 1].x;
  const gauche = xc - R;
  const droite = xc + R;
  const fg = Math.max(gauche, X0);
  const fd = Math.min(droite, X1);
  if (!(fg < fd)) return 'le cercle ne coupe pas le terrain';

  const bornes = [fg, fd];
  for (let i = 0; i + 1 < profil.length; i++) {
    const p = profil[i];
    const q = profil[i + 1];
    const s = (q.y - p.y) / (q.x - p.x);
    const b0 = p.y - s * p.x;
    const A = 1 + s * s;
    const B = 2 * (s * (b0 - yc) - xc);
    const C = xc * xc + (b0 - yc) * (b0 - yc) - R * R;
    const disc = B * B - 4 * A * C;
    if (disc < 0) continue;
    const racine = Math.sqrt(disc);
    for (const x of [(-B - racine) / (2 * A), (-B + racine) / (2 * A)]) {
      if (x < Math.max(p.x, fg) - EPS || x > Math.min(q.x, fd) + EPS) continue;
      const xr = Math.min(Math.max(x, fg), fd);
      // Seule la moitie inferieure du cercle borne le glissement.
      if (s * xr + b0 <= yc + EPS) bornes.push(xr);
    }
  }
  bornes.sort((a, b) => a - b);
  const points: number[] = [];
  for (const x of bornes) {
    if (points.length === 0 || x - points[points.length - 1] > EPS) points.push(x);
  }

  const morceaux: [number, number][] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    const m = (a + b) / 2;
    const g = interpoler(profil, m) - ordonneeArc(c, m);
    if (g > EPS) {
      const dernier = morceaux[morceaux.length - 1];
      if (dernier && dernier[1] === a) dernier[1] = b;
      else morceaux.push([a, b]);
    }
  }
  if (morceaux.length === 0) return 'le cercle ne coupe pas le terrain';
  if (morceaux.length > 1) return 'le cercle coupe le terrain en plusieurs points';
  const [xa, xb] = morceaux[0];
  if (xa <= X0 + EPS || xb >= X1 - EPS) return 'l\'arc de glissement sort du profil';
  if (xa <= gauche + EPS || xb >= droite - EPS) {
    return 'l\'arc ne rejoint pas le terrain (le cercle reste sous le terrain)';
  }
  return { xa, xb };
}

/** Indice de la couche qui contient la cote y (la premiere dont la base est sous y). */
function indiceCouche(couches: CoucheTalus[], y: number): number {
  for (let k = 0; k < couches.length; k++) {
    if (couches[k].base <= y) return k;
  }
  return couches.length - 1;
}

/**
 * Poids de la colonne par unite de largeur de tranche (kPa = kN/m3 x m).
 * Chaque couche est decoupee par la ligne piezometrique : gamma au-dessus, gammaSat
 * au-dessous. L'eau au-dessus du terrain n'ajoute pas de poids (avertissement).
 */
function poidsColonne(couches: CoucheTalus[], yb: number, ys: number, pz: number): number {
  let surface = 0;
  for (let k = 0; k < couches.length; k++) {
    const haut = k === 0 ? Infinity : couches[k - 1].base;
    const bas = k === couches.length - 1 ? -Infinity : couches[k].base;
    const lo = Math.max(yb, bas);
    const hi = Math.min(ys, haut);
    if (hi <= lo) continue;
    const sat = Math.max(0, Math.min(hi, pz) - lo);
    const sec = hi - lo - sat;
    surface += couches[k].gamma * sec + couches[k].gammaSat * sat;
  }
  return surface;
}

/**
 * Couche qui porte le point (x, y) : la premiere zone qui le contient, sinon la couche de
 * la hauteur. Sans zone, rend la meme couche que indiceCouche.
 */
function coucheEn(d: DonneesBishop, x: number, y: number): CoucheTalus {
  for (const z of d.zones ?? []) {
    if (x >= z.xMin && x <= z.xMax && y >= z.yMin) return z.couche;
  }
  return d.couches[indiceCouche(d.couches, y)];
}

/**
 * Poids de colonne en présence de zones. La colonne est découpée aux cotes des couches,
 * des zones et de la piézométrique ; chaque morceau prend le poids volumique de la couche
 * qui porte son milieu. Même convention que poidsColonne (kPa = kN/m3 x m).
 */
function poidsColonneZones(d: DonneesBishop, xm: number, yb: number, ys: number, pz: number): number {
  if (!(ys > yb)) return 0;
  const coupures = [yb, ys];
  for (const c of d.couches) coupures.push(c.base);
  for (const z of d.zones ?? []) coupures.push(z.yMin);
  if (Number.isFinite(pz)) coupures.push(pz);
  const pts = coupures
    .filter((y) => y >= yb && y <= ys)
    .sort((a, b) => a - b)
    .filter((y, i, tab) => i === 0 || y - tab[i - 1] > EPS);
  let surface = 0;
  for (let k = 0; k + 1 < pts.length; k++) {
    const lo = pts[k];
    const hi = pts[k + 1];
    const couche = coucheEn(d, xm, (lo + hi) / 2);
    const sat = Math.max(0, Math.min(hi, pz) - lo);
    const sec = hi - lo - sat;
    surface += couche.gamma * sec + couche.gammaSat * sat;
  }
  return surface;
}

/**
 * Analyse d'un cercle, donnees deja verifiees. Bishop simplifie :
 * F = [sum T_i / m_i(F)] / sum(W_i sin alpha_i), iteree jusqu'a |dF| < 1e-7.
 * T_i = c_d b + (W_i - u_i b) tan phi_d (drainee) ; T_i = c_u,d b (non drainee).
 * m_i = cos alpha_i + sens sin alpha_i tan phi_d / F. Les surcharges variables suivent
 * le sens du glissement : tranche motrice (sin alpha du meme signe que le sens) ou
 * stabilisatrice (gamma_Q,stb = 0). Mode « effets » (DA1-1, DA2) : gamma_G,dst porte
 * sur l'effet, le moment moteur net des charges permanentes (poids du sol, action de
 * source unique), pas tranche par tranche ; le numerateur garde les poids
 * caracteristiques (EN 1997-1:2004, 2.4.7.3.2 et 11.5.1).
 */
function analyser(d: DonneesBishop, c: Cercle, n: number): ResultatCercle {
  const arc = arcSousTerrain(d.profil, c);
  if (typeof arc === 'string') return { valide: false, motif: arc };

  const b = (arc.xb - arc.xa) / n;
  const avertissements: string[] = [];
  const tranches: Tranche[] = [];
  const couchesBase: CoucheTalus[] = [];
  let sommeCharge = 0;
  let eauAuDessus = false;
  const avecZones = (d.zones?.length ?? 0) > 0;

  for (let i = 0; i < n; i++) {
    const xm = arc.xa + (i + 0.5) * b;
    const ys = interpoler(d.profil, xm);
    const yb = ordonneeArc(c, xm);
    const alpha = Math.asin(Math.min(1, Math.max(-1, (xm - c.xc) / c.R)));
    const pz = d.piezo ? interpoler(d.piezo, xm) : -Infinity;
    if (pz > ys + EPS) eauAuDessus = true;
    const W = b * (avecZones ? poidsColonneZones(d, xm, yb, ys, pz) : poidsColonne(d.couches, yb, ys, pz));
    const u = pz > yb ? d.gammaW * (pz - yb) : 0;
    let G = 0;
    let Q = 0;
    for (const bd of d.bandes) {
      const recouvrement = Math.max(0, Math.min(bd.x1, xm + b / 2) - Math.max(bd.x0, xm - b / 2));
      if (bd.nature === 'G') G += bd.q * recouvrement;
      else Q += bd.q * recouvrement;
    }
    const coucheBase = coucheEn(d, xm, yb);
    couchesBase.push(coucheBase);
    tranches.push({
      x: xm, b, ySol: ys, yBase: yb, alpha, W, G, Q,
      qRetenue: true, u, materiau: coucheBase.nom, mAlpha: 0,
    });
    sommeCharge += (W + G + Q) * Math.sin(alpha);
  }
  if (eauAuDessus) {
    avertissements.push('eau au-dessus du terrain : son poids et sa poussée ne sont pas modélisés');
  }

  const sens: 1 | -1 = sommeCharge >= 0 ? 1 : -1;
  const cb = d.combinaison;
  const actions = cb.actions;
  const surEffets = cb.mode === 'effets';

  // Facteurs de charges et numerateur (charges factorisees, ou caracteristiques en mode effets).
  const Wn: number[] = [];
  let moment = 0;
  for (let i = 0; i < n; i++) {
    const t = tranches[i];
    const sinA = Math.sin(t.alpha);
    const motrice = sinA * sens >= 0;
    t.qRetenue = motrice;
    const gG = motrice || surEffets ? actions.gG_dst.valeur : actions.gG_stb.valeur;
    const gQ = motrice ? actions.gQ_dst.valeur : actions.gQ_stb.valeur;
    const charges = gG * (t.W + t.G) + gQ * t.Q;
    Wn.push(surEffets ? t.W + t.G + (motrice ? t.Q : 0) : charges);
    moment += charges * sinA;
  }
  const D = sens * moment;
  if (!(D > 0)) {
    return { valide: false, motif: 'moment moteur nul ou négatif dans le sens du glissement' };
  }

  // Termes resistants T_i et tangentes de calcul par tranche.
  const tanPhi: number[] = [];
  const T: number[] = [];
  const cosA: number[] = [];
  const sinA: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = tranches[i];
    const couche = couchesBase[i];
    cosA.push(Math.cos(t.alpha));
    sinA.push(Math.sin(t.alpha));
    if (couche.drainage === 'draine') {
      const tp = Math.tan(couche.phi as number) / cb.sol.gPhi.valeur;
      const cd = (couche.c as number) / cb.sol.gC.valeur;
      tanPhi.push(tp);
      // Effort normal effectif borne a 0 : une sous-pression superieure au poids ne cree
      // pas de frottement negatif.
      T.push(cd * t.b + Math.max(0, Wn[i] - t.u * t.b) * tp);
    } else {
      tanPhi.push(0);
      T.push(((couche.cu as number) / cb.sol.gCu.valeur) * t.b);
    }
  }

  // Armatures (EN 1997-3:2025, annexe F.3.1) : comptees seulement si sens = +1, avec
  // T = min(Rt ; rpo (x1 - xCoupe)) sans multiplication par gammaG ni gammaQ. Le point de
  // coupe est a l'arriere du cercle : xCoupe = xc + sqrt(R^2 - (yc - y)^2).
  const armatures: { y: number; xCoupe: number; T: number }[] = [];
  let momentArmatures = 0;
  if (sens === 1) {
    for (const r of d.renforts ?? []) {
      if (!(r.y < c.yc)) continue;
      const dy = c.yc - r.y;
      if (!(c.R * c.R - dy * dy > 0)) continue;
      const xCoupe = c.xc + Math.sqrt(c.R * c.R - dy * dy);
      if (!(r.x0 < xCoupe && xCoupe < r.x1)) continue;
      if (!(arc.xa <= xCoupe && xCoupe <= arc.xb)) continue;
      const Tr = Math.min(r.Rt, r.rpo * (r.x1 - xCoupe));
      armatures.push({ y: r.y, xCoupe, T: Tr });
      momentArmatures += Tr * dy;
    }
  }

  // alpha est compte positif dans le sens du glissement (sens * sin alpha, comme dans D).
  const mAlpha = (i: number, F: number): number => cosA[i] + (sens * sinA[i] * tanPhi[i]) / F;
  let F = 1;
  let converge = false;
  for (let it = 0; it < ITERATIONS_MAX; it++) {
    let numerateur = 0;
    for (let i = 0; i < n; i++) {
      numerateur += T[i] / Math.max(M_ALPHA_MIN, mAlpha(i, F));
    }
    // F = [R sum(T/m) + sum(T_arm (yc - y))] / (R sum moteur) ; D = sum moteur.
    const Fn = (numerateur + momentArmatures / c.R) / D;
    if (!Number.isFinite(Fn) || Fn <= 0) {
      return { valide: false, motif: 'F non physique (numérateur nul ou négatif)' };
    }
    if (Math.abs(Fn - F) < TOLERANCE_F) {
      F = Fn;
      converge = true;
      break;
    }
    F = Fn;
  }
  if (!converge) {
    return { valide: false, motif: `Bishop ne converge pas en ${ITERATIONS_MAX} itérations` };
  }

  let sortieRaide = false;
  for (let i = 0; i < n; i++) {
    const brut = mAlpha(i, F);
    if (brut < M_ALPHA_MIN) sortieRaide = true;
    tranches[i].mAlpha = Math.max(M_ALPHA_MIN, brut);
  }
  if (sortieRaide) {
    avertissements.push('m_α borné à 0,2 : sortie de glissement raide');
  }

  return {
    valide: true,
    F,
    taux: cb.gRe.valeur / F,
    sens,
    momentMoteur: D * c.R,
    tranches,
    avertissements,
    renforts: armatures,
  };
}

/**
 * Stabilite d'un cercle donne : F, taux = gamma_R;e / F, tranches et avertissements.
 * Rend { valide: false, motif } pour un cercle sans arc de glissement valable (hors
 * du terrain, sortie du profil, non convergence, moment moteur nul). Leve sur une
 * saisie incoherente (profil, couches, bandes, cercle), en francais.
 */
export function analyserCercle(d: DonneesBishop, c: Cercle): ResultatCercle {
  const n = verifierDonnees(d);
  verifierCercle(c);
  return analyser(d, c, n);
}

/**
 * Recherche du cercle critique : grille de centres au-dessus du profil et de rayons
 * balayes jusqu'a la cote limite, puis raffinement par motifs (pas divise par 2 jusqu'a
 * 0,05 m) depuis les trois meilleurs cercles de la grille. Les cercles invalides sont
 * ecartes. Le resultat rendu est celui de analyserCercle sur le cercle rendu, au meme
 * nombre de tranches. Cote limite par defaut : la plus haute de la base de la derniere
 * couche et de y_bas - 3H (H = hauteur du profil). Rend null si aucun cercle n'est valide.
 * Point de depart : fondbis, src/briques/stabiliteGenerale.ts, adapte au noyau.
 */
export function rechercherCercleCritique(
  d: DonneesBishop,
  o: OptionsRecherche = {}
): { cercle: Cercle; resultat: Extract<ResultatCercle, { valide: true }>; nbCercles: number } | null {
  const n = verifierDonnees(d);
  const profil = d.profil;
  const xMin = profil[0].x;
  const xMax = profil[profil.length - 1].x;
  const yHaut = Math.max(...profil.map((p) => p.y));
  const yBas = Math.min(...profil.map((p) => p.y));
  const H = Math.max(yHaut - yBas, (xMax - xMin) / 10, 1);
  const coteLimite = o.coteLimite ?? Math.max(d.couches[d.couches.length - 1].base, yBas - 3 * H);

  let nbCercles = 0;
  const evaluer = (c: Cercle): Extract<ResultatCercle, { valide: true }> | null => {
    if (c.R <= 0.1 || c.yc - c.R < coteLimite - EPS) return null;
    nbCercles++;
    const r = analyser(d, c, n);
    if (!r.valide) return null;
    if (o.xGaucheMax !== undefined) {
      const t0 = r.tranches[0];
      if (t0.x - t0.b / 2 > o.xGaucheMax + EPS) return null;
    }
    return r;
  };

  // 1. Grille de centres et de rayons.
  const candidats: { c: Cercle; F: number }[] = [];
  const nx = 14;
  const ny = 8;
  const nr = 10;
  for (let i = 0; i <= nx; i++) {
    const xc = xMin + ((xMax - xMin) * i) / nx;
    for (let j = 0; j <= ny; j++) {
      const yc = yHaut + 0.2 * H + (2.8 * H * j) / ny;
      const rMin = yc - yHaut + 0.05 * H;
      const rMax = yc - coteLimite;
      if (rMax <= rMin) continue;
      for (let k = 0; k <= nr; k++) {
        const c: Cercle = { xc, yc, R: rMin + ((rMax - rMin) * k) / nr };
        const r = evaluer(c);
        if (r) candidats.push({ c, F: r.F });
      }
    }
  }
  if (candidats.length === 0) return null;
  candidats.sort((a, b) => a.F - b.F);

  // 2. Raffinement par motifs depuis les trois meilleurs.
  const pasInitial = Math.max((xMax - xMin) / nx, H / 4);
  const directions = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [0, 1, 1], [0, -1, -1],
  ];
  let meilleur = candidats[0];
  for (const depart of candidats.slice(0, 3)) {
    let courant = depart;
    let pas = pasInitial;
    let coups = 0;
    while (pas > 0.05 && coups < 2000) {
      let ameliore = false;
      for (const [dxc, dyc, dR] of directions) {
        const c: Cercle = {
          xc: courant.c.xc + dxc * pas,
          yc: courant.c.yc + dyc * pas,
          R: courant.c.R + dR * pas,
        };
        const r = evaluer(c);
        if (r && r.F < courant.F - 1e-6) {
          courant = { c, F: r.F };
          ameliore = true;
          coups++;
        }
      }
      if (!ameliore) pas /= 2;
    }
    if (courant.F < meilleur.F) meilleur = courant;
  }

  const resultat = analyser(d, meilleur.c, n);
  if (!resultat.valide) return null;
  return { cercle: meilleur.c, resultat, nbCercles };
}
