# sol-ec7

Paquet de mécanique des sols de la suite [Aedificium web](https://henri421.github.io/WebAedificium/),
selon l'**EN 1997** dans ses **deux générations**. Il n'a pas de page : les outils de la suite
l'importent.

> **Aide au calcul.** Valeurs recommandées des normes, sans annexe nationale. Chaque coefficient
> porte sa source (`ValeurSourcee`) ; aucune valeur n'est inventée quand une donnée manque, la
> fonction lève une erreur en clair. Aucune valeur n'a encore été comparée à un calcul externe.

## Contenu

- **Coefficients partiels** (`coefficients.ts`) : profils 1ʳᵉ génération (EN 1997-1:2004,
  annexe A : DA1, DA2, DA3) et 2ᵉ génération (EN 1990:2023 et EN 1997:2024-2025, approches
  (a) + (b), (c), (d), classes de conséquences), combinaisons résolues, contrôle des sources.
- **Terrain** (`terrain.ts`) : contraintes à la base d'une semelle avec nappe (γ' interpolé sur
  1,5 B sous la base) et dimensions efficaces B' et L'.
- **Portance** (`portance.ts`) : facteurs de portance et résistance drainée et non drainée, annexe D
  de l'EN 1997-1:2004 et annexe B.4 de l'EN 1997-3:2025.
- **Tassement** (`tassement.ts`) : méthode élastique, surcontraintes au centre et au coin d'un
  rectangle, couches œdométriques (surconsolidé, normalement consolidé, franchissement de σ'p).

Unités : m, kN, kPa, kN/m³ ; angles en radians.

## Utilisation

```json
"devDependencies": { "sol-ec7": "github:henri421/sol-ec7#v0.2.0" }
```

```ts
import { profil1g, combinaisons1g, portanceDrainee1g } from 'sol-ec7';
```

## Développement

```bash
npm install
npm run typecheck
npm test
```

Licence MIT.
