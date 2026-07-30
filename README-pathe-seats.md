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
3. **Réputation IP** — les IP de datacenter sont refusées sur `/api/*` : l'IP propre de
   la VM reçoit 403 en IPv4 **et** IPv6. Contournement : **Cloudflare WARP en mode
   proxy** (`warp-cli mode proxy`, SOCKS5 sur `127.0.0.1:40000`). Son egress est partagé
   avec du trafic grand public, donc Akamai renvoie son challenge normal au lieu du 403.
   Le mode proxy ne change pas le routage par défaut de la VM : seul le scraper l'emprunte
   (`PATHE_PROXY=socks5://127.0.0.1:40000`, utilisé à la fois par Chrome et par curl_cffi —
   les cookies Akamai sont liés à l'IP, les deux doivent sortir par le même chemin).

Akamai coupe la session toutes ~100 requêtes : le script relance alors un bootstrap
Chrome et reprend.

## Architecture

```
VM (cron 8h)      → /api/pathe/discover           → pathe_sessions      (ids de séances)
VM (cron 15 min)  → pathe-seats-vm.sh             → pathe_seats         (places + plan)
VM (cron 1 min)   → pathe-seats-vm.sh --queue     → traite pathe_refresh_queue
Netlify           → /api/movies, /api/seats       → lecture DB seulement
                  → /api/seats/refresh            → écrit dans la file
```

Le site ne fait jamais d'appel à Pathé : il lit les relevés, affiche toujours leur âge
(« il y a 12 min »), et le bouton ↻ du plan de salle passe par la file d'attente.

## Installation sur la VM

```bash
./scripts/setup-pathe-seats-vm.sh    # WARP + venv + Chromium + les deux crons
ssh vm 'tail -f ~/logs/pathe-seats.log'
ssh vm '~/cinepass/scripts/pathe-seats-vm.sh --limit 5'   # test manuel
```

Le wrapper vérifie WARP avant chaque run (et tente `warp-cli connect` si besoin), et
un `flock` empêche le run d'une minute et le balayage de 15 min de se chevaucher.

## Repli : le Mac

Si WARP se fait bloquer un jour, le même scraper tourne depuis une connexion
résidentielle, sans proxy :

```bash
python3 -m pip install curl_cffi playwright
./scripts/setup-pathe-seats-mac.sh        # agent launchd toutes les 30 min
./scripts/setup-pathe-seats-mac.sh --off  # désinstaller
```

Dans ce mode, rien ne tourne quand le Mac dort — les relevés vieillissent et l'âge
affiché le dit.

## Lancer à la main

```bash
python3 scripts/pathe-seats.py                       # politique par défaut
python3 scripts/pathe-seats.py --session 3166/148694 # une séance précise
python3 scripts/pathe-seats.py --queue               # seulement les demandes du site
python3 scripts/pathe-seats.py --dry-run --limit 5   # sans écrire en base
PATHE_HEADLESS=0 python3 scripts/pathe-seats.py      # Chrome visible (debug)
PATHE_PROXY=socks5://127.0.0.1:40000 python3 scripts/pathe-seats.py   # via WARP
```

Politique de rafraîchissement (par défaut, 70 séances par run) :

| Séance dans | Rafraîchie si le relevé a plus de |
|---|---|
| moins de 4 h | 25 min |
| moins de 48 h | 8 h |

Soit environ 280 requêtes/heure vers Pathé (balayage toutes les 15 min), une par une
avec ~1,2 s d'écart.
La limite de 70 reste sous le budget d'une session Akamai (~100 appels) : le script
compte les appels déjà consommés par la session mise en cache et en redemande une
avant de se faire couper.

Quelques séances (spectacles sans placement numéroté) renvoient un 500 côté Pathé :
elles sont marquées en base (`layout` NULL) et ignorées à l'affichage.

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
| `403` en boucle | WARP déconnecté (`ssh vm 'warp-cli status'`), ou profil Chrome avec un 403 en cache (le script le supprime à chaque bootstrap) |
| le bouton ↻ ne rend rien | le cron d'une minute ne tourne pas : `ssh vm 'crontab -l | grep queue'` |
| `booking page did not hand out a JWT` | challenge non résolu : essayer `PATHE_HEADLESS=0` |
| `no Chrome/Chromium binary found` | `export PATHE_CHROME_PATH=/chemin/vers/chrome` |
| aucune place affichée sur le site | `pathe_sessions` vide → relancer `/api/pathe/discover` |
| `pathe_sessions` ne se remplit pas via le cron | un ancien `next-server` peut squatter le port 3000 de la VM ; `cinepass-scrape.sh` le tue maintenant et refuse de tourner contre un build périmé |
