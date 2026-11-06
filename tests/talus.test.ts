// Tests d'acceptation du paquet sol-ec7, lot talus (PLAN.md de stabilite-talus, T1 et T2).
// Attendus calcules a part (forme fermee ou Bishop independant a 4000 tranches), sans le code
// du paquet. A ne pas modifier.
import { describe, expect, it } from 'vitest';
import {
  analyserCercle,
  combinaisonsStabilite1g,
  combinaisonsStabilite2g,
  profil1g,
  profil2g,
  profilAnb2022,
  rechercherCercleCritique,
  verifierProfil1g,
  type Bande,
  type CombinaisonStabilite,
  type CoucheTalus,
  type DonneesBishop,
} from '../src/index';

const RAD = Math.PI / 180;
const proche = (x: number, attendu: number, rel = 0.005) =>
  expect(Math.abs(x - attendu) / Math.abs(attendu)).toBeLessThanOrEqual(rel);

/** Combinaison neutre : tous les coefficients a 1. */
function neutre(): CombinaisonStabilite {
  const un = { valeur: 1, source: 'essai' };
  const zero = { valeur: 0, source: 'essai' };
  return {
    nom: 'neutre',
    mode: 'actions',
    actions: { gG_dst: un, gG_stb: un, gQ_dst: un, gQ_stb: zero },
    sol: { gPhi: un, gC: un, gCu: un },
    gRe: un,
  };
}

// Cas A : argile non drainee cu = 30 kPa, terrain horizontal, cercle (0 ; 3) R = 5, bande sur [0 ; 4].
// Le poids du sol est symetrique : seul le moment de la bande entraine. F = cu.2θ.R² / (q a²/2),
// θ = acos(3/5). Avec q = 50 : F = 3,47736.
const argile: CoucheTalus[] = [
  { nom: 'Argile', base: -50, gamma: 18, gammaSat: 18, drainage: 'non_draine', cu: 30 },
];
function casA(bandes: Bande[], combinaison: CombinaisonStabilite = neutre()): DonneesBishop {
  return {
    profil: [{ x: -20, y: 0 }, { x: 20, y: 0 }],
    couches: argile,
    piezo: null,
    gammaW: 9.81,
    bandes,
    combinaison,
  };
}
const cercleA = { xc: 0, yc: 3, R: 5 };
const FA = 3.47736;

// Cas B : talus 1/1 de 10 m, limon draine (phi' 30°, c' 5) sur argile non drainee (cu 60) sous la
// cote 4, ligne piezometrique, cercle (2 ; 16) R = 15.
const casB = (combinaison: CombinaisonStabilite = neutre(), piezo = true): DonneesBishop => ({
  profil: [{ x: -25, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }, { x: 35, y: 0 }],
  couches: [
    { nom: 'Limon', base: 4, gamma: 19, gammaSat: 20, drainage: 'draine', phi: 30 * RAD, c: 5 },
    { nom: 'Argile', base: -40, gamma: 20, gammaSat: 21, drainage: 'non_draine', cu: 60 },
  ],
  piezo: piezo ? [{ x: -25, y: 7 }, { x: 0, y: 7 }, { x: 10, y: 0 }, { x: 35, y: 0 }] : null,
  gammaW: 9.81,
  bandes: [],
  combinaison,
});
const cercleB = { xc: 2, yc: 16, R: 15 };

describe('T1 : coefficients de stabilite generale', () => {
  it('profil1g porte gamma_R;e du tableau A.14 : R1 1,0 ; R2 1,1 ; R3 1,0', () => {
    const p = profil1g();
    expect(p.Re.R1.valeur).toBe(1.0);
    expect(p.Re.R2.valeur).toBe(1.1);
    expect(p.Re.R3.valeur).toBe(1.0);
    expect(p.Re.R2.source).toContain('A.14');
    expect(() => verifierProfil1g(p)).not.toThrow();
  });

  it('profilAnb2022 : A2 gamma_Q = 1,10 et M2 selon le risque', () => {
    const n = profilAnb2022('normal');
    expect(n.nom).toContain('ANB:2022');
    expect(n.A2.gQ_dst.valeur).toBe(1.1);
    expect(n.A1.gG_dst.valeur).toBe(1.35);
    expect(n.A1.gQ_dst.valeur).toBe(1.5);
    expect(n.M2.gPhi.valeur).toBe(1.25);
    expect(n.M2.gCu.valeur).toBe(1.4);
    expect(n.M2.gPhi.source).toContain('A.4 ANB');
    const f = profilAnb2022('faible');
    expect(f.M2.gPhi.valeur).toBe(1.1);
    expect(f.M2.gC.valeur).toBe(1.1);
    expect(f.M2.gCu.valeur).toBe(1.25);
    const e = profilAnb2022('eleve');
    expect(e.M2.gPhi.valeur).toBe(1.4);
    expect(e.M2.gCu.valeur).toBe(1.55);
    expect(n.Re.R1.valeur).toBe(1.0);
    expect(n.Re.R1.source).toContain('A.14 ANB');
    expect(n.approcheImposee).toBe('DA1');
    for (const p of [n, f, e]) expect(() => verifierProfil1g(p)).not.toThrow();
  });

  it('combinaisonsStabilite1g : DA1 en deux combinaisons, DA2 sur les effets, DA3 sur les actions', () => {
    const p = profil1g();
    const da1 = combinaisonsStabilite1g('DA1', p);
    expect(da1.map((c) => c.nom)).toEqual(['DA1-1', 'DA1-2']);
    expect(da1.map((c) => c.mode)).toEqual(['effets', 'actions']);
    expect(da1[0].actions.gG_dst.valeur).toBe(1.35);
    expect(da1[1].actions.gQ_dst.valeur).toBe(1.3);
    expect(da1[1].sol.gPhi.valeur).toBe(1.25);
    expect(da1[1].sol.gCu.valeur).toBe(1.4);
    expect(da1.every((c) => c.gRe.valeur === 1.0)).toBe(true);
    const da2 = combinaisonsStabilite1g('DA2', p);
    expect(da2).toHaveLength(1);
    expect(da2[0].mode).toBe('effets');
    expect(da2[0].gRe.valeur).toBe(1.1);
    const da3 = combinaisonsStabilite1g('DA3', p);
    expect(da3[0].mode).toBe('actions');
    expect(da3[0].actions.gG_dst.valeur).toBe(1.0);
    expect(da3[0].sol.gPhi.valeur).toBe(1.25);
  });

  it("l'ANB 2022 refuse une autre approche que la DA1", () => {
    expect(() => combinaisonsStabilite1g('DA2', profilAnb2022('normal'))).toThrow(/approche/);
    expect(combinaisonsStabilite1g('DA1', profilAnb2022('normal'))[1].actions.gQ_dst.valeur).toBe(1.1);
  });

  it('combinaisonsStabilite2g : VC3 + M2, k_M applique, sans gamma_R;e', () => {
    const cc2 = combinaisonsStabilite2g('CC2', profil2g());
    expect(cc2).toHaveLength(1);
    expect(cc2[0].nom).toBe('VC3 + M2');
    expect(cc2[0].mode).toBe('actions');
    expect(cc2[0].actions.gG_dst.valeur).toBe(1.0);
    expect(cc2[0].actions.gQ_dst.valeur).toBe(1.3);
    expect(cc2[0].sol.gPhi.valeur).toBeCloseTo(1.25, 10);
    expect(cc2[0].sol.gCu.valeur).toBeCloseTo(1.4, 10);
    expect(cc2[0].gRe.valeur).toBe(1);
    expect(cc2[0].gRe.source).toContain('tableau 4.2');
    const cc3 = combinaisonsStabilite2g('CC3', profil2g());
    expect(cc3[0].sol.gPhi.valeur).toBeCloseTo(1.375, 10);
    expect(cc3[0].sol.gCu.valeur).toBeCloseTo(1.54, 10);
    expect(cc3[0].actions.gQ_dst.valeur).toBe(1.3);
  });
});

describe('T2 : Bishop simplifie', () => {
  it('cas A, argile, bande permanente : forme fermee', () => {
    const r = analyserCercle(casA([{ x0: 0, x1: 4, q: 50, nature: 'G' }]), cercleA);
    expect(r.valide).toBe(true);
    if (!r.valide) return;
    proche(r.F, FA);
    expect(r.taux).toBeCloseTo(1 / r.F, 10);
    expect(r.sens).toBe(1);
  });

  it('cas A, DA2 : facteur sur le moment moteur, taux = 1,1 / F', () => {
    const c = combinaisonsStabilite1g('DA2', profil1g())[0];
    const r = analyserCercle(casA([{ x0: 0, x1: 4, q: 50, nature: 'G' }], c), cercleA);
    if (!r.valide) throw new Error(r.motif);
    proche(r.F, FA / 1.35);
    proche(r.taux, 0.42705);
  });

  it('cas A, 2e generation CC2 : cu / 1,4, bande G puis bande Q (x 1,3)', () => {
    const c = combinaisonsStabilite2g('CC2', profil2g())[0];
    const g = analyserCercle(casA([{ x0: 0, x1: 4, q: 50, nature: 'G' }], c), cercleA);
    const q = analyserCercle(casA([{ x0: 0, x1: 4, q: 50, nature: 'Q' }], c), cercleA);
    if (!g.valide || !q.valide) throw new Error('cercle invalide');
    proche(g.F, FA / 1.4);
    proche(q.F, FA / 1.4 / 1.3);
    expect(q.sens).toBe(1);
  });

  it('cas A, DA1-2 : ANB (gamma_Q 1,10) contre valeurs recommandees (1,3)', () => {
    const anb = combinaisonsStabilite1g('DA1', profilAnb2022('normal'))[1];
    const rec = combinaisonsStabilite1g('DA1', profil1g())[1];
    const ra = analyserCercle(casA([{ x0: 0, x1: 4, q: 50, nature: 'Q' }], anb), cercleA);
    const rr = analyserCercle(casA([{ x0: 0, x1: 4, q: 50, nature: 'Q' }], rec), cercleA);
    if (!ra.valide || !rr.valide) throw new Error('cercle invalide');
    proche(ra.F, FA / 1.4 / 1.1);
    proche(rr.F, FA / 1.4 / 1.3);
  });

  it('cas A, surcharge variable stabilisatrice ignoree', () => {
    const r = analyserCercle(
      casA([{ x0: 0, x1: 4, q: 50, nature: 'G' }, { x0: -4, x1: 0, q: 20, nature: 'Q' }]),
      cercleA
    );
    if (!r.valide) throw new Error(r.motif);
    proche(r.F, FA);
    expect(r.tranches.some((t) => t.Q > 0 && !t.qRetenue)).toBe(true);
  });

  it('cas B, deux couches et ligne piezometrique : Bishop independant', () => {
    const r = analyserCercle(casB(), cercleB);
    if (!r.valide) throw new Error(r.motif);
    proche(r.F, 1.99074);
    const sec = analyserCercle(casB(neutre(), false), cercleB);
    if (!sec.valide) throw new Error(sec.motif);
    proche(sec.F, 2.09317);
  });

  it('cas B, DA1 : combinaison 1 sur les effets, combinaison 2 sur les materiaux', () => {
    const [c1, c2] = combinaisonsStabilite1g('DA1', profil1g());
    const r1 = analyserCercle(casB(c1), cercleB);
    const r2 = analyserCercle(casB(c2), cercleB);
    if (!r1.valide || !r2.valide) throw new Error('cercle invalide');
    proche(r1.F, 1.45237);
    proche(r2.F, 1.44585);
  });

  it('cas B, pression interstitielle hydrostatique sous la ligne piezometrique', () => {
    const r = analyserCercle(casB(), cercleB);
    if (!r.valide) throw new Error(r.motif);
    for (const t of r.tranches) {
      const yp = t.x <= 0 ? 7 : t.x >= 10 ? 0 : 7 - 0.7 * t.x;
      expect(t.u).toBeCloseTo(9.81 * Math.max(0, yp - t.yBase), 6);
    }
    expect(r.tranches.some((t) => t.materiau === 'Argile')).toBe(true);
    expect(r.tranches.some((t) => t.materiau === 'Limon')).toBe(true);
  });

  it('cercle hors du terrain : invalide avec motif, jamais de valeur', () => {
    const r = analyserCercle(casA([]), { xc: 0, yc: 10, R: 5 });
    expect(r.valide).toBe(false);
    if (!r.valide) expect(r.motif.length).toBeGreaterThan(0);
  });

  it('saisie incoherente : erreurs en francais', () => {
    const d = casA([]);
    expect(() => analyserCercle({ ...d, profil: [{ x: 0, y: 0 }] }, cercleA)).toThrow(/profil/i);
    expect(() =>
      analyserCercle({ ...d, profil: [{ x: 0, y: 0 }, { x: 0, y: 1 }] }, cercleA)
    ).toThrow(/croissant/i);
    expect(() =>
      analyserCercle({ ...d, couches: [{ ...argile[0], cu: 0 }] }, cercleA)
    ).toThrow(/cu/);
    expect(() =>
      analyserCercle(
        { ...d, couches: [{ nom: 'S', base: -5, gamma: 18, gammaSat: 20, drainage: 'draine', phi: 0, c: 0 }] },
        cercleA
      )
    ).toThrow(/φ/);
    expect(() => analyserCercle({ ...d, couches: [] }, cercleA)).toThrow(/couche/i);
  });
});

describe('T3 : recherche du cercle critique', () => {
  // Talus sableux sec 1/2 (phi' = 30°, c' = 0) : le minimum tend vers tan phi' / tan beta = 1,1547
  // par valeurs superieures (glissement superficiel).
  const sable: DonneesBishop = {
    profil: [{ x: -30, y: 10 }, { x: 0, y: 10 }, { x: 20, y: 0 }, { x: 50, y: 0 }],
    couches: [{ nom: 'Sable', base: -30, gamma: 18, gammaSat: 20, drainage: 'draine', phi: 30 * RAD, c: 0 }],
    piezo: null,
    gammaW: 9.81,
    bandes: [],
    combinaison: neutre(),
  };

  it('talus sableux sec : F proche de tan phi / tan beta', () => {
    const r = rechercherCercleCritique(sable);
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.resultat.F).toBeGreaterThanOrEqual(1.1547 * 0.995);
    expect(r.resultat.F).toBeLessThanOrEqual(1.1547 * 1.03);
    expect(r.nbCercles).toBeGreaterThan(100);
  });

  it('le F rendu est celui du cercle rendu, au meme nombre de tranches', () => {
    const r = rechercherCercleCritique(casB());
    if (!r) throw new Error('aucun cercle');
    const a = analyserCercle(casB(), r.cercle);
    if (!a.valide) throw new Error(a.motif);
    expect(r.resultat.F).toBe(a.F);
    expect(r.resultat.F).toBeLessThanOrEqual(1.99074 * 1.005);
  });

  it('cote limite respectee', () => {
    const r = rechercherCercleCritique(casB(), { coteLimite: 2 });
    if (!r) throw new Error('aucun cercle');
    expect(r.cercle.yc - r.cercle.R).toBeGreaterThanOrEqual(2 - 1e-9);
  });
});
