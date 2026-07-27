# `guard-api/` — résidu, ne pas utiliser

Le **vrai backend Render** est le dépôt séparé :

**https://github.com/zid-web/guard-api-cardiomaine**  
Service : `https://guard-api-cardiomaine.onrender.com`

Ce dossier dans `planning-cardiomaine` n’est **pas** déployé. Toute modification du solveur, de `rules_config.json`, PDF/voice, etc. doit se faire **uniquement** dans `guard-api-cardiomaine`.

Ne pas y recopier de miroir `solver.py` / patches : source de confusion (déjà arrivé). Le front appelle Render via `GUARD_API_BASE_URL` / `GUARD_API_URL`.
