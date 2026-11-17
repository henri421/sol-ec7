// Lot E (audit R4) : reetiquetage d'un profil 1re generation, sans annexe codee dans la bibliotheque.
import { describe, expect, it } from 'vitest';
import { clauseDeSource, combinaisons1g, profil1g, reetiqueter1g, verifierProfil1g } from '../src/index';

describe('reetiqueter1g', () => {
  it('meme structure et memes valeurs, chaque source passee par f avec son chemin', () => {
    const chemins: string[] = [];
    const p = reetiqueter1g(profil1g(), 'Essai', '2026-11-17', (v, c) => {
      chemins.push(c);
      return { valeur: v.valeur, source: `X ${clauseDeSource(v.source)}` };
    });
    expect(p.nom).toBe('Essai');
    expect(p.A1.gG_dst.valeur).toBe(profil1g().A1.gG_dst.valeur);
    expect(p.M2.gPhi.source).toBe('X tableau A.4');
    expect(chemins).toContain('A1.gG_dst');
    expect(chemins).toContain('EQU.sol.gCu');
    expect(chemins).toContain('Re.R2');
    expect(() => verifierProfil1g(p)).not.toThrow();
    expect(combinaisons1g('DA1', p).map((c) => c.nom)).toEqual(combinaisons1g('DA1', profil1g()).map((c) => c.nom));
  });

  it('une valeur changee par f est employee', () => {
    const p = reetiqueter1g(profil1g(), 'E', 'd', (v, c) => (c === 'M2.gPhi' ? { valeur: 1.3, source: 's' } : v));
    expect(p.M2.gPhi.valeur).toBe(1.3);
  });

  it('clauseDeSource', () => {
    expect(clauseDeSource('EN 1997-1:2004, tableau A.1, valeur recommandée')).toBe('tableau A.1');
    expect(clauseDeSource('sans tableau')).toBe('sans tableau');
  });
});
