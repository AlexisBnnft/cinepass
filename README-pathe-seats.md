# Places disponibles (Pathé)

Sur les séances Pathé, CinePass affiche le nombre de places libres et le plan de salle
(quelles places sont prises). Les données viennent du tunnel de réservation Pathé.

## Ce qu'on récupère

| Source | Protection | Donne |
|---|---|---|
| `www.pathe.fr/api/cinemas` | aucune | slug + `vistaRef` de chaque cinéma |
| `www.pathe.fr/api/cinema/{slug}/shows` | aucune | films à l'affiche par date |
| `www.pathe.fr/api/show/{film}/showtimes/{cinema}` | aucune | séances + `refCmd` = `V{vistaRef}S{sessionId}` |
| `s.pathe.fr/api/seatmap/fr-FR/{vistaRef}/{sessionId}/map` | Akamai Bot Manager | plan de salle **avec l'occupation en direct** |

Dans le plan de salle, `status` vaut `1` pour une place prise et `0` pour une place libre,
et `seatIndex` est la colonne (allées comprises) — le plan se reconstruit tel quel.
Un seul appel suffit donc par séance : comptage **et** positions.

## Les trois obstacles côté `s.pathe.fr`

1. **Empreinte TLS** — un `curl`/`fetch` Node est refusé (403) même avec les bons cookies.
   Il faut l'empreinte de Chrome → `curl_cffi` (`impersonate="chrome"`).
2. **Challenge Akamai** — la première requête renvoie `{"cpr_chlge":"true"}` (429).
   Un vrai Chrome piloté en CDP charge la page de réservation, le script d'Akamai résout
   son propre challenge, et on récupère les cookies (`bm_sv`, `_abck`) + le JWT anonyme
   déposé dans le cookie `cmd-cgp-authtoken` (valable 2 h). Chrome n'est lancé que pour ça.
   En headless il faut masquer l'UA `HeadlessChrome` (sinon 403 immédiat).
3. **Réputation IP** — les IP de datacenter sont refusées sur `/api/*` (testé : la VM
   Hetzner reçoit 403 en IPv4 **et** IPv6, alors que la même requête passe depuis une
   connexion résidentielle). **Le scraper de places doit donc tourner depuis une machine
   résidentielle** — aujourd'hui le Mac. Le reste (découverte des séances, site) tourne
   comme avant sur la VM et Netlify.

Akamai coupe la session toutes ~100 requêtes : le script relance alors un bootstrap
Chrome et reprend.

## Architecture

```
VM (cron 8h)     → /api/pathe/discover   → table pathe_sessions   (ids de séances)
Mac (toutes 30m) → scripts/pathe-seats.py → table pathe_seats     (places libres + plan)
Netlify          → /api/movies, /api/seats → lecture DB seulement
```

Le site ne fait donc jamais d'appel à Pathé : il lit les relevés, et affiche toujours
leur âge (« il y a 12 min »).

## Installation sur le Mac

```bash
python3 -m pip install curl_cffi playwright   # Chrome déjà installé suffit
./scripts/setup-pathe-seats-mac.sh            # agent launchd, toutes les 30 min
tail -f ~/logs/pathe-seats.log
./scripts/setup-pathe-seats-mac.sh --off      # désinstaller
```

Quand le Mac dort, rien ne tourne : les relevés vieillissent, l'âge affiché le dit.

## Lancer à la main

```bash
python3 scripts/pathe-seats.py                      # politique par défaut
python3 scripts/pathe-seats.py --session 3166/148694 # une séance précise
python3 scripts/pathe-seats.py --dry-run --limit 5   # sans écrire en base
PATHE_HEADLESS=0 python3 scripts/pathe-seats.py     # Chrome visible (debug)
```

Politique de rafraîchissement (par défaut, ~120 séances par run) :

| Séance dans | Rafraîchie si le relevé a plus de |
|---|---|
| moins de 4 h | 25 min |
| moins de 48 h | 8 h |

Soit environ 240 requêtes/heure vers Pathé, une par une avec ~1,2 s d'écart.

## Appariement AlloCiné ↔ Pathé

Nos séances viennent d'AlloCiné, les places de Pathé : le rapprochement se fait sur
(cinéma, horaire exact), puis sur le titre quand plusieurs films commencent à la même
minute dans le même multiplexe (`src/lib/pathe-seats.ts`). Les titres ne correspondent
pas toujours mot pour mot (« The Mask » ↔ `la-seance-cine-hits-the-mask`), d'où un
rapprochement par inclusion / mots. Si le doute persiste, aucune place n'est affichée —
mieux vaut rien qu'un chiffre venant d'une autre salle.

## Dépannage

| Symptôme | Piste |
|---|---|
| `403` en boucle | IP non résidentielle, ou profil Chrome avec un 403 en cache (le script le supprime à chaque bootstrap) |
| `booking page did not hand out a JWT` | challenge non résolu : essayer `PATHE_HEADLESS=0` |
| `no Chrome/Chromium binary found` | `export PATHE_CHROME_PATH=/chemin/vers/chrome` |
| aucune place affichée sur le site | `pathe_sessions` vide → relancer `/api/pathe/discover` |
