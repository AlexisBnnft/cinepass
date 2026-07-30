# Places disponibles (Pathé)

Sur les séances Pathé, CinePass affiche le nombre de places libres, le plan de salle
(quelles places sont prises) et un bouton ↻ qui relit les places en direct. Les données
viennent du tunnel de réservation Pathé.

---

## 1. Ce qu'on récupère, et où

| Source | Protection | Donne |
|---|---|---|
| `www.pathe.fr/api/cinemas` | aucune | slug + `vistaRef` de chaque cinéma |
| `www.pathe.fr/api/cinema/{slug}/shows` | aucune | films à l'affiche, par date |
| `www.pathe.fr/api/show/{film}/showtimes/{cinema}` | aucune | séances + `refCmd` = `V{vistaRef}S{sessionId}` |
| `s.pathe.fr/api/seatmap/fr-FR/{vistaRef}/{sessionId}/map` | Akamai Bot Manager | plan de salle **avec l'occupation en direct** |

Dans le plan de salle, `status` vaut `1` pour une place prise et `0` pour une place
libre, et `seatIndex` est la colonne (allées comprises). Un seul appel par séance suffit
donc : comptage **et** positions. Le `/seating` de la même API ne donne que les
compteurs — inutile ici.

`vistaRef` est l'identifiant du cinéma dans Vista, la billetterie de Pathé (Beaugrenelle
= `3166`) : il ne change pas. Les `sessionId`, si — d'où la découverte quotidienne.

---

## 2. Les trois obstacles côté `s.pathe.fr`

Tout tient à ces trois points : c'est là qu'il faudra revenir si ça casse un jour.

**1. Empreinte TLS.** Un `curl` ou un `fetch` Node reçoit `403` même avec des cookies
valides : Akamai reconnaît l'empreinte TLS/HTTP2 du client. Il faut celle de Chrome →
`curl_cffi` avec `impersonate="chrome"`. **Conséquence :** le site (Node) ne peut jamais
appeler Pathé lui-même, d'où le passage systématique par le script Python.

**2. Challenge Akamai.** La première requête renvoie `429` avec `{"cpr_chlge":"true"}`,
un challenge cryptographique. On ne le résout pas nous-mêmes : un vrai Chrome piloté en
CDP charge la page de réservation, le script d'Akamai fait son travail, et on récupère
les cookies (`bm_sv`, `_abck`) plus le JWT anonyme déposé dans le cookie
`cmd-cgp-authtoken` (valable 2 h). Chrome ne sert qu'à ça, 5 à 30 s, puis tout le reste
passe en HTTP simple. En headless il faut masquer l'UA `HeadlessChrome`, sinon c'est
`403` immédiat — d'où l'override de l'UA *et* des client hints
(`Network.setUserAgentOverride`).

**3. Réputation IP.** Les IP de datacenter sont refusées sur `/api/*` : l'IP propre de
la VM reçoit `403` en IPv4 **comme** en IPv6, alors que la même requête depuis une
connexion résidentielle reçoit le challenge normal. Contournement en place :
**Cloudflare WARP en mode proxy** (SOCKS5 sur `127.0.0.1:40000`), dont la sortie est
partagée avec du trafic grand public. Le mode proxy ne touche pas au routage par défaut
de la VM : seul le scraper l'emprunte, via `PATHE_PROXY` — utilisé à la fois par Chrome
et par curl_cffi, car les cookies Akamai sont liés à l'IP de sortie et les deux doivent
passer par le même chemin.

Akamai coupe par ailleurs la session toutes les ~100 requêtes. Le script compte ses
appels, garde le total dans son fichier de credentials, et redemande une session avant
de se faire couper.

---

## 3. Architecture

Tout tourne sur la VM, derrière nginx :

```
cinepass.service :3210        le site (Next.js) → https://cinepass.bonnaf.com
warp-svc (mode proxy) :40000  la sortie réseau que Pathé accepte

cron  0 8 * * *    → cinepass-scrape.sh          → AlloCiné, puis /api/pathe/discover
                                                   → table pathe_sessions
cron  */15 * * * * → pathe-seats-vm.sh           → relevés → table pathe_seats
cron  * * * * *    → pathe-seats-vm.sh --queue   → repli du bouton ↻

site  /api/movies, /api/seats  → lecture DB
site  /api/seats/refresh       → lance le scraper en direct (~1,5 s)
```

Le site et le scraper sont volontairement sur la même machine : c'est ce qui permet au
bouton ↻ d'appeler `/api/seats/refresh`, qui exécute
`pathe-seats.py --session {vista}/{id}` et renvoie le relevé frais en ~1,5 s
(`PATHE_LOCAL_SCRAPER=1` dans le `.env.local` de la VM, qui n'est pas synchronisé depuis
le Mac). Si le site était hébergé ailleurs, la route se contenterait d'écrire dans
`pathe_refresh_queue` et le cron d'une minute traiterait la demande en ~60 s, le panneau
attendant le nouveau relevé — ce chemin reste en place comme repli.

### Tables

| Table | Contenu |
|---|---|
| `pathe_sessions` | une ligne par séance Pathé : `vista_ref`, `session_id`, cinéma, horaire, titre normalisé, salle |
| `pathe_seats` | dernier relevé par séance : `seats_free`, `seats_total`, `layout`, `fetched_at` (avec le décalage de Paris) |
| `pathe_refresh_queue` | demandes du bouton ↻ en attente (chemin de repli) |

Le `layout` fait ~400 octets : une ligne par rang, un caractère par colonne — minuscule
= libre, majuscule = occupé, `.` = pas de siège, la lettre donnant le type (`s` standard,
`u` duo, `p` PMR…). Une ligne avec `layout` NULL veut dire « essayé, pas de plan
disponible » : quelques spectacles sans placement numéroté renvoient `500` chez Pathé,
et ces lignes sont ignorées partout à l'affichage.

---

## 4. Exploitation

```bash
# déployer le site (depuis le Mac)
./scripts/deploy-vm.sh                 # sync + build + restart
./scripts/deploy-vm.sh --setup         # + systemd, nginx, .env.local serveur

# (ré)installer le scraper sur la VM : WARP, venv, Chromium, les deux crons
./scripts/setup-pathe-seats-vm.sh

# surveiller
ssh vm 'journalctl -u cinepass -f'          # le site
ssh vm 'tail -f ~/logs/pathe-seats.log'     # les relevés
ssh vm 'tail -f ~/logs/cinepass-scrape.log' # le scrape quotidien
ssh vm 'warp-cli status'                    # la sortie réseau

# relevés à la main
ssh vm '~/cinepass/scripts/pathe-seats-vm.sh --limit 5'
ssh vm '~/cinepass/scripts/pathe-seats-vm.sh --session 3166/148694'
```

Le wrapper `pathe-seats-vm.sh` vérifie WARP avant chaque run (et tente
`warp-cli connect` si besoin), et un `flock` empêche le run d'une minute et le balayage
de 15 min de se chevaucher. Les crons pointent directement sur les scripts du repo
synchronisé — pas de copie dans `~`, qui avait fini par être périmée.

### Options du scraper

```bash
python3 scripts/pathe-seats.py                        # politique par défaut
python3 scripts/pathe-seats.py --session 3166/148694   # une séance précise
python3 scripts/pathe-seats.py --queue                 # seulement les demandes du site
python3 scripts/pathe-seats.py --dry-run --limit 5     # sans écrire en base
PATHE_HEADLESS=0 python3 scripts/pathe-seats.py        # Chrome visible (debug)
PATHE_PROXY=socks5://127.0.0.1:40000 python3 ...       # via WARP (mis par le wrapper)
```

### Politique de rafraîchissement

70 séances par run, balayage toutes les 15 min :

| Séance dans | Rafraîchie si le relevé a plus de |
|---|---|
| moins de 4 h | 25 min |
| moins de 48 h | 8 h |

Soit ~280 requêtes/heure vers Pathé, une par une avec ~1,2 s d'écart. En pratique une
séance est fraîche à moins de 30 min dans les ~2 h qui la précèdent, plus approximative
au-delà — et le bouton ↻ donne toujours l'instantané exact. L'âge du relevé est affiché
en permanence dans le panneau.

La limite de 70 reste sous le budget d'une session Akamai (~100 appels). Le bouton ↻ est
protégé côté serveur : pas de nouveau relevé si le précédent a moins de 45 s, file
plafonnée à 40 demandes, 2 scrapers simultanés au maximum.

---

## 5. Appariement AlloCiné ↔ Pathé

Nos séances viennent d'AlloCiné, les places de Pathé. Le rapprochement
(`src/lib/pathe-seats.ts`) se fait sur (cinéma, horaire exact), puis sur le titre quand
plusieurs films commencent à la même minute dans le même multiplexe — fréquent. Les
titres ne correspondent pas mot pour mot :

| AlloCiné | Pathé | rattrapé par |
|---|---|---|
| `L'Odyssée` | `l-odyssee-43836` | égalité après normalisation |
| `The Mask` | `la-seance-cine-hits-the-mask-52964` | inclusion |
| `La Bataille de Gaulle : L'âge de fer` | `la-bataille-de-gaulle-partie-1-l-age-de-fer-50854` | tous nos mots présents |

Si le doute persiste, **aucune place n'est affichée** : mieux vaut rien qu'un chiffre
venant d'une autre salle. Sur une journée type, ~4 % des séances tombent dans ce cas.

Les cinémas Pathé sont listés dans `CINEMA_SLUGS` (`src/lib/scraper/pathe.ts`), qui fait
le lien `allocine_code` → slug pathe.fr : un nouveau cinéma se rajoute là.

---

## 6. Dépannage

| Symptôme | Piste |
|---|---|
| `403` en boucle dans `pathe-seats.log` | WARP déconnecté (`ssh vm 'warp-cli status'`), ou WARP lui-même blacklisté → replis ci-dessous |
| `booking page did not hand out a JWT` | challenge non résolu ; réessayer, sinon `PATHE_HEADLESS=0` pour voir la page |
| `429` répétés | trop de requêtes : baisser `--limit`, augmenter `--min-delay` |
| `500` sur quelques séances | normal : spectacles sans placement numéroté, marqués `layout` NULL |
| le bouton ↻ met ~60 s | mode direct inactif : vérifier `PATHE_LOCAL_SCRAPER=1` dans le `.env.local` de la VM |
| aucune place affichée | `pathe_sessions` vide → relancer `/api/pathe/discover` (inclus dans `cinepass-scrape.sh`) |
| `no Chrome/Chromium binary found` | `export PATHE_CHROME_PATH=/chemin/vers/chrome` |
| le scrape quotidien semble ignorer du code neuf | il refuse maintenant de tourner contre un build périmé (404 sur `/api/pathe/discover`) et le signale dans son log |

### Replis si WARP tombe

1. **Un autre proxy** : `PATHE_PROXY=socks5://…` (ou `http://…`) dans
   `pathe-seats-vm.sh`. N'importe quel proxy résidentiel fait l'affaire.
2. **Le Mac**, sur sa connexion résidentielle, sans proxy :
   ```bash
   python3 -m pip install curl_cffi playwright
   ./scripts/setup-pathe-seats-mac.sh        # agent launchd, toutes les 30 min
   ./scripts/setup-pathe-seats-mac.sh --off  # désinstaller
   ```
   Rien ne tourne quand le Mac dort : les relevés vieillissent et l'âge affiché le dit.
   Le script est copié dans `~/Library/Application Support/cinepass`, parce que macOS
   interdit aux agents launchd de lire `~/Documents`.
