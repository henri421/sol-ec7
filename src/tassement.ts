/**
 * Tassements : elasticite, diffusion de Steinbrenner et consolidation
 * oedometrique.
 *
 * Unites : m pour les longueurs, kPa pour les modules et contraintes, mm pour
 * les tassements rendus.
 *
 * EN 1997-3:2025, annexe B (influence Is, tableau B.3) ; diffusion de
 * contraintes par la solution de Steinbrenner sous l'angle d'un rectangle.
 */

function positif(v: number, nom: string, unite: string): number {
  if (!(Number.isFinite(v) && v > 0)) throw new Error(`${nom} doit être un nombre strictement positif (${unite}).`);
  return v;
}

function positifOuNul(v: number, nom: string, unite: string): number {
  if (!(Number.isFinite(v) && v >= 0)) throw new Error(`${nom} doit être un nombre positif ou nul (${unite}).`);
  return v;
}

export type Raideur = 'souple' | 'rigide';

const LSURB = [1, 2, 3, 4, 5, 10];
const IS_SOUPLE = [0.95, 1.3, 1.53, 1.7, 1.83, 2.25];
const IS_RIGIDE = [0.83, 1.21, 1.43, 1.59, 1.72, 2.13];

/**
 * Facteur d'influence Is du tableau B.3 de l'EN 1997-3:2025, interpolation
 * lineaire en L/B, plafonne a L/B = 10 (et ramene a 1 en dessous de 1 pour
 * eviter toute extrapolation).
 *
 * `raideur` : 'souple' pour la semelle souple (valeur moyenne), 'rigide' pour
 * une semelle rigide.
 */
export function influenceIs(LsurB: number, raideur: Raideur): number {
  const x = positif(LsurB, 'Le rapport L/B', '-');
  const table = raideur === 'souple' ? IS_SOUPLE : IS_RIGIDE;
  if (x <= LSURB[0]) return table[0];
  if (x >= LSURB[LSURB.length - 1]) return table[table.length - 1];
  for (let i = 1; i < LSURB.length; i++) {
    if (x <= LSURB[i]) {
      const x0 = LSURB[i - 1];
      const x1 = LSURB[i];
      const y0 = table[i - 1];
      const y1 = table[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1];
}

export interface DonneesTassementElastique {
  /** Contrainte moyenne appliquee (kPa). */
  p: number;
  /** Largeur de la semelle (m). */
  B: number;
  /** Rapport L/B. */
  LsurB: number;
  /** Coefficient de Poisson. */
  nu: number;
  /** Module d'elasticite moyen (kPa). */
  Em: number;
  raideur: Raideur;
}

export interface ResultatTassementElastique {
  Is: number;
  s_mm: number;
}

/**
 * Tassement elastique d'une semelle : s = p B (1 - nu^2) Is / Em,
 * EN 1997-3:2025 annexe B.
 */
export function tassementElastique(d: DonneesTassementElastique): ResultatTassementElastique {
  positif(d.p, 'La contrainte p', 'kPa');
  positif(d.B, 'La largeur B', 'm');
  if (!(Number.isFinite(d.nu) && d.nu >= 0 && d.nu < 0.5)) {
    throw new Error('Le coefficient de Poisson nu doit être compris entre 0 et 0,5 (-).');
  }
  positif(d.Em, "Le module d'élasticité Em", 'kPa');
  const Is = influenceIs(d.LsurB, d.raideur);
  const s_mm = (d.p * d.B * (1 - d.nu * d.nu) * Is * 1000) / d.Em;
  return { Is, s_mm };
}

/**
 * Facteur d'influence de Steinbrenner sous l'angle d'un rectangle charge,
 * en profondeur z : m = b/z, n = l/z, avec
 * I = [2mn r/(r^2 + m^2 n^2) (m^2 + n^2 + 2)/r^2 + theta] / (4 pi),
 * r^2 = m^2 + n^2 + 1, theta = atan2(2mn r, r^2 - m^2 n^2).
 */
export function facteurAngleRectangle(b: number, l: number, z: number): number {
  const bb = positif(b, 'La demi-largeur b', 'm');
  const ll = positif(l, 'La demi-longueur l', 'm');
  const zz = positif(z, 'La profondeur z', 'm');
  const m = bb / zz;
  const n = ll / zz;
  const mn = m * n;
  const r2 = m * m + n * n + 1;
  const r = Math.sqrt(r2);
  let theta = Math.atan2(2 * mn * r, r2 - mn * mn);
  if (theta < 0) theta += Math.PI;
  const I = ((2 * mn * r) / (r2 + mn * mn) * ((m * m + n * n + 2) / r2) + theta) / (4 * Math.PI);
  return I;
}

/**
 * Surcontrainte au centre d'une semelle rectangulaire a la profondeur z :
 * 4 q I(B/2, L/2, z). A z = 0, elle vaut q.
 */
export function surcontrainteCentre(q: number, B: number, L: number, z: number): number {
  positifOuNul(q, 'La surcharge q', 'kPa');
  const b = positif(B, 'La largeur B', 'm');
  const l = positif(L, 'La longueur L', 'm');
  if (z === 0) return q;
  positif(z, 'La profondeur z', 'm');
  return 4 * q * facteurAngleRectangle(b / 2, l / 2, z);
}

/**
 * Surcontrainte sous l'angle d'une semelle rectangulaire a la profondeur z :
 * q I(B, L, z). A z = 0, elle vaut q/4.
 */
export function surcontrainteCoin(q: number, B: number, L: number, z: number): number {
  positifOuNul(q, 'La surcharge q', 'kPa');
  const b = positif(B, 'La largeur B', 'm');
  const l = positif(L, 'La longueur L', 'm');
  if (z === 0) return q / 4;
  positif(z, 'La profondeur z', 'm');
  return q * facteurAngleRectangle(b, l, z);
}

export type RegimeConsolidation = 'surconsolide' | 'normalement_consolide' | 'franchissement';

export interface DonneesOedometre {
  /** Epaisseur de la couche ou de la tranche (m). */
  H: number;
  /** Contrainte effective initiale au milieu (kPa). */
  sigma0: number;
  /** Accroissement de contrainte (kPa). */
  dSigma: number;
  /** Indice de compression. */
  Cc: number;
  /** Indice de gonflement. */
  Cs: number;
  /** Indice des vides initial. */
  e0: number;
  /** Pression de preconsolidation (kPa). */
  sigmaP: number;
}

export interface ResultatOedometre {
  s_mm: number;
  regime: RegimeConsolidation;
}

/**
 * Tassement oedometrique d'une couche, en log10 :
 * surconsolide : H Cs/(1+e0) log10((s0+ds)/s0) ;
 * normalement consolide : H Cc/(1+e0) log10((s0+ds)/s0) ;
 * franchissement : H/(1+e0) [Cs log10(sp/s0) + Cc log10((s0+ds)/sp)].
 */
export function tassementOedometre(d: DonneesOedometre): ResultatOedometre {
  const H = positif(d.H, "L'epaisseur H", 'm');
  const sigma0 = positif(d.sigma0, 'La contrainte initiale sigma0', 'kPa');
  const dSigma = positifOuNul(d.dSigma, "L'accroissement de contrainte dSigma", 'kPa');
  const Cc = positifOuNul(d.Cc, "L'indice de compression Cc", '-');
  const Cs = positifOuNul(d.Cs, "L'indice de gonflement Cs", '-');
  const e0 = positif(d.e0, "L'indice des vides e0", '-');
  const sigmaP = positif(d.sigmaP, 'La pression de préconsolidation sigmaP', 'kPa');
  const sigmaF = sigma0 + dSigma;

  if (sigmaP <= sigma0) {
    const s = ((H * Cc) / (1 + e0)) * Math.log10(sigmaF / sigma0);
    return { s_mm: s * 1000, regime: 'normalement_consolide' };
  }
  if (sigmaF <= sigmaP) {
    const s = ((H * Cs) / (1 + e0)) * Math.log10(sigmaF / sigma0);
    return { s_mm: s * 1000, regime: 'surconsolide' };
  }
  const s = (H / (1 + e0)) * (Cs * Math.log10(sigmaP / sigma0) + Cc * Math.log10(sigmaF / sigmaP));
  return { s_mm: s * 1000, regime: 'franchissement' };
}

export interface Couche {
  /** Epaisseur (m). */
  h: number;
  /** Poids volumique effectif (kN/m3). */
  gammaEff: number;
  Cc: number;
  Cs: number;
  e0: number;
  /** Pression de preconsolidation (kPa), obligatoire et strictement positive. */
  sigmaP: number;
}

export interface DonneesCouches {
  /** Surcharge appliquee a la base (kPa). */
  q: number;
  /** Largeur de la semelle (m). */
  B: number;
  /** Longueur de la semelle, ou null pour une filante (m). */
  L: number | null;
  /** Contrainte effective a la base (kPa). */
  sigmaBase: number;
  couches: Couche[];
  /** Epaisseur maximale d'une tranche (m), 0,25 par defaut. */
  pas?: number;
}

export interface DetailTranche {
  /** Profondeur du milieu de la tranche sous la base (m). */
  z: number;
  sigma0: number;
  dSigmaCentre: number;
  dSigmaCoin: number;
  regime: RegimeConsolidation;
  sCentre_mm: number;
  sCoin_mm: number;
}

export interface ResultatCouches {
  centre_mm: number;
  coin_mm: number;
  detail: DetailTranche[];
}

/**
 * Tassements au centre et sous l'angle d'une semelle, par couches divisees en
 * tranches de pas au plus 0,25 m. Chaque tranche est traitee au milieu, avec la
 * contrainte initiale cumulee depuis la base. L = null : L = 100 B.
 *
 * La pression de préconsolidation est obligatoire : sigmaP <= 0 leve avec le
 * mot « sigma » ; aucune valeur par défaut n'est inventee.
 */
export function tassementCouches(d: DonneesCouches): ResultatCouches {
  positifOuNul(d.q, 'La surcharge q', 'kPa');
  const B = positif(d.B, 'La largeur B', 'm');
  const sigmaBase = positif(d.sigmaBase, 'La contrainte a la base sigmaBase', 'kPa');
  const L = d.L === null ? 100 * B : positif(d.L, 'La longueur L', 'm');
  const pas = positif(d.pas ?? 0.25, 'Le pas de decoupage', 'm');

  for (const c of d.couches) {
    positif(c.h, "L'épaisseur de couche h", 'm');
    positif(c.gammaEff, 'Le poids volumique effectif', 'kN/m3');
    positifOuNul(c.Cc, "L'indice de compression Cc", '-');
    positifOuNul(c.Cs, "L'indice de gonflement Cs", '-');
    positif(c.e0, "L'indice des vides e0", '-');
    if (!(Number.isFinite(c.sigmaP) && c.sigmaP > 0)) {
      throw new Error('La pression de préconsolidation sigmaP doit être un nombre strictement positif (kPa) : aucune valeur par défaut.');
    }
  }

  const detail: DetailTranche[] = [];
  let centre = 0;
  let coin = 0;
  let zCumul = 0;
  let contrainteCumul = 0;

  for (const c of d.couches) {
    const n = Math.ceil(c.h / pas);
    const dz = c.h / n;
    for (let i = 0; i < n; i++) {
      const zLocal = (i + 0.5) * dz;
      const z = zCumul + zLocal;
      const sigma0 = sigmaBase + contrainteCumul + c.gammaEff * zLocal;
      const dSigmaCentre = surcontrainteCentre(d.q, B, L, z);
      const dSigmaCoin = surcontrainteCoin(d.q, B, L, z);
      const rc = tassementOedometre({
        H: dz, sigma0, dSigma: dSigmaCentre, Cc: c.Cc, Cs: c.Cs, e0: c.e0, sigmaP: c.sigmaP,
      });
      const rco = tassementOedometre({
        H: dz, sigma0, dSigma: dSigmaCoin, Cc: c.Cc, Cs: c.Cs, e0: c.e0, sigmaP: c.sigmaP,
      });
      detail.push({
        z,
        sigma0,
        dSigmaCentre,
        dSigmaCoin,
        regime: rc.regime,
        sCentre_mm: rc.s_mm,
        sCoin_mm: rco.s_mm,
      });
      centre += rc.s_mm;
      coin += rco.s_mm;
    }
    zCumul += c.h;
    contrainteCumul += c.gammaEff * c.h;
  }

  return { centre_mm: centre, coin_mm: coin, detail };
}
