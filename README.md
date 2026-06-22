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

## Commandes

| Action            | 1 Joueur                         | 2 Joueurs            |
|-------------------|----------------------------------|----------------------|
| Sauter            | `Espace` / `↑` / `W` / clic      | J1 `W` · J2 `↑`      |
| Se baisser        | `↓` / `S`                        | J1 `S` · J2 `↓`      |
| Couper le son     | `M`                              | `M`                  |
| Rejouer (fin)     | `Espace`                         | `Espace`             |

Le **volume de la musique** se règle avec le curseur 🎵 en haut à droite
(les effets sonores restent gérés séparément). Réglages mémorisés (localStorage).

## Structure du projet

```
.
├── index.html          # page + conteneurs (canvas, overlay, barre audio)
├── css/
│   └── style.css       # styles
├── js/
│   └── game.js         # toute la logique du jeu
├── assets/
│   ├── ChocoboTheme.mp3 # musique de fond (boucle)
│   └── Chocobo.png      # illustration de référence (style du sprite)
└── README.md
```

## Audio

- **Musique** : `assets/ChocoboTheme.mp3`, jouée en boucle.
  - HTTP : `fetch` → `decodeAudioData` → `AudioBufferSourceNode` avec `loop=true`
    (bouclage échantillon-précis, sans coupure) ; volume via un `GainNode`.
  - `file://` : repli sur un élément `<audio loop>` (volume via `audio.volume`).
- **Effets sonores** (saut / gil / mort) : synthétisés à la volée (oscillateurs Web Audio).
