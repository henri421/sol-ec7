/**
 * Portance d'une fondation superficielle.
 *
 * Unites : m, kN, kPa, kN/m3. Angles en radians.
 *
 * 1re generation : EN 1997-1:2004, annexe D.
 * 2e generation : EN 1997-3:2025, formule (5.5) et annexe B.
 */

function positif(v: number, nom: string, unite: string): number {
  if (!(Number.isFinite(v) && v > 0)) throw new Error(`${nom} doit être un nombre strictement positif (${unite}).`);
  return v;
}

function positifOuNul(v: number, nom: string, unite: string): number {
  if (!(Number.isFinite(v) && v >= 0)) throw new Error(`${nom} doit être un nombre positif ou nul (${unite}).`);
  return v;
}

function verifierPhi(phi: number): number {
  if (!(Number.isFinite(phi) && phi > 0 && phi < Math.PI / 2)) {
    throw new Error("L'angle de frottement phi doit être strictement positif et inferieur a pi/2 (rad).");
  }
  return phi;
}

export interface FacteursPortance {
  Nq: number;
  Nc: number;
  Ngamma: number;
}

/**
 * Facteurs de portance, 1re generation (EN 1997-1 annexe D) :
 * Nq = e^(pi tan phi) tan^2(pi/4 + phi/2), Nc = (Nq - 1)/tan phi,
 * Ngamma = 2 (Nq - 1) tan phi (base rugueuse).
 */
export function facteursPortance1g(phi: number): FacteursPortance {
  const p = verifierPhi(phi);
  const t = Math.tan(p);
  const Nq = Math.exp(Math.PI * t) * Math.tan(Math.PI / 4 + p / 2) ** 2;
  const Nc = (Nq - 1) / t;
  const Ngamma = 2 * (Nq - 1) * t;
  return { Nq, Nc, Ngamma };
}

/**
 * Facteurs de portance, 2e generation (EN 1997-3 B.3) : Nq et Nc identiques,
 * Ngamma = 2 (Nq + 1) tan phi (base rugueuse).
 */
export function facteursPortance2g(phi: number): FacteursPortance {
  const p = verifierPhi(phi);
  const t = Math.tan(p);
  const Nq = Math.exp(Math.PI * t) * Math.tan(Math.PI / 4 + p / 2) ** 2;
  const Nc = (Nq - 1) / t;
  const Ngamma = 2 * (Nq + 1) * t;
  return { Nq, Nc, Ngamma };
}

export interface DonneesPortanceDrainee {
  /** Largeur efficace B' = B - 2 eB (m). */
  Bp: number;
  /** Longueur efficace L', ou null pour une semelle filante (m). */
  Lp: number | null;
  /** Effort horizontal T (kN). */
  T: number;
  /** Effort vertical N (kN). */
  N: number;
  /** Angle de frottement de calcul phi' (rad). */
  phi: number;
  /** Cohesion de calcul c' (kPa). */
  c: number;
  /** Poids volumique effectif sous la base (kN/m3). */
  gammaEff: number;
  /** Contrainte effective au niveau de la base, a cote de la semelle (kPa). */
  q: number;
  /** Angle theta entre l'axe de L' et T (rad), pi/2 par defaut. */
  theta?: number;
}

export interface ResultatPortanceDrainee {
  Nq: number;
  Nc: number;
  Ngamma: number;
  sq: number;
  sc: number;
  sgamma: number;
  iq: number;
  ic: number;
  igamma: number;
  m: number;
  dq: number;
  dc: number;
  /** Resistance du terrain avant gamma_Rv (kPa). */
  q_u: number;
}

function donneesDrainees(d: DonneesPortanceDrainee): void {
  positif(d.Bp, 'La largeur efficace', 'm');
  if (d.Lp !== null) positif(d.Lp, 'La longueur efficace', 'm');
  positifOuNul(d.T, "L'effort horizontal", 'kN');
  positif(d.N, "L'effort vertical", 'kN');
  verifierPhi(d.phi);
  positifOuNul(d.c, 'La cohésion', 'kPa');
  positif(d.gammaEff, 'Le poids volumique effectif', 'kN/m3');
  positifOuNul(d.q, 'La contrainte au niveau de la base', 'kPa');
}

/** Facteurs de forme et d'inclinaison communs aux deux generations. */
function facteursCommuns(d: DonneesPortanceDrainee, Nq: number) {
  const r = d.Lp === null ? 0 : d.Bp / d.Lp;
  const sinPhi = Math.sin(d.phi);
  const sq = 1 + r * sinPhi;
  const sgamma = 1 - 0.3 * r;
  const sc = (sq * Nq - 1) / (Nq - 1);

  let m: number;
  if (d.Lp === null) {
    m = 2;
  } else {
    const mB = (2 + r) / (1 + r);
    const mL = (2 + 1 / r) / (1 + 1 / r);
    const theta = d.theta ?? Math.PI / 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    m = mL * cos * cos + mB * sin * sin;
  }

  const aire = d.Lp === null ? d.Bp : d.Bp * d.Lp;
  return { r, sq, sc, sgamma, m, aire };
}

/**
 * Portance en conditions drainees, 1re generation (EN 1997-1 annexe D,
 * formule D.2). Facteurs de forme D.4, inclinaison D.5 ; pas de facteur de
 * profondeur. Ngamma = 2 (Nq - 1) tan phi'.
 */
export function portanceDrainee1g(d: DonneesPortanceDrainee): ResultatPortanceDrainee {
  donneesDrainees(d);
  const { Nq, Nc, Ngamma } = facteursPortance1g(d.phi);
  const { sq, sc, sgamma, m, aire } = facteursCommuns(d, Nq);
  const t = Math.tan(d.phi);

  const base = Math.max(0, 1 - d.T / (d.N + (aire * d.c) / t));
  const iq = base ** m;
  const igamma = base ** (m + 1);
  const ic = iq - (1 - iq) / (Nc * t);
  const dq = 1;
  const dc = 1;

  const q_u = d.c * Nc * sc * ic * dc + d.q * Nq * sq * iq * dq + 0.5 * d.gammaEff * d.Bp * Ngamma * sgamma * igamma;
  return { Nq, Nc, Ngamma, sq, sc, sgamma, iq, ic, igamma, m, dq, dc, q_u };
}

/**
 * Portance en conditions drainees, 2e generation (EN 1997-3 (5.5) et B.4).
 * Inclinaison i_q = (1 - T/N)^m, sans cohesion. Le facteur de profondeur n'est
 * applique que si Df > 0.
 */
export function portanceDrainee2g(d: DonneesPortanceDrainee & { Df?: number }): ResultatPortanceDrainee {
  donneesDrainees(d);
  if (d.Df !== undefined) positifOuNul(d.Df, 'La profondeur Df', 'm');
  const { Nq, Nc, Ngamma } = facteursPortance2g(d.phi);
  const { sq, sc, sgamma, m } = facteursCommuns(d, Nq);
  const t = Math.tan(d.phi);

  const base = Math.max(0, 1 - d.T / d.N);
  const iq = base ** m;
  const igamma = base ** (m + 1);
  const ic = iq - (1 - iq) / (Nc * t);

  let dq = 1;
  let dc = 1;
  if (d.Df !== undefined && d.Df > 0) {
    const rapport = d.Df / d.Bp;
    const x = rapport <= 1 ? rapport : Math.atan(rapport);
    dq = 1 + 2 * t * (1 - Math.sin(d.phi)) ** 2 * x;
    dc = dq - (1 - dq) / (Nc * t);
  }

  const q_u = d.c * Nc * sc * ic * dc + d.q * Nq * sq * iq * dq + 0.5 * d.gammaEff * d.Bp * Ngamma * sgamma * igamma;
  return { Nq, Nc, Ngamma, sq, sc, sgamma, iq, ic, igamma, m, dq, dc, q_u };
}

export interface DonneesPortanceNonDrainee {
  Bp: number;
  Lp: number | null;
  /** Effort horizontal T (kN). */
  T: number;
  /** Resistance non drainee de calcul cu (kPa). */
  cu: number;
  /** Contrainte totale au niveau de la base, a cote de la semelle (kPa). */
  q: number;
}

export interface DonneesPortanceNonDrainee2g extends DonneesPortanceNonDrainee {
  /** Largeur de la semelle (m), pour le facteur de profondeur. */
  B: number;
  Df?: number;
}

export interface ResultatPortanceNonDrainee {
  sc: number;
  ic: number;
  dc: number;
  q_u: number;
}

function donneesNonDrainees(d: DonneesPortanceNonDrainee): void {
  positif(d.Bp, 'La largeur efficace', 'm');
  if (d.Lp !== null) positif(d.Lp, 'La longueur efficace', 'm');
  positifOuNul(d.T, "L'effort horizontal", 'kN');
  positif(d.cu, 'La cohésion non drainee cu', 'kPa');
  positifOuNul(d.q, 'La contrainte au niveau de la base', 'kPa');
}

/** Facteurs communs non draines, EN 1997-1 annexe D et EN 1997-3 B.5. */
function nonDraine(d: DonneesPortanceNonDrainee) {
  const r = d.Lp === null ? 0 : d.Bp / d.Lp;
  const aire = d.Lp === null ? d.Bp : d.Bp * d.Lp;
  const sc = 1 + 0.2 * r;
  const ic = 0.5 * (1 + Math.sqrt(Math.max(0, 1 - d.T / (aire * d.cu))));
  return { sc, ic };
}

/**
 * Portance en conditions non drainees, 1re generation (EN 1997-1 annexe D) :
 * q_u = (pi + 2) cu sc ic dc + q, sans facteur de profondeur.
 */
export function portanceNonDrainee1g(d: DonneesPortanceNonDrainee): ResultatPortanceNonDrainee {
  donneesNonDrainees(d);
  const { sc, ic } = nonDraine(d);
  const dc = 1;
  const q_u = (Math.PI + 2) * d.cu * sc * ic * dc + d.q;
  return { sc, ic, dc, q_u };
}

/**
 * Portance en conditions non drainees, 2e generation (EN 1997-3 B.5) :
 * dc = 1 + 0,33 atan(Df/B) si Df > 0, sinon 1.
 */
export function portanceNonDrainee2g(d: DonneesPortanceNonDrainee2g): ResultatPortanceNonDrainee {
  donneesNonDrainees(d);
  positif(d.B, 'La largeur B', 'm');
  if (d.Df !== undefined) positifOuNul(d.Df, 'La profondeur Df', 'm');
  const { sc, ic } = nonDraine(d);
  const dc = d.Df !== undefined && d.Df > 0 ? 1 + 0.33 * Math.atan(d.Df / d.B) : 1;
  const q_u = (Math.PI + 2) * d.cu * sc * ic * dc + d.q;
  return { sc, ic, dc, q_u };
}
