# SPEC — Chocobo Runner v2 : Refactoring + Niveau 3 Désert + Feature Flags

## 1. Objectif

Refactoriser le jeu pour supporter 3 niveaux jouables indépendamment ou en séquence, avec une architecture modulaire permettant d'ajouter des fonctionnalités via feature flags sans toucher au cœur du jeu.

---

## 2. Modes de jeu

### Niveaux individuels (sélection au menu)
| Niveau | Nom | Décor | Ennemi spécifique |
|---|---|---|---|
| 1 | Terres de Cristal | Château, cristaux, montagnes | Crystal-block, bat |
| 2 | Forêt | Canopée, grands arbres, fougères | Serpent sinusoïdal |
| 3 | Désert | Dunes, ruines, oasis | Cactuar tireur d'épines |

En mode niveau individuel : le décor et les ennemis sont fixes pour toute la partie. Aucune transition de score ne change le niveau.

### Parcours Complet
Enchaîne les 3 niveaux dans la même partie. Les transitions sont pilotées par le score de chaque joueur :
- `0 – 499 pts` → Niveau 1
- `500 – 999 pts` → Niveau 2
- `≥ 1000 pts` → Niveau 3

En mode 2 joueurs, chaque viewport calcule son propre niveau à partir de son propre score (comportement déjà existant pour L1→L2).

---

## 3. Flux de navigation (menu)

```
Menu principal
  ├── [1 Joueur]      →  Écran sélection niveau  →  Partie
  └── [2 Joueurs]     →  Écran sélection niveau  →  Partie

Écran sélection niveau
  ├── [Niveau 1 — Cristal]
  ├── [Niveau 2 — Forêt]      (grisé si FEATURES.level2 = false)
  ├── [Niveau 3 — Désert]     (grisé si FEATURES.level3 = false)
  └── [Parcours Complet]      (grisé si FEATURES.fullRun = false)
```

Le bouton « Retour » sur l'écran de sélection ramène au menu principal.

La variable `gameMode` est ajoutée au state global :
- `'level'` + `startLevel: 1|2|3` pour un niveau individuel
- `'fullRun'` pour le parcours complet

---

## 4. Feature Flags

Fichier `js/features.js` (chargé en premier) :

```js
const FEATURES = {
  level2:    true,   // Forêt disponible dans le menu
  level3:    true,   // Désert disponible dans le menu
  fullRun:   true,   // Mode Parcours Complet disponible
  snake:     true,   // Ennemi serpent actif en niveau 2
  cactuar:   true,   // Ennemi cactuar actif en niveau 3
  devSkip:   true,   // Bouton dev ▶600/▶1000 dans l'audiobar
};
```

Règles :
- Chaque feature ajoutée dans le futur s'enregistre ici avec `false` par défaut.
- Toute logique conditionnelle dans le code vérifie `FEATURES.<flag>` avant d'exécuter.
- Les boutons du menu sont affichés/grisés selon les flags au moment du chargement.
- `features.js` est le seul fichier à modifier pour activer/désactiver une feature.

---

## 5. Architecture des fichiers

```
js/
  features.js          — FEATURES flags (chargé en premier)
  levels.js            — ENV palettes × 3, LEVEL_REGISTRY, getWorldLevel()
  enemies.js           — logique + rendu de tous les ennemis (snake, cactuar, base)
  audio.js             — Music, sfxJump, sfxGil, sfxDie, tone()
  game.js              — core : physics, spawn, collision, HUD, render loop, menus

index.html             — charge les scripts dans l'ordre :
                         features.js → audio.js → levels.js → enemies.js → game.js
```

Pas de build step. Pas d'ES modules (compatibilité file://). Chaque fichier expose ses symboles en variables globales à l'intérieur d'un namespace `CR` (ChocoboRunner).

### Namespace global `CR`

```js
// features.js
const CR = {};
CR.FEATURES = { ... };

// audio.js
CR.Audio = { Music, tone, sfxJump, sfxGil, sfxDie, audioInit, toggleMute };

// levels.js
CR.Levels = { ENV, ENV_FOREST, ENV_DESERT, REGISTRY, getWorldLevel, drawBackground, drawGround };

// enemies.js
CR.Enemies = { genObstacle, updateObstacles, drawObstacle, drawProjectiles, updateProjectiles };

// game.js — consomme tout le reste, expose uniquement si nécessaire
```

---

## 6. Détail des modules

### `features.js`
- Initialise `CR = {}` et `CR.FEATURES`
- Aucune autre logique

### `audio.js`
- Reprend exactement le bloc audio actuel de game.js (Music, tone, sfx*)
- Exporte via `CR.Audio`

### `levels.js`

**Palettes :**
- `ENV` (niveau 1, existant)
- `ENV_FOREST` (niveau 2, existant)
- `ENV_DESERT` (niveau 3, nouveau) :

```js
ENV_DESERT = {
  out: '#1a0f00',
  sky: ['#1a0a2a', '#6b2a0a', '#e87030', '#f5c060'],   // crépuscule désert
  sun: '#ff9020', sunGlow: 'rgba(255,160,40,.5)',
  cloud: '#f5d0a0', cloudLit: '#fff0d0',
  duneBack: '#c8903a', duneBackSh: '#8a5a14',
  duneFront: '#e0b050', duneFrontSh: '#b07820',
  palmTrunk: '#5a3a10', palmLeaf: '#2a7a1a', palmLeafLit: '#4aaa28', palmLeafSh: '#1a5010',
  ruin: '#8a7050', ruinSh: '#5a4830', ruinLit: '#c0a878',
  ground: '#c8903a', groundTop: '#b07828', ripple: '#a06820',
  sand: '#e0b850', cactus: '#2a7020', cactusLit: '#4aaa30', cactusSpine: '#e8e0b0',
};
```

**Registre de niveaux :**
```js
CR.Levels.REGISTRY = {
  1: { name: 'Terres de Cristal', env: ENV,        drawBg: drawBg1, drawGround: drawGround1 },
  2: { name: 'Forêt',            env: ENV_FOREST,  drawBg: drawBg2, drawGround: drawGround2 },
  3: { name: 'Désert',           env: ENV_DESERT,  drawBg: drawBg3, drawGround: drawGround3 },
};
```

**`getWorldLevel(world, gameMode, startLevel)`** :
```js
// niveau individuel → toujours startLevel
// parcours complet → piloté par score
if (gameMode === 'level') return startLevel;
if (world.score >= 1000) return 3;
if (world.score >= 500)  return 2;
return 1;
```

**Fonctions de dessin :**
- `drawBg1/2/3(vw, vh, gy, w)` — chaque niveau a ses propres fonctions, existant pour 1 et 2
- `drawGround1/2/3(vw, vh, gy, w)` — idem
- `drawBackground(vw, vh, gy, w, level)` — dispatcher : appelle `REGISTRY[level].drawBg`
- `drawGround(vw, vh, gy, w, level)` — dispatcher

**Décor désert (`drawBg3`)** :
- Ciel gradient crépuscule (violet-nuit → rouge-orange → ocre chaud)
- Grand soleil rouge-orangé bas sur l'horizon (cell-shaded, aura)
- Nuages rares beige clair (variant de `toonCloud`)
- Dunes lointaines (adapter `drawRange` avec couleurs désert, sans neige)
- Dunes proches en avant-plan (couches superposées, parallaxe)
- Ruines de colonnes (remplacent le château) : piliers brisés, blocs écroulés
- Palmiers (remplacent les arbres de colline)
- Particules de sable (remplacent les plumes flottantes)
- Dirigeable conservé

**Sol désert (`drawGround3`)** :
- Bande sable doré
- Ondulations / stries de vent (lignes légères parallèles)
- Petits cailloux

### `enemies.js`

Exporte `CR.Enemies` avec :

**`genObstacle(level, VIEW_W, VIEW_GY, SC)`**
```
level 1 : ground-block (66%), bat (34%)
level 2 : snake (30%), ground-block (46%), bat (24%)
level 3 : cactuar (25%), ground-block (50%), bat (25%)
         → cactuar uniquement si FEATURES.cactuar
         → snake uniquement si FEATURES.snake
```

**`updateObstacles(obstacles, projectiles, speed, gy, SC)`**
- Déplace tous les obstacles en x
- Avance la phase des serpents
- Fait avancer les catctuars + gère le tir d'épines
- Déplace les projectiles en x (vitesse propre)

**`drawObstacle(o, SC, ENV)`** — dispatche sur `o.type`

**`drawProjectile(p, SC)`** — dessine une épine de cactuar

---

### Cactuar — Mécanique complète

**Obstacle `{ type:'cactuar', x, y, w, h, fired:false, fireX }`**
- Taille : `48×64` SC-scalé
- `fireX = VIEW_W * 0.65` : seuil de déclenchement du tir
- Quand `o.x < o.fireX && !o.fired` :
  - Génère un burst de 3 épines à hauteurs différentes :
    - BASSE : `y = gy - 22*SC` → le joueur doit sauter
    - HAUTE : `y = gy - 80*SC` → le joueur doit se baisser
    - TRÈS HAUTE : `y = gy - 130*SC` → passe au-dessus (esquive libre)
  - Les épines sont poussées dans `world.projectiles`
  - `o.fired = true`

**Projectile `{ x, y, w:28*SC, h:6*SC, speed: speed*2.2 }`**
- Voyage vers la gauche à vitesse 2.2× le défilement courant
- Hitbox rectangulaire
- Rendu : aiguille beige clair avec pointe sombre

**Visuel Cactuar (pixel-art canvas, style cell-shaded) :**
- Corps vert arrondi, contour `ENV_DESERT.out`
- Bras en T caractéristique
- Deux yeux blancs ronds avec pupille noire
- Petites épines sur les côtés
- Palette : corps `ENV_DESERT.cactus`, lit `ENV_DESERT.cactusLit`

---

### `game.js` (core, refactorisé)

Responsabilités restantes après extraction :
- State machine : `menu` | `levelSelect` | `playing` | `over`
- Variables globales de session : `numPlayers`, `gameMode`, `startLevel`, `speed`, `frame`, `worlds`, `viewports`, `SC`, `PX`
- `makeWorld()`, `configure()`, `reset()`, `initFeathers()`
- `updateWorld()` — physique chocobo + collisions + intégration `CR.Enemies`
- `renderView()` — appels aux dispatchers de `CR.Levels` + `CR.Enemies`
- Menus HTML : showMenu(), showLevelSelect(), startGame(), gameOver()
- Input (keyboard + souris + touch)
- `devSkip` bouton (si `FEATURES.devSkip`)
- Game loop `update()` / `render()` / `loop()`

**`world` — nouvelle propriété :**
```js
{ ..., projectiles: [] }
```

**`update()` refactorisé :**
```js
function update() {
  frame++;
  speed += 0.0022 * SC;
  spawnTimer--;
  if (spawnTimer <= 0) {
    aliveWorlds().forEach(w => {
      const lv = CR.Levels.getWorldLevel(w, gameMode, startLevel);
      w.obstacles.push(CR.Enemies.genObstacle(lv, VIEW_W, VIEW_GY, SC));
    });
    spawnTimer = Math.max(42, 92 - speed*3/SC) + Math.random()*48;
  }
  // gils, airship, world updates...
  worlds.forEach((w, i) => { if (w.alive) updateWorld(w, viewports[i]); });
  if (aliveWorlds().length === 0) gameOver();
}
```

**`renderView()` refactorisé :**
```js
function renderView(view, w) {
  const lv = CR.Levels.getWorldLevel(w, gameMode, startLevel);
  CR.Levels.drawBackground(view.w, view.h, view.gy, w, lv);
  CR.Levels.drawGround(view.w, view.h, view.gy, w, lv);
  for (const g of w.gils) drawGil(g, w.anim);
  for (const o of w.obstacles) CR.Enemies.drawObstacle(o, SC);
  for (const p of w.projectiles) CR.Enemies.drawProjectile(p, SC);
  drawChocobo(w, view.gy);
  drawSparkles(w);
  // vignette, KO, HUD...
}
```

---

## 7. Menu HTML refactorisé

Deux états overlay supplémentaires gérés en JS :
- `levelSelect` : masque `menuBtns`, affiche `levelBtns` (boutons niveau + retour)

```html
<!-- index.html — nouveaux boutons (masqués par défaut) -->
<div class="btnrow hidden" id="levelBtns">
  <button data-mode="level" data-lv="1">Niveau 1 · Cristal</button>
  <button data-mode="level" data-lv="2" class="green">Niveau 2 · Forêt</button>
  <button data-mode="level" data-lv="3" class="sand">Niveau 3 · Désert</button>
  <button data-mode="fullRun" class="lilac">Parcours Complet</button>
  <button id="backBtn" class="back">← Retour</button>
</div>
```

Boutons couleur :
- Niveau 1 : jaune (existant)
- Niveau 2 : vert (`class="green"`)
- Niveau 3 : sable/doré (`class="sand"`)
- Parcours Complet : lilas (existant)

---

## 8. Branche Git

`feature/v2-refactor-modular`

---

## 9. Tests / validation manuelle

- [ ] Menu : boutons niveau 2 / 3 / parcours complet se grisent si FEATURES correspondant = false
- [ ] Niveau 1 seul : cristaux/château, pas de serpent ni cactuar
- [ ] Niveau 2 seul : forêt dès le départ, serpent présent, pas de cactuar
- [ ] Niveau 3 seul : désert dès le départ, cactuar + épines, pas de serpent
- [ ] Parcours Complet : transition cristal→forêt à 500, forêt→désert à 1000
- [ ] 2P Parcours Complet : J1 à 550 (forêt) / J2 à 350 (cristal) simultanément
- [ ] Cactuar : épines générées quand le cactuar entre dans la zone de tir
- [ ] Épine basse → saut nécessaire ; épine haute → duck nécessaire
- [ ] Collision épine → KO
- [ ] devSkip : bouton ▶600 et bouton ▶1000 présents si FEATURES.devSkip

---

## 10. Ce qu'on ne fait PAS dans cette branche

- Pas de build step / bundler / npm
- Pas de changement de mécanique de saut/duck
- Pas de nouveau système de score ou de récompenses
- Pas de sauvegarde du niveau préféré
- Pas de sons spécifiques par niveau (même ChocoboTheme)
