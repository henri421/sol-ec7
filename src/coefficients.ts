/**
 * Coefficients partiels du paquet sol-ec7.
 *
 * 1re generation : jeux A, M et R de l'EN 1997-1:2004, annexe A, et leur
 * assemblage en approches de calcul (2.4.7.3.4).
 * 2e generation : EN 1990:2023 (tableaux A.1.8 et A.1.9), EN 1997-1:2024
 * (tableaux 4.8 a 4.10) et EN 1997-3:2025 (tableau 5.2).
 *
 * Valeurs RECOMMANDEES, que l'annexe nationale peut modifier. Chaque valeur
 * porte sa source ; une valeur sans source bloque le calcul.
 *
 * Grandeurs sans dimension.
 */

export interface ValeurSourcee {
  valeur: number;
  source: string;
}

/** Jeu d'actions : permanentes et variable, defavorables et favorables. */
export interface JeuActions {
  gG_dst: ValeurSourcee;
  gG_stb: ValeurSourcee;
  gQ_dst: ValeurSourcee;
  /** Une action variable favorable n'est pas prise : 0. */
  gQ_stb: ValeurSourcee;
}

/** Jeu de materiaux : tan phi', c' et cu sont divises par ces coefficients. */
export interface JeuSol {
  gPhi: ValeurSourcee;
  gC: ValeurSourcee;
  gCu: ValeurSourcee;
}

/** Jeu de resistances de la fondation superficielle (tableau A.5). */
export interface JeuResistance {
  gRv: ValeurSourcee;
  gRh: ValeurSourcee;
}

/** Une combinaison a verifier, coefficients resolus. */
export interface Combinaison {
  nom: string;
  /** Terres et surcharge, transmises par le sol. */
  geotechnique: JeuActions;
  /** Poids du beton. Differe du precedent en DA3 seulement. */
  structure: JeuActions;
  sol: JeuSol;
  resistance: JeuResistance;
}

export interface Profil1g {
  nom: string;
  date: string;
  /** Renversement : tableaux A.1 et A.2. */
  EQU: { actions: JeuActions; sol: JeuSol };
  A1: JeuActions;
  A2: JeuActions;
  M1: JeuSol;
  M2: JeuSol;
  R1: JeuResistance;
  R2: JeuResistance;
  R3: JeuResistance;
}

export interface Profil2g {
  nom: string;
  date: string;
  kF: Record<ClasseConsequences, ValeurSourcee>;
  kM: Record<ClasseConsequences, ValeurSourcee>;
  kR: Record<ClasseConsequences, ValeurSourcee>;
  /** VC1 et VC4 : gamma_G (ou gamma_E) et gamma_Q, avant k_F. */
  gG: ValeurSourcee;
  gQ: ValeurSourcee;
  gG_fav: ValeurSourcee;
  /** VC2(a) : partie stabilisatrice d'une action de source unique. */
  gG_stb_VC2a: ValeurSourcee;
  /** VC3 : sans k_F. */
  gG_VC3: ValeurSourcee;
  gQ_VC3: ValeurSourcee;
  /** Jeu M2 sur tan phi', c' et tan delta, avant k_M. */
  gM2: ValeurSourcee;
  gRN: ValeurSourcee;
  gRT: ValeurSourcee;
  /** Jeu M2 sur cu (EN 1997-1:2024, tableau 4.8). */
  gCuM2: ValeurSourcee;
}

export type Approche = 'DA1' | 'DA2' | 'DA3';
export type Approche2e = 'a+b' | 'c' | 'd';
export type ClasseConsequences = 'CC1' | 'CC2' | 'CC3';

function actions(source: string, gG_dst: number, gG_stb: number, gQ_dst: number): JeuActions {
  return {
    gG_dst: { valeur: gG_dst, source },
    gG_stb: { valeur: gG_stb, source },
    gQ_dst: { valeur: gQ_dst, source },
    gQ_stb: { valeur: 0, source: `${source} (action variable favorable : 0)` },
  };
}

function sol(source: string, gPhi: number, gC: number, gCu: number, precision = ''): JeuSol {
  const s = precision === '' ? source : `${source}, ${precision}`;
  return { gPhi: { valeur: gPhi, source: s }, gC: { valeur: gC, source: s }, gCu: { valeur: gCu, source: s } };
}

function resistance(source: string, gRv: number, gRh: number): JeuResistance {
  return { gRv: { valeur: gRv, source }, gRh: { valeur: gRh, source } };
}

/**
 * Profil 1re generation, valeurs recommandees de l'annexe A de l'EN 1997-1:2004.
 * gCu vaut 1,0 en M1 et 1,4 en M2 (tableau A.4) ; il vaut 1,4 en EQU (A.2).
 */
export function profil1g(): Profil1g {
  const tA1 = 'EN 1997-1:2004, tableau A.1, valeur recommandée';
  const tA2 = 'EN 1997-1:2004, tableau A.2, valeur recommandée';
  const tA3 = 'EN 1997-1:2004, tableau A.3, valeur recommandée';
  const tA4 = 'EN 1997-1:2004, tableau A.4, valeur recommandée';
  const tA5 = 'EN 1997-1:2004, tableau A.5, valeur recommandée';
  return {
    nom: 'EN 1997-1:2004, valeurs recommandées',
    date: '2026-11-04',
    EQU: {
      actions: actions(tA1, 1.1, 0.9, 1.5),
      sol: sol(tA2, 1.25, 1.25, 1.4),
    },
    A1: actions(`${tA3}, jeu A1`, 1.35, 1.0, 1.5),
    A2: actions(`${tA3}, jeu A2`, 1.0, 1.0, 1.3),
    M1: sol(tA4, 1.0, 1.0, 1.0, 'jeu M1'),
    M2: sol(tA4, 1.25, 1.25, 1.4, 'jeu M2'),
    R1: resistance(`${tA5}, jeu R1`, 1.0, 1.0),
    R2: resistance(`${tA5}, jeu R2`, 1.4, 1.1),
    R3: resistance(`${tA5}, jeu R3`, 1.0, 1.0),
  };
}

function verifierValeur(nom: string, v: ValeurSourcee): void {
  if (!v || !Number.isFinite(v.valeur) || v.valeur < 0) {
    throw new Error(`Profil : ${nom} n'est pas un nombre positif.`);
  }
  if (typeof v.source !== 'string' || v.source.trim() === '') {
    throw new Error(`Profil : ${nom} n'a pas de source ; une valeur sans provenance bloque le calcul.`);
  }
}

/** Leve en nommant la premiere valeur non numerique ou sans source. */
export function verifierProfil1g(p: Profil1g): void {
  const jeux: [string, object][] = [
    ['EQU actions', p.EQU.actions], ['EQU sol', p.EQU.sol],
    ['A1', p.A1], ['A2', p.A2], ['M1', p.M1], ['M2', p.M2], ['R1', p.R1], ['R2', p.R2], ['R3', p.R3],
  ];
  for (const [nom, j] of jeux) {
    for (const [cle, v] of Object.entries(j) as [string, ValeurSourcee][]) {
      verifierValeur(`${cle} (${nom})`, v);
    }
  }
}

/** Leve en nommant la premiere valeur non numerique ou sans source. */
export function verifierProfil2g(p: Profil2g): void {
  for (const [cle, x] of Object.entries(p)) {
    if (cle === 'nom' || cle === 'date') continue;
    if (cle === 'kF' || cle === 'kM' || cle === 'kR') {
      for (const [cc, v] of Object.entries(x as Record<string, ValeurSourcee>)) {
        verifierValeur(`${cle} ${cc}`, v);
      }
    } else {
      verifierValeur(cle, x as ValeurSourcee);
    }
  }
}

/**
 * Les combinaisons d'une approche, EN 1997-1 2.4.7.3.4.
 *
 * DA3 : A1 sur les actions de structure et A2 sur les actions geotechniques.
 */
export function combinaisons1g(approche: Approche, p: Profil1g): Combinaison[] {
  if (approche === 'DA1') {
    return [
      { nom: 'DA1-1', geotechnique: p.A1, structure: p.A1, sol: p.M1, resistance: p.R1 },
      { nom: 'DA1-2', geotechnique: p.A2, structure: p.A2, sol: p.M2, resistance: p.R1 },
    ];
  }
  if (approche === 'DA2') {
    return [{ nom: 'DA2', geotechnique: p.A1, structure: p.A1, sol: p.M1, resistance: p.R2 }];
  }
  return [{ nom: 'DA3', geotechnique: p.A2, structure: p.A1, sol: p.M2, resistance: p.R3 }];
}

const SOURCE_90 = 'EN 1990:2023, tableau A.1.8, valeur recommandée';
const SOURCE_97_3 = 'EN 1997-3:2025, tableau 5.2, valeur recommandée';

function parClasse(source: string, cc1: number, cc2: number, cc3: number): Record<ClasseConsequences, ValeurSourcee> {
  return { CC1: { valeur: cc1, source }, CC2: { valeur: cc2, source }, CC3: { valeur: cc3, source } };
}

/**
 * Profil 2e generation, valeurs recommandees : EN 1990:2023, EN 1997-1:2024 et
 * EN 1997-3:2025. gCuM2 = 1,4 (EN 1997-1:2024, tableau 4.8, jeu M2).
 */
export function profil2g(): Profil2g {
  const v = (valeur: number, source: string): ValeurSourcee => ({ valeur, source });
  return {
    nom: 'EN 1990:2023 et EN 1997:2024-2025, valeurs recommandées',
    date: '2026-11-04',
    kF: parClasse('EN 1990:2023, tableau A.1.9, valeur recommandée', 0.9, 1.0, 1.1),
    kM: parClasse('EN 1997-1:2024, tableau 4.9, valeur recommandée', 0.9, 1.0, 1.1),
    kR: parClasse('EN 1997-1:2024, tableau 4.10, valeur recommandée', 0.9, 1.0, 1.1),
    gG: v(1.35, SOURCE_90),
    gQ: v(1.5, SOURCE_90),
    gG_fav: v(1.0, SOURCE_90),
    gG_stb_VC2a: v(1.15, SOURCE_90),
    gG_VC3: v(1.0, SOURCE_90),
    gQ_VC3: v(1.3, SOURCE_90),
    gM2: v(1.25, 'EN 1997-1:2024, tableau 4.8, valeur recommandée, jeu M2'),
    gRN: v(1.4, SOURCE_97_3),
    gRT: v(1.1, SOURCE_97_3),
    gCuM2: v(1.4, 'EN 1997-1:2024, tableau 4.8, valeur recommandée, jeu M2'),
  };
}

function fois(v: ValeurSourcee, k: ValeurSourcee): ValeurSourcee {
  return { valeur: v.valeur * k.valeur, source: `${v.source} × facteur de conséquence, ${k.source}` };
}

function actions2g(gG: ValeurSourcee, gG_fav: ValeurSourcee, gQ: ValeurSourcee): JeuActions {
  return {
    gG_dst: gG,
    gG_stb: gG_fav,
    gQ_dst: gQ,
    gQ_stb: { valeur: 0, source: `${gQ.source} (action variable favorable : 0)` },
  };
}

/**
 * Les combinaisons du tableau 5.2 de l'EN 1997-3:2025 : (a) VC1 + M1,
 * (b) VC3 + M2, (c) VC1 + M2 sans k_M, (d) VC1 et resistances avec k_R.
 * Pas de (e) : VC4 est hors perimetre.
 */
export function combinaisons2g(approche: Approche2e, cc: ClasseConsequences, p: Profil2g): Combinaison[] {
  const kF = p.kF[cc];
  const vc1 = actions2g(fois(p.gG, kF), p.gG_fav, fois(p.gQ, kF));
  const vc3 = actions2g(p.gG_VC3, p.gG_fav, p.gQ_VC3);
  const un: ValeurSourcee = { valeur: 1, source: 'EN 1997-1:2024, tableau 4.8, jeu M1' };
  const unRes: JeuResistance = {
    gRv: { valeur: 1, source: 'EN 1997-3:2025, tableau 5.2, sans coefficient' },
    gRh: { valeur: 1, source: 'EN 1997-3:2025, tableau 5.2, sans coefficient' },
  };
  const m1: JeuSol = { gPhi: un, gC: un, gCu: un };
  const m2k = fois(p.gM2, p.kM[cc]);
  const m2: JeuSol = { gPhi: m2k, gC: m2k, gCu: fois(p.gCuM2, p.kM[cc]) };
  if (approche === 'a+b') {
    return [
      { nom: '(a)', geotechnique: vc1, structure: vc1, sol: m1, resistance: unRes },
      { nom: '(b)', geotechnique: vc3, structure: vc3, sol: m2, resistance: unRes },
    ];
  }
  if (approche === 'c') {
    return [{
      nom: '(c)',
      geotechnique: vc1,
      structure: vc1,
      sol: { gPhi: p.gM2, gC: p.gM2, gCu: p.gCuM2 },
      resistance: unRes,
    }];
  }
  const kR = p.kR[cc];
  return [{
    nom: '(d)',
    geotechnique: vc1,
    structure: vc1,
    sol: m1,
    resistance: { gRv: fois(p.gRN, kR), gRh: fois(p.gRT, kR) },
  }];
}
