/**
 * Sol de fondation : contraintes au niveau de la base et dimensions efficaces.
 *
 * Unites : m, kN, kPa, kN/m3. Angles en radians.
 *
 * EN 1997-3:2025, annexe B (contraintes de base) et 5.5 pour les dimensions
 * efficaces d'une semelle.
 */

function positif(v: number, nom: string, unite: string): number {
  if (!(Number.isFinite(v) && v > 0)) throw new Error(`${nom} doit être un nombre strictement positif (${unite}).`);
  return v;
}

function positifOuNul(v: number, nom: string, unite: string): number {
  if (!(Number.isFinite(v) && v >= 0)) throw new Error(`${nom} doit être un nombre positif ou nul (${unite}).`);
  return v;
}

export interface DonneesBase {
  /** Profondeur de la base sous le terrain naturel (m). */
  D: number;
  /** Profondeur de la nappe sous le terrain naturel, ou null (m). */
  Dw: number | null;
  gamma: number;
  gammaSat: number;
  gammaW: number;
  /** Largeur de la semelle (m). */
  B: number;
}

export interface ContraintesBase {
  /** Contrainte effective a la base (kPa). */
  qEff: number;
  /** Contrainte totale a la base (kPa). */
  qTot: number;
  /** Pression interstitielle a la base (kPa). */
  u: number;
  /** Poids volumique effectif retenu pour la portance (kN/m3). */
  gammaEff: number;
}

/**
 * Contraintes verticales a la base d'une semelle, EN 1997-3 B.4(7).
 *
 * Le poids volumique effectif gammaEff sert a la portance : il vaut gamma'
 * sous la nappe, gamma au-dessus de son influence, et il est interpole entre
 * les deux sur une hauteur de 1,5 B sous la base.
 */
export function contraintesBase(d: DonneesBase): ContraintesBase {
  const D = positif(d.D, 'La profondeur de la base D', 'm');
  const gamma = positif(d.gamma, 'Le poids volumique gamma', 'kN/m3');
  const gammaSat = positif(d.gammaSat, 'Le poids volumique sature gammaSat', 'kN/m3');
  const gammaW = positif(d.gammaW, "Le poids volumique de l'eau gammaW", 'kN/m3');
  const B = positif(d.B, 'La largeur B', 'm');
  const gp = gammaSat - gammaW;

  if (d.Dw === null) {
    return { qEff: gamma * D, qTot: gamma * D, u: 0, gammaEff: gamma };
  }
  const Dw = positifOuNul(d.Dw, 'La profondeur de la nappe Dw', 'm');
  if (Dw < D) {
    return {
      qEff: gamma * Dw + gp * (D - Dw),
      qTot: gamma * Dw + gammaSat * (D - Dw),
      u: gammaW * (D - Dw),
      gammaEff: gp,
    };
  }
  if (Dw < D + 1.5 * B) {
    const rapport = (Dw - D) / (1.5 * B);
    return { qEff: gamma * D, qTot: gamma * D, u: 0, gammaEff: gp + (gamma - gp) * rapport };
  }
  return { qEff: gamma * D, qTot: gamma * D, u: 0, gammaEff: gamma };
}

export interface DimensionsEfficaces {
  /** Largeur efficace B' = B - 2 eB (m). */
  Bp: number;
  /** Longueur efficace L' = L - 2 eL, ou null pour une semelle filante (m). */
  Lp: number | null;
  /** Aire efficace par metre de semelle filante, ou aire totale (m2 ou m2/m). */
  A: number;
  /** Vrai si les cotes ont ete echangees pour garder B' <= L'. */
  permute: boolean;
  /** Vrai si une dimension efficace est nulle ou negative. */
  horsBase: boolean;
}

/**
 * Dimensions efficaces d'une semelle rectangulaire ou filante, EN 1997-3 5.5.
 *
 * Filante : L = null, eL est ignore, A = B' par metre de semelle. Une
 * resultante hors de la base ne leve pas : A = 0 et horsBase = true.
 */
export function dimensionsEfficaces(B: number, L: number | null, eB: number, eL: number): DimensionsEfficaces {
  const b = positif(B, 'La largeur B', 'm');
  const eb = positifOuNul(eB, "L'excentricite eB", 'm');

  if (L === null) {
    const bp = b - 2 * eb;
    const horsBase = bp <= 0;
    return { Bp: bp, Lp: null, A: horsBase ? 0 : bp, permute: false, horsBase };
  }

  const l = positif(L, 'La longueur L', 'm');
  const el = positifOuNul(eL, "L'excentricite eL", 'm');
  let bp = b - 2 * eb;
  let lp = l - 2 * el;
  let permute = false;
  if (lp < bp) {
    const tmp = bp;
    bp = lp;
    lp = tmp;
    permute = true;
  }
  const horsBase = bp <= 0 || lp <= 0;
  return { Bp: bp, Lp: lp, A: horsBase ? 0 : bp * lp, permute, horsBase };
}

/**
 * Angle theta entre l'axe de L' et la resultante T, EN 1997-3 B.4.
 * Sans permutation : atan2(|TB|, |TL|) ; avec permutation : atan2(|TL|, |TB|).
 * T nul : pi/2 (valeur par defaut, charge sans composante horizontale).
 */
export function angleChargeT(TB: number, TL: number, permute: boolean): number {
  if (!Number.isFinite(TB) || !Number.isFinite(TL)) {
    throw new Error("Les composantes de l'effort T doivent être des nombres finis (kN).");
  }
  if (TB === 0 && TL === 0) return Math.PI / 2;
  return permute
    ? Math.atan2(Math.abs(TL), Math.abs(TB))
    : Math.atan2(Math.abs(TB), Math.abs(TL));
}
