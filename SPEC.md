# SPEC — Chocobo Runner : Niveau 2 Forêt

## Branche cible
`feature/forest-level2` (créée depuis `main`)

---

## 1. Objectif

Ajouter un **niveau 2** qui se déclenche automatiquement à **score 500** :
- Le décor passe d'un univers cristal/château Final Fantasy à une **forêt dense**.
- Un **nouvel ennemi** apparaît : le **serpent**, qui se déplace au sol en mouvement sinusoïdal.
- En mode **2 joueurs**, chaque viewport affiche le décor correspondant au score **propre** de chaque joueur. Les deux joueurs peuvent donc être dans des niveaux différents simultanément.

---

## 2. Fonctionnalités & critères d'acceptation

### 2a. Transition de décor (score ≥ 500)

| Critère | Détail |
|---|---|
| Seuil | `w.score >= 500` — évalué par joueur |
| Transition | Instantanée au seuil (pas de fondu) |
| Réversibilité | Aucune — le joueur reste en forêt une fois le seuil atteint |
| Portée | Chaque `world` a son propre décor ; deux joueurs peuvent être dans des niveaux différents |

**Palette forêt (`ENV_FOREST`)** à définir :
- Ciel : nuances de vert sombre → bleu-vert aurore (plus lumineux que le thème cristal)
- Montagnes remplacées par des collines boisées denses
- Pas de château ni de cristaux flottants → grands arbres en arrière-plan, lierre, fougères
- Sol : terre sombre avec herbe dense et feuilles mortes
- Conserver les nuages (teinte plus verte/blanchâtre)
- Conserver le dirigeable (cohérence univers FF)

### 2b. Serpent ennemi

| Propriété | Détail |
|---|---|
| Apparition | Uniquement en niveau 2 (score ≥ 500), via le spawner existant |
| Type obstacle | `'snake'` (nouveau type, ajouté à `genObstacle()`) |
| Position initiale | Pos Y = `VIEW_GY` (sol), x = `VIEW_W + 24` |
| Mouvement | Horizontal : glisse vers la gauche à vitesse `speed` |
| Sinusoïde | `y = VIEW_GY - amplitude * sin(t * freq)` — amplitude ~40–50px (SC-scalé). Quand sin > 0 le serpent est en hauteur (duck requis), quand sin ≤ 0 il est au sol ou légèrement dessus (saut requis). Le serpent ne descend jamais sous `VIEW_GY`. |
| Hitbox | Rectangle centré sur la position sinusoïdale courante du corps |
| Visuel | Pixel-art dessiné sur canvas : corps vert en segments arrondis + tête triangulaire + langue fourchue, contour noir (`ENV.out`) |
| Probabilité spawn | 30 % des spawns en niveau 2 sont des serpents (les 70 % restants conservent les obstacles existants) |

### 2c. Mode 2 joueurs — décors indépendants

- `drawBackground()` reçoit déjà `w` (le monde courant) — ajouter un paramètre `level` dérivé de `w.score >= 500`.
- Chaque `renderView(view, w)` calcule `level = w.score >= 500 ? 2 : 1` et passe la palette ENV correspondante aux fonctions de dessin.
- Le sol (`drawGround()`) change également de palette selon le niveau.
- Les obstacles existants (crystal-block, bat) restent présents en niveau 2 (la forêt garde ses dangers propres + les anciens).

---

## 3. Structure des fichiers

Pas de nouveau fichier — tout dans `js/game.js` :

```
js/game.js
  ├── ENV                    (existant — palette niveau 1)
  ├── ENV_FOREST             (nouveau — palette niveau 2)
  ├── drawBackground()       → accept level param → branche sur ENV / ENV_FOREST
  ├── drawGround()           → accept level param → palette sol adaptée
  ├── drawForestBackground() (nouvelle fonction)
  ├── drawSnake()            (nouvelle fonction de rendu obstacle)
  ├── genObstacle()          → ajoute cas 'snake' conditionné au score
  └── updateWorld()          → updateSnake() pour position sinusoïdale
```

Aucun asset image supplémentaire requis — tout est dessiné sur canvas.

---

## 4. Style de code

- Suivre les conventions existantes : IIFE, pas de classes, canvas 2D brut.
- Nommer les constantes snake en `UPPER_SNAKE`, fonctions en `camelCase`.
- Commenter uniquement les formules non évidentes (ex : la sinusoïde du serpent).
- Pas de commentaires de type "ajouté pour le niveau 2" — le code doit se lire seul.

---

## 5. Tests / validation

Pas de test automatisé (le projet n'en a pas). Validation manuelle :

- [ ] Solo : le décor bascule forêt à score 500 exact
- [ ] Solo : les serpents apparaissent seulement après score 500
- [ ] Solo : collision serpent → KO correct
- [ ] Solo : sauter passe les phases basses du serpent, se baisser passe les phases hautes
- [ ] Les deux actions sont nécessaires au cours d'un même passage de serpent
- [ ] 2 joueurs : J1 à 250 pts / J2 à 620 pts → J1 décor cristal, J2 décor forêt simultanément
- [ ] 2 joueurs : séparateur horizontal non affecté
- [ ] Pas de régression sur les obstacles et gils existants

---

## 6. Limites (ce qu'on ne fait PAS dans cette branche)

- Pas de musique différente par niveau (la ChocoboTheme reste)
- Pas de boss, pas de fin de partie spécifique au niveau 2
- Pas de troisième niveau
- Pas de fondu/transition animée entre les décors
- Pas de modification du système de gils ni de la mécanique de saut
