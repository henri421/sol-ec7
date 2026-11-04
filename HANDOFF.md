# HANDOFF — T1 à T4 (sol-ec7)

## T1 : coefficients

- **Fichiers modifiés** : `src/coefficients.ts` (nouveau).
- **Décisions** : reprise des valeurs de `mur-en-l` (`profil.ts`, `profil2e.ts`). `gCu` = 1,0 en M1, 1,4 en M2 et 1,4 en EQU (tableau A.2). Noms des combinaisons 2e génération littéralement `(a)` à `(d)`, sans suffixe. Absence de (e) (VC4 hors périmètre).
- **Points douteux** : sources 2e génération citées d'après le PLAN (`EN 1997-3:2025, tableau 5.2`), alors que `profil2e.ts` citait le tableau 7.2.
- **Statut tests** : 37/37, typecheck 0 erreur.

## T2 : terrain et dimensions

- **Fichiers modifiés** : `src/terrain.ts` (nouveau).
- **Décisions** : table de `contraintesBase` appliquée telle quelle, frontière `Dw = D` traitée dans la branche `D ≤ Dw` (gammaEff = g'). `angleChargeT` renvoie π/2 si T est nul (deux composantes nulles). `horsBase` renvoie les dimensions brutes et `A = 0`, sans lever.
- **Points douteux** : aucun.
- **Statut tests** : 37/37, typecheck 0 erreur.

## T3 : portance

- **Fichiers modifiés** : `src/portance.ts` (nouveau).
- **Décisions** : `Nγ = 2(Nq − 1)tan φ` en 1re, `2(Nq + 1)tan φ` en 2e ; `m = 2` en filante ; `dq = dc = 1` en 1re et en 2e sans `Df > 0`. `phi ≤ 0` et `cu ≤ 0` lèvent.
- **Points douteux** : `ic` drainé non borné à 0, conformément à la formule littérale du PLAN (contrairement à `mur-en-l/src/sol.ts`) ; cas `T` au-delà de la capacité non couvert par les tests.
- **Statut tests** : 37/37, typecheck 0 erreur.

## T4 : tassement et index

- **Fichiers modifiés** : `src/tassement.ts`, `src/index.ts` (nouveaux).
- **Décisions** : `L/B < 1` ramené à la première valeur du tableau B.3 (pas d'extrapolation), plafond à 10. `z = 0` traité dans `surcontrainteCentre` (q) et `surcontrainteCoin` (q/4). Tranches évaluées à mi-hauteur ; `L = 100 B` en filante ; `sigmaP ≤ 0` lève avec « sigma ».
- **Points douteux** : le PLAN ne dit pas quoi faire pour `L/B < 1` ; choix de saturation documenté ci-dessus.
- **Statut tests** : 37/37, typecheck 0 erreur.

## Commandes

```
ELECTRON_RUN_AS_NODE=1 '/c/Users/henri/AppData/Local/Programs/Microsoft VS Code/Code.exe' ../_banc-local/lancer.mjs .
→ ok tests\sol.test.ts (37/37)

ELECTRON_RUN_AS_NODE=1 '/c/Users/henri/AppData/Local/Programs/Microsoft VS Code/Code.exe' ../_banc-local/typecheck.mjs .
→ typecheck : 0 erreur (TypeScript 6.0.3)
```
