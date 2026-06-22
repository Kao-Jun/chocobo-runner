# 🐤 Chocobo Runner

Petit jeu de runner (style Final Fantasy) jouable dans le navigateur, sans dépendances.
Solo ou **2 joueurs en écran partagé** (chocobo jaune vs chocobo bleu).

## Lancer le jeu

- **Simple** : double-cliquer sur `index.html`.
- **Recommandé** (boucle musicale parfaitement *gapless*) : servir le dossier via un serveur local, par ex.
  ```bash
  python -m http.server 8000
  ```
  puis ouvrir http://localhost:8000

> En `file://`, la musique fonctionne aussi mais via un élément `<audio loop>` natif
> (boucle correcte, transition très légèrement moins parfaite que le décodage Web Audio).

## Niveaux

| # | Nom | Décor | Ennemi spécifique |
|---|-----|-------|-------------------|
| 1 | Terres de Cristal | Château, cristaux, montagnes enneigées | Crystal-block, bat |
| 2 | Forêt | Canopée, grands arbres, fougères | Serpent sinusoïdal |
| 3 | Désert | Dunes, ruines, palmiers, ciel crépuscule | Cactuar tireur d'épines |

### Mode Parcours Complet
Enchaîne les 3 niveaux dans la même partie, piloté par le score :
- `0 – 499 pts` → Niveau 1 · Cristal
- `500 – 999 pts` → Niveau 2 · Forêt
- `≥ 1000 pts` → Niveau 3 · Désert

En 2 joueurs, chaque joueur a son propre niveau selon son propre score.

## Commandes

| Action            | 1 Joueur                         | 2 Joueurs            |
|-------------------|----------------------------------|----------------------|
| Sauter            | `Espace` / `↑` / `W` / clic      | J1 `W` · J2 `↑`      |
| Se baisser        | `↓` / `S`                        | J1 `S` · J2 `↓`      |
| Couper le son     | `M`                              | `M`                  |
| Rejouer (fin)     | `Espace`                         | `Espace`             |

Le **volume de la musique** se règle avec le curseur 🎵 en haut à droite. Réglages mémorisés (localStorage).

## Structure du projet

```
.
├── index.html           # page + conteneurs (canvas, overlay, barre audio)
├── css/
│   └── style.css        # styles
├── js/
│   ├── features.js      # feature flags (CR.FEATURES) — chargé en premier
│   ├── audio.js         # Web Audio : musique + effets sonores (CR.Audio)
│   ├── levels.js        # palettes ENV × 3, draw functions, REGISTRY (CR.Levels)
│   ├── enemies.js       # ennemis + projectiles : snake, cactuar… (CR.Enemies)
│   └── game.js          # core : physique, collisions, menus, HUD, game loop
├── assets/
│   ├── ChocoboTheme.mp3 # musique de fond (boucle)
│   └── Chocobo.png      # illustration de référence (style du sprite)
└── README.md
```

Pas de build step, pas de bundler — 100 % vanilla JS compatible `file://`.
Les modules communiquent via un namespace global `CR` (ChocoboRunner).

## Feature flags

`js/features.js` contrôle l'activation de chaque fonctionnalité :

```js
CR.FEATURES = {
  level2:   true,   // Niveau 2 Forêt disponible dans le menu
  level3:   true,   // Niveau 3 Désert disponible dans le menu
  fullRun:  true,   // Mode Parcours Complet
  snake:    true,   // Ennemi serpent (niveau 2)
  cactuar:  true,   // Ennemi cactuar (niveau 3)
  devSkip:  true,   // Boutons ▶600 / ▶1000 pour tests rapides
};
```

Mettre un flag à `false` désactive la feature sans toucher au reste du code.

## Audio

- **Musique** : `assets/ChocoboTheme.mp3`, jouée en boucle.
  - HTTP : `fetch` → `decodeAudioData` → `AudioBufferSourceNode` avec `loop=true`
    (bouclage échantillon-précis, sans coupure) ; volume via un `GainNode`.
  - `file://` : repli sur un élément `<audio loop>` (volume via `audio.volume`).
- **Effets sonores** (saut / gil / mort) : synthétisés à la volée (oscillateurs Web Audio).
