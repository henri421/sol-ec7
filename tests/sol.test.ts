// Tests d'acceptation du paquet sol-ec7 (PLAN.md de fondations-superficielles, T1 a T4).
// Valeurs calculees a part, sans le code du paquet. A ne pas modifier.
import { describe, expect, it } from 'vitest';
import {
  angleChargeT,
  combinaisons1g,
  combinaisons2g,
  contraintesBase,
  dimensionsEfficaces,
  facteurAngleRectangle,
  facteursPortance1g,
  facteursPortance2g,
  influenceIs,
  portanceDrainee1g,
  portanceDrainee2g,
  portanceNonDrainee1g,
  portanceNonDrainee2g,
  profil1g,
  profil2g,
  surcontrainteCentre,
  surcontrainteCoin,
  tassementCouches,
  tassementElastique,
  tassementOedometre,
  verifierProfil1g,
  verifierProfil2g,
} from '../src/index';

const RAD = Math.PI / 180;

describe('T1 coefficients, 1re generation', () => {
  const p = profil1g();
  it('DA1 donne deux combinaisons', () => {
    const c = combinaisons1g('DA1', p);
    expect(c.map((x) => x.nom)).toEqual(['DA1-1', 'DA1-2']);
    expect(c[0].structure.gG_dst.valeur).toBe(1.35);
    expect(c[0].sol.gPhi.valeur).toBe(1);
    expect(c[1].structure.gG_dst.valeur).toBe(1);
    expect(c[1].structure.gQ_dst.valeur).toBe(1.3);
    expect(c[1].sol.gPhi.valeur).toBe(1.25);
    expect(c[1].sol.gC.valeur).toBe(1.25);
    expect(c[1].sol.gCu.valeur).toBe(1.4);
  });
  it('DA2 porte R2 sur la resistance', () => {
    const [c] = combinaisons1g('DA2', p);
    expect(c.nom).toBe('DA2');
    expect(c.resistance.gRv.valeur).toBe(1.4);
    expect(c.resistance.gRh.valeur).toBe(1.1);
    expect(c.sol.gCu.valeur).toBe(1);
  });
  it('DA3 distingue actions de structure et actions geotechniques', () => {
    const [c] = combinaisons1g('DA3', p);
    expect(c.structure.gG_dst.valeur).toBe(1.35);
    expect(c.geotechnique.gG_dst.valeur).toBe(1);
    expect(c.sol.gCu.valeur).toBe(1.4);
    expect(c.resistance.gRv.valeur).toBe(1);
  });
  it('une action favorable vaut 1,0 en G et 0 en Q', () => {
    const [c] = combinaisons1g('DA2', p);
    expect(c.structure.gG_stb.valeur).toBe(1);
    expect(c.structure.gQ_stb.valeur).toBe(0);
  });
  it('une valeur sans source bloque', () => {
    const q = profil1g();
    q.M2.gCu = { valeur: 1.4, source: ' ' };
    expect(() => verifierProfil1g(q)).toThrow(/source/);
    expect(() => verifierProfil1g(profil1g())).not.toThrow();
  });
});

describe('T1 coefficients, 2e generation', () => {
  const p = profil2g();
  it('(a) + (b) en CC2', () => {
    const c = combinaisons2g('a+b', 'CC2', p);
    expect(c.map((x) => x.nom)).toEqual(['(a)', '(b)']);
    expect(c[0].structure.gG_dst.valeur).toBeCloseTo(1.35, 6);
    expect(c[0].structure.gQ_dst.valeur).toBeCloseTo(1.5, 6);
    expect(c[0].sol.gPhi.valeur).toBe(1);
    expect(c[1].structure.gG_dst.valeur).toBe(1);
    expect(c[1].structure.gQ_dst.valeur).toBe(1.3);
    expect(c[1].sol.gPhi.valeur).toBeCloseTo(1.25, 6);
    expect(c[1].sol.gCu.valeur).toBeCloseTo(1.4, 6);
  });
  it('(a) + (b) en CC3 : k_F sur VC1, k_M sur M2', () => {
    const c = combinaisons2g('a+b', 'CC3', p);
    expect(c[0].structure.gG_dst.valeur).toBeCloseTo(1.485, 6);
    expect(c[0].structure.gQ_dst.valeur).toBeCloseTo(1.65, 6);
    expect(c[0].structure.gG_stb.valeur).toBe(1);
    expect(c[1].sol.gPhi.valeur).toBeCloseTo(1.375, 6);
    expect(c[1].sol.gCu.valeur).toBeCloseTo(1.54, 6);
  });
  it('(c) omet k_M, garde k_F', () => {
    const [c] = combinaisons2g('c', 'CC3', p);
    expect(c.nom).toBe('(c)');
    expect(c.structure.gG_dst.valeur).toBeCloseTo(1.485, 6);
    expect(c.sol.gPhi.valeur).toBe(1.25);
    expect(c.sol.gCu.valeur).toBe(1.4);
  });
  it('(d) porte les resistances, avec k_R', () => {
    const [cc2] = combinaisons2g('d', 'CC2', p);
    expect(cc2.nom).toBe('(d)');
    expect(cc2.resistance.gRv.valeur).toBeCloseTo(1.4, 6);
    expect(cc2.resistance.gRh.valeur).toBeCloseTo(1.1, 6);
    expect(cc2.sol.gCu.valeur).toBe(1);
    const [cc1] = combinaisons2g('d', 'CC1', p);
    expect(cc1.resistance.gRv.valeur).toBeCloseTo(1.26, 6);
  });
  it('une valeur sans source bloque', () => {
    const q = profil2g();
    q.gCuM2 = { valeur: 1.4, source: '' };
    expect(() => verifierProfil2g(q)).toThrow(/source/);
    expect(() => verifierProfil2g(profil2g())).not.toThrow();
  });
});

describe('T2 contraintes au niveau de la base', () => {
  const base = { D: 1.5, gamma: 18, gammaSat: 20, gammaW: 10, B: 2 };
  it('sans nappe', () => {
    expect(contraintesBase({ ...base, Dw: null })).toEqual({ qEff: 27, qTot: 27, u: 0, gammaEff: 18 });
  });
  it('nappe au-dessus de la base', () => {
    expect(contraintesBase({ ...base, Dw: 1 })).toEqual({ qEff: 23, qTot: 28, u: 5, gammaEff: 10 });
  });
  it('nappe au terrain naturel', () => {
    expect(contraintesBase({ ...base, Dw: 0 })).toEqual({ qEff: 15, qTot: 30, u: 15, gammaEff: 10 });
  });
  it('nappe au niveau de la base', () => {
    expect(contraintesBase({ ...base, Dw: 1.5 })).toEqual({ qEff: 27, qTot: 27, u: 0, gammaEff: 10 });
  });
  it('nappe a 1,5 B sous la base ou plus bas : aucun effet', () => {
    expect(contraintesBase({ ...base, Dw: 4.5 }).gammaEff).toBe(18);
    expect(contraintesBase({ ...base, Dw: 9 }).gammaEff).toBe(18);
  });
  it('nappe entre les deux : interpolation lineaire de gamma*', () => {
    expect(contraintesBase({ ...base, Dw: 3 }).gammaEff).toBeCloseTo(14, 6);
    expect(contraintesBase({ ...base, Dw: 3 }).qEff).toBe(27);
  });
});

describe('T2 dimensions efficaces', () => {
  it('rectangle', () => {
    const d = dimensionsEfficaces(2, 3, 0.25, 0.1);
    expect(d.Bp).toBeCloseTo(1.5, 9);
    expect(d.Lp).toBeCloseTo(2.8, 9);
    expect(d.A).toBeCloseTo(4.2, 9);
    expect(d.permute).toBe(false);
    expect(d.horsBase).toBe(false);
  });
  it('B prime reste le plus petit cote', () => {
    const d = dimensionsEfficaces(2, 2.2, 0, 0.3);
    expect(d.Bp).toBeCloseTo(1.6, 9);
    expect(d.Lp).toBeCloseTo(2, 9);
    expect(d.permute).toBe(true);
  });
  it('filante : L prime nul, aire par metre', () => {
    const d = dimensionsEfficaces(1.5, null, 0.1, 0);
    expect(d.Bp).toBeCloseTo(1.3, 9);
    expect(d.Lp).toBeNull();
    expect(d.A).toBeCloseTo(1.3, 9);
  });
  it('resultante hors de la base', () => {
    const d = dimensionsEfficaces(2, 3, 1.2, 0);
    expect(d.horsBase).toBe(true);
    expect(d.A).toBe(0);
  });
  it('angle entre l axe de L prime et T', () => {
    expect(angleChargeT(100, 0, false)).toBeCloseTo(Math.PI / 2, 9);
    expect(angleChargeT(0, 100, false)).toBeCloseTo(0, 9);
    expect(angleChargeT(0, 100, true)).toBeCloseTo(Math.PI / 2, 9);
    expect(angleChargeT(100, 0, true)).toBeCloseTo(0, 9);
    expect(angleChargeT(0, 0, false)).toBeCloseTo(Math.PI / 2, 9);
  });
});

describe('T3 portance', () => {
  it('facteurs, valeurs publiees a phi = 30 et 35', () => {
    const a = facteursPortance1g(30 * RAD);
    expect(a.Nq).toBeCloseTo(18.401, 2);
    expect(a.Nc).toBeCloseTo(30.14, 2);
    expect(a.Ngamma).toBeCloseTo(20.093, 2);
    expect(facteursPortance1g(35 * RAD).Ngamma).toBeCloseTo(45.228, 2);
    expect(facteursPortance2g(30 * RAD).Ngamma).toBeCloseTo(22.402, 2);
    expect(facteursPortance2g(35 * RAD).Ngamma).toBeCloseTo(48.029, 2);
  });
  it('1re generation, filante sans inclinaison', () => {
    const r = portanceDrainee1g({ Bp: 2, Lp: null, T: 0, N: 500, phi: 30 * RAD, c: 0, gammaEff: 18, q: 18 });
    expect(r.q_u).toBeCloseTo(692.896, 2);
    expect(r.sq).toBe(1);
    expect(r.m).toBe(2);
  });
  it('1re generation, rectangle, cohesion et T selon B', () => {
    const r = portanceDrainee1g({ Bp: 2, Lp: 4, T: 100, N: 800, phi: 28 * RAD, c: 10, gammaEff: 19, q: 15 });
    expect(r.sq).toBeCloseTo(1.2347, 3);
    expect(r.sc).toBeCloseTo(1.2518, 3);
    expect(r.sgamma).toBeCloseTo(0.85, 6);
    expect(r.m).toBeCloseTo(1.6667, 3);
    expect(r.iq).toBeCloseTo(0.8309, 3);
    expect(r.ic).toBeCloseTo(0.8185, 3);
    expect(r.igamma).toBeCloseTo(0.7435, 3);
    expect(r.q_u).toBeCloseTo(666.1, 1);
  });
  it('1re generation, T selon L', () => {
    const r = portanceDrainee1g({ Bp: 2, Lp: 4, T: 100, N: 800, phi: 28 * RAD, c: 10, gammaEff: 19, q: 15, theta: 0 });
    expect(r.m).toBeCloseTo(1.3333, 3);
    expect(r.q_u).toBeCloseTo(692.136, 1);
  });
  it('2e generation, rectangle et profondeur', () => {
    const r = portanceDrainee2g({ Bp: 2, Lp: 4, T: 100, N: 800, phi: 28 * RAD, c: 10, gammaEff: 19, q: 15, Df: 1 });
    expect(r.iq).toBeCloseTo(0.8005, 3);
    expect(r.dq).toBeCloseTo(1.1497, 3);
    expect(r.dc).toBeCloseTo(1.1606, 3);
    expect(r.q_u).toBeCloseTo(734.617, 1);
  });
  it('2e generation, Df superieur a B prime', () => {
    const r = portanceDrainee2g({ Bp: 1, Lp: null, T: 0, N: 300, phi: 30 * RAD, c: 0, gammaEff: 18, q: 36, Df: 2 });
    expect(r.dq).toBeCloseTo(1.3196, 3);
    expect(r.q_u).toBeCloseTo(1075.783, 1);
  });
  it('2e generation sans Df : aucun facteur de profondeur', () => {
    const r = portanceDrainee2g({ Bp: 2, Lp: 4, T: 100, N: 800, phi: 28 * RAD, c: 10, gammaEff: 19, q: 15 });
    expect(r.dq).toBe(1);
    expect(r.dc).toBe(1);
  });
  it('non drainee, deux generations', () => {
    const a = portanceNonDrainee1g({ Bp: 2, Lp: 4, T: 50, cu: 50, q: 20 });
    expect(a.sc).toBeCloseTo(1.1, 6);
    expect(a.ic).toBeCloseTo(0.9677, 3);
    expect(a.q_u).toBeCloseTo(293.656, 2);
    const b = portanceNonDrainee2g({ Bp: 2, Lp: 4, T: 50, cu: 50, q: 20, B: 2.5, Df: 1 });
    expect(b.dc).toBeCloseTo(1.1256, 3);
    expect(b.q_u).toBeCloseTo(328.018, 2);
    expect(portanceNonDrainee2g({ Bp: 2, Lp: 4, T: 50, cu: 50, q: 20, B: 2.5 }).dc).toBe(1);
  });
  it('non drainee : T au-dela de A prime c_u ne rend pas NaN', () => {
    const a = portanceNonDrainee1g({ Bp: 1, Lp: null, T: 80, cu: 50, q: 0 });
    expect(a.ic).toBe(0.5);
  });
  it('une entree invalide est refusee', () => {
    expect(() => portanceDrainee1g({ Bp: 2, Lp: null, T: 0, N: 500, phi: 0, c: 0, gammaEff: 18, q: 18 })).toThrow();
    expect(() => portanceNonDrainee1g({ Bp: 2, Lp: null, T: 0, cu: 0, q: 0 })).toThrow();
  });
});

describe('T4 tassement', () => {
  it('Is du tableau, interpole en L/B', () => {
    expect(influenceIs(1, 'rigide')).toBe(0.83);
    expect(influenceIs(1, 'souple')).toBe(0.95);
    expect(influenceIs(1.5, 'souple')).toBeCloseTo(1.125, 6);
    expect(influenceIs(7.5, 'rigide')).toBeCloseTo(1.925, 6);
    expect(influenceIs(50, 'rigide')).toBe(2.13);
  });
  it('tassement elastique', () => {
    const r = tassementElastique({ p: 200, B: 2, LsurB: 1, nu: 0.3, Em: 20000, raideur: 'rigide' });
    expect(r.Is).toBe(0.83);
    expect(r.s_mm).toBeCloseTo(15.106, 2);
  });
  it('Steinbrenner, valeurs publiees', () => {
    expect(facteurAngleRectangle(1, 1, 1)).toBeCloseTo(0.1752, 3);
    expect(surcontrainteCentre(100, 1, 1, 1)).toBeCloseTo(33.61, 1);
    expect(surcontrainteCentre(100, 2, 4, 2)).toBeCloseTo(48.07, 1);
    expect(surcontrainteCoin(100, 1, 1, 1)).toBeCloseTo(17.52, 1);
    expect(surcontrainteCentre(100, 2, 2, 0)).toBe(100);
    expect(surcontrainteCoin(100, 2, 2, 0)).toBe(25);
  });
  it('oedometre, trois regimes', () => {
    const b = { H: 2, sigma0: 100, dSigma: 50, Cc: 0.3, Cs: 0.05, e0: 0.9 };
    const sc = tassementOedometre({ ...b, sigmaP: 200 });
    expect(sc.regime).toBe('surconsolide');
    expect(sc.s_mm).toBeCloseTo(9.268, 2);
    const nc = tassementOedometre({ ...b, sigmaP: 100 });
    expect(nc.regime).toBe('normalement_consolide');
    expect(nc.s_mm).toBeCloseTo(55.608, 2);
    const fr = tassementOedometre({ ...b, sigmaP: 120 });
    expect(fr.regime).toBe('franchissement');
    expect(fr.s_mm).toBeCloseTo(34.771, 2);
  });
  it('couches : sigma p obligatoire, jamais inventee', () => {
    expect(() =>
      tassementCouches({ q: 150, B: 2, L: 3, sigmaBase: 18, couches: [{ h: 1, gammaEff: 9, Cc: 0.25, Cs: 0.04, e0: 0.8, sigmaP: 0 }] }),
    ).toThrow(/sigma/i);
  });
  it('couches : cumul centre et coin', () => {
    const r = tassementCouches({
      q: 150,
      B: 2,
      L: 3,
      sigmaBase: 18,
      couches: [
        { h: 1, gammaEff: 9, Cc: 0.25, Cs: 0.04, e0: 0.8, sigmaP: 100 },
        { h: 0.6, gammaEff: 8, Cc: 0.4, Cs: 0.06, e0: 1.1, sigmaP: 60 },
      ],
    });
    expect(r.centre_mm).toBeCloseTo(86.197, 2);
    expect(r.coin_mm).toBeCloseTo(17.483, 2);
    expect(r.detail).toHaveLength(7);
    expect(r.detail[0].sigma0).toBeCloseTo(19.125, 6);
  });
});
