# ARENA CASES — Simulateur de Case Opening CS2

Un site de case opening style **Hellcase / Skin.Club**, 100% gratuit et sans serveur.

## Lancer le site

Ouvre simplement `index.html` dans ton navigateur (double-clic). Aucune installation requise.

## Fonctionnalités

- **4 caisses Arena exclusives** (Starter, AWP Mania, Knife Hunt, Gold Rush) avec images thématiques
- **28 caisses générées** en 3 catégories : **Only** (12 caisses mono-arme : AK-47, AWP, USP-S, Glock…), **Spéciales** (Pistol Paradise, SMG Rush, Sniper Elite, Heavy Firepower, Knife Frenzy, Glove Gallery) et **Stickers** (10 capsules officielles avec leurs vraies images, stickers sans usure ni StatTrak)
- **Probabilités durcies** : pondération intra-rareté en 1/prix^1,1 (les skins chers sont très rares), usures dégradées majoritaires (FN 3 %, BS 25 %), StatTrak 7 %
- **Les 42 caisses officielles CS2** (catégorie « CS2 Cases ») avec les **vraies images** des caisses et des skins (source : API communautaire ByMykel/CSGO-API, images Steam/Valve)
- **Prix réels du marché Steam** (dataset ByMykel/counter-strike-price-tracker, USD) : chaque usure a son vrai prix, StatTrak™ inclus ; prix des caisses = prix Steam de la caisse + clé $2.49
- **Rare Special Item** : comme dans CS2, les couteaux/gants sont cachés derrière une carte dorée « ? » (cliquable pour révéler le contenu) et apparaissent en carte mystère dans la roulette
- **Comptes locaux** avec avatar personnalisable, **niveaux/XP** (récompense à chaque niveau) et page profil complète
- **Case Battles** : liste de battles à rejoindre (3-5 créés par des bots, prêt pour le multijoueur) + création via bouton dédié ; 1v1, 1v1v1, 1v1v1v1 et 2v2, **mélange de caisses** (jusqu'à 10, 1 round par caisse), caisse du round affichée en haut, **lobby manuel** (« Play with bots » ou « + Add bot » par place, annulation remboursée), **rouleaux de roulette par joueur** avec gains affichés dessous, mode Classique, **🤪 Mode Fou** (le plus petit total gagne) et **🤝 Sharing** (gains partagés) ; à la fin, **popup de butin** avec les skins gagnés : tout vendre, tout garder ou vente à l'unité (le vainqueur remporte les objets, les équipes/le sharing se les partagent par valeur)
- **Rare Special Item** avec la vraie image dorée officielle de CS2 (`assets/rare-item.png`) ; quand le gold tombe (ouverture ou battle), un **second rouleau doré** se lance pour révéler l'objet — son pool contient tous les couteaux/gants **et, en secret, les 2 drops de base les plus chers de la caisse**
- **Leaderboards 100% joueurs réels** (les bots n'y apparaissent plus)
- **Skin Upgrader** style Skin.Club : mise **cumulable jusqu'à 5 skins**, cible **choisie automatiquement** dès la sélection (~×2,5, modifiable), roue de probabilité (chance = valeur cumulée/cible × 90 %), pool de **1 939 skins du jeu entier** (collections incluses : Dragon Lore, Gungnir, Wild Lotus…) avec recherche et filtres prix/rareté
- **Leaderboards** : meilleur drop, best skin, plus riche, caisses ouvertes, niveau — avec avatars, podium et ta position
- **Solde de départ : $100** + bonus gratuit de $5 toutes les 60 secondes
- **Probabilités style Hellcase** affichées sur chaque skin :
  - Qualité Militaire ≈ 80 %, Restreint ≈ 16 %, Classifié ≈ 3,2 %, Secret ≈ 0,64 %, ★ Exceptionnel ≈ 0,26 %
  - À l'intérieur d'une rareté, les skins chers sont plus rares (pondération inverse au prix)
- **Usure aléatoire** (Neuve → Marquée par les combats) qui influence le prix
- **StatTrak™** : 10 % de chance, valeur ×1,8
- **Roulette animée** avec sons, mode rapide, ouverture x1 / x2 / x3
- **Inventaire persistant** (localStorage) avec revente à l'unité ou totale
- **Statistiques** : profit, meilleur drop, couteaux/gants obtenus
- **Drops en direct** simulés comme sur les vrais sites

## Structure

```
index.html                    — structure du site
css/style.css                 — design dark néon
js/data.js                    — caisses Arena exclusives
js/cs2data.js                 — 42 caisses officielles CS2 + prix Steam (généré)
js/auth.js                    — comptes, niveaux/XP, profil
js/app.js                     — logique du jeu (ouvertures, inventaire…)
js/battle.js                  — Case Battles et bots
js/upgrade.js                 — Skin Upgrader
js/leaderboard.js             — classements
scripts/generate-cs2data.js   — régénère js/cs2data.js depuis les APIs
tmp-api/                      — données brutes (crates, skins, prix Steam)
```

Pour mettre à jour les caisses et les prix (nouvelle caisse Valve, etc.) :

```bash
curl -sL -o tmp-api/crates.json https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/crates.json
curl -sL -o tmp-api/skins.json https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json
curl -sL -o tmp-api/steamprices.json https://raw.githubusercontent.com/ByMykel/counter-strike-price-tracker/main/static/latest.json
node scripts/generate-cs2data.js
```

*Projet éducatif — aucune vraie monnaie. Noms de skins © Valve Corporation.*
