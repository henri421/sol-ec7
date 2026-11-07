// Tests d'acceptation du paquet sol-ec7, lot sol renforce (PLAN.md de sol-renforce, T1) :
// zones de materiau et forces des armatures dans Bishop (EN 1997-3:2025, annexe F.3.1).
// Attendus calcules a part (Bishop independant a 4000 tranches, sans le code du paquet).
// A ne pas modifier.
import { describe, expect, it } from 'vitest';
import {
  analyserCercle,
  rechercherCercleCritique,
  type CombinaisonStabilite,
  type CoucheTalus,
  type DonneesBishop,
  type Renfort,
  type ZoneMateriau,
} from '../src/index';

const RAD = Math.PI / 180;
const proche = (x: number, attendu: number, rel = 0.005) =>
  expect(Math.abs(x - attendu) / Math.abs(attendu)).toBeLessThanOrEqual(rel);

function combinaison(nom: string, mode: 'effets' | 'actions', gG: number, gQ: number, gPhi: number): CombinaisonStabilite {
  const v = (valeur: number) => ({ valeur, source: 'test' });
  return {
    nom,
    mode,
    actions: { gG_dst: v(gG), gG_stb: v(1), gQ_dst: v(gQ), gQ_stb: v(0) },
    sol: { gPhi: v(gPhi), gC: v(gPhi), gCu: v(1.4) },
    gRe: v(1),
  };
}
const NEUTRE = combinaison('neutre', 'actions', 1, 1, 1);

// Mur de 6 m : massif renforce (x de 0 a 4,2 m, au-dessus de y = 0) entre un remblai retenu et
// le sol de fondation ; parement presque vertical de (0 ; 0,5) a (0,01 ; 6).
const H = 6;
const L = 4.2;
const RETENU: CoucheTalus = { nom: 'Remblai retenu', base: 0, gamma: 18, gammaSat: 18, drainage: 'draine', phi: 30 * RAD, c: 0 };
const FONDATION: CoucheTalus = { nom: 'Fondation', base: -18, gamma: 19, gammaSat: 19, drainage: 'draine', phi: 32 * RAD, c: 0 };
const RENFORCE: CoucheTalus = { nom: 'Remblai renforce', base: 0, gamma: 19, gammaSat: 19, drainage: 'draine', phi: 36 * RAD, c: 0 };
const ZONE: ZoneMateriau = { xMin: 0, xMax: L, yMin: 0, couche: RENFORCE };

/** Lits a 0,375 + 0,75 k ; Rt et arrachement par metre de longueur ancree (feuillards, FHWA). */
function renforts(gPhiPo: number, gRt: number, gRpo: number): Renfort[] {
  const Rt = 175.22111;
  const mu0 = 1.2 + Math.log10(4);
  const muZ0 = Math.tan(36 * RAD);
  const out: Renfort[] = [];
  for (let k = 0; k < 8; k++) {
    const y = 0.375 + 0.75 * k;
    const z = H - y;
    const mu = mu0 + ((muZ0 - mu0) * Math.min(z, 6)) / 6;
    const rpo = (4 * 2 * 0.05 * (mu / gPhiPo) * (19 * z + 5)) / gRpo;
    out.push({ y, x0: 0, x1: L, Rt: Rt / gRt, rpo });
  }
  return out;
}

function mur(extra: Partial<DonneesBishop> = {}): DonneesBishop {
  return {
    profil: [{ x: -12, y: 0.5 }, { x: 0, y: 0.5 }, { x: 0.01, y: H }, { x: L + 18, y: H }],
    couches: [RETENU, FONDATION],
    piezo: null,
    gammaW: 9.81,
    bandes: [
      { x0: 0, x1: L + 18, q: 5, nature: 'G' },
      { x0: 0, x1: L + 18, q: 10, nature: 'Q' },
    ],
    combinaison: NEUTRE,
    // Parement presque vertical : 400 tranches pour rester a 0,5 % de la reference.
    nbTranches: 400,
    ...extra,
  };
}
const C1 = { xc: -3, yc: 8, R: 8.6 };

function valide(d: DonneesBishop, c = C1) {
  const r = analyserCercle(d, c);
  if (!r.valide) throw new Error(`cercle invalide : ${r.motif}`);
  return r;
}

describe('T1 : zones de materiau', () => {
  it('sans zone, le remblai retenu remplit tout le dessus de y = 0', () => {
    proche(valide(mur()).F, 1.165181);
  });

  it('la zone remplace le materiau dans son emprise, pour le poids comme pour la base', () => {
    const r = valide(mur({ zones: [ZONE] }));
    proche(r.F, 1.337669);
    const dans = r.tranches.find((t) => t.x > 0.5 && t.x < 4 && t.yBase > 0);
    expect(dans?.materiau).toBe('Remblai renforce');
  });

  it('une zone incoherente est refusee', () => {
    expect(() => analyserCercle(mur({ zones: [{ ...ZONE, xMin: 5, xMax: 1 }] }), C1)).toThrow(/zone/);
  });
});

describe('T1 : forces des armatures (annexe F.3.1)', () => {
  it('caracteristique : quatre lits coupes, force = min(Rt ; rpo (x1 - xCoupe))', () => {
    const r = valide(mur({ zones: [ZONE], renforts: renforts(1, 1, 1) }));
    proche(r.F, 2.160652);
    expect(r.renforts.map((f) => f.y)).toEqual([0.375, 1.125, 1.875, 2.625]);
    proche(r.renforts[0].xCoupe, 0.977358);
    proche(r.renforts[0].T, 114.471042);
    proche(r.renforts[3].T, 16.107019);
  });

  it('mode actions (VC3 + M2) : forces de calcul fournies, phi divise par 1,25', () => {
    const r = valide(mur({ zones: [ZONE], renforts: renforts(1.25, 1, 1), combinaison: combinaison('VC3 + M2', 'actions', 1, 1.3, 1.25) }));
    proche(r.F, 1.696775);
  });

  it('mode effets (DA1-1) : les forces des armatures ne sont pas multipliees', () => {
    const r = valide(mur({ zones: [ZONE], renforts: renforts(1, 1.1, 1.35), combinaison: combinaison('DA1-1', 'effets', 1.35, 1.5, 1) }));
    proche(r.F, 1.347847);
  });

  it('un cercle qui ne coupe aucun lit ne recoit aucune force', () => {
    const r = valide(mur({ zones: [ZONE], renforts: renforts(1, 1, 1) }), { xc: 2, yc: 12, R: 14 });
    proche(r.F, 2.621185);
    expect(r.renforts).toEqual([]);
  });

  it('glissement vers les x croissants : armatures ignorees', () => {
    const d: DonneesBishop = {
      ...mur({ zones: [ZONE], renforts: renforts(1, 1, 1) }),
      profil: [{ x: -10, y: H }, { x: L, y: H }, { x: L + 0.01, y: 0.5 }, { x: L + 12, y: 0.5 }],
      bandes: [],
    };
    const r = valide(d, { xc: 5, yc: 9, R: 9.5 });
    expect(r.sens).toBe(-1);
    proche(r.F, 1.668678);
    expect(r.renforts).toEqual([]);
  });

  it('un renfort incoherent est refuse', () => {
    const r0 = renforts(1, 1, 1)[0];
    expect(() => analyserCercle(mur({ renforts: [{ ...r0, x0: 5, x1: 1 }] }), C1)).toThrow(/renfort/);
    expect(() => analyserCercle(mur({ renforts: [{ ...r0, Rt: -1 }] }), C1)).toThrow(/renfort/);
    expect(() => analyserCercle(mur({ renforts: [{ ...r0, rpo: -1 }] }), C1)).toThrow(/renfort/);
  });

  it('sans renforts ni zones, le champ renforts est vide et le calcul inchange', () => {
    const r = valide(mur());
    expect(r.renforts).toEqual([]);
  });

  it('la recherche du cercle critique tient compte des armatures', () => {
    const sans = rechercherCercleCritique(mur({ zones: [ZONE] }));
    const avec = rechercherCercleCritique(mur({ zones: [ZONE], renforts: renforts(1, 1, 1) }));
    expect(sans).not.toBeNull();
    expect(avec).not.toBeNull();
    expect(avec!.resultat.F).toBeGreaterThanOrEqual(sans!.resultat.F - 1e-9);
    const refait = analyserCercle(mur({ zones: [ZONE], renforts: renforts(1, 1, 1) }), avec!.cercle);
    expect(refait.valide && refait.F).toBeCloseTo(avec!.resultat.F, 10);
  });
});
