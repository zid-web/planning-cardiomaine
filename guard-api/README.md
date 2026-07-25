# Guard API Cardiomaine — package déployable (fix PDF JSON)

Sources fournies + correctif **JSON malformé** pour l’import PDF.

## Symptôme corrigé

`Réponse d'extraction invalide (JSON malformé) : Expecting value: line …`

Claude Vision tronquait le JSON (`max_tokens=4000`). Ce package :

- ajoute `llm_json.py` (réparation / fermeture JSON tronqué)
- passe `max_tokens` à **16000** + retry / repair Claude
- accepte les PDF avec MIME `octet-stream`

## Fichiers à pousser sur `zid-web/guard-api-cardiomaine`

| Fichier | Action |
|---------|--------|
| `llm_json.py` | **nouveau** |
| `test_llm_json.py` | **nouveau** (optionnel en prod) |
| `pdf_upload.py` | remplacer |
| `pdf_vision_parser.py` | remplacer |
| `voice_command.py` | remplacer |
| `main.py` | remplacer |
| `solver.py` | remplacer (version fournie) |
| `requirements.txt` | remplacer |
| `Dockerfile` | remplacer |

Référence front (ne pas déployer tel quel sur Render) : `VoiceAndUploadPanel.jsx`  
Patch git : `../patches/fix-pdf-json-extraction.patch`

## Déployer

```bash
cd /path/to/guard-api-cardiomaine
cp /path/to/planning-cardiomaine/guard-api/{llm_json.py,test_llm_json.py,pdf_upload.py,pdf_vision_parser.py,voice_command.py,main.py,solver.py,requirements.txt,Dockerfile} .
python3 -m unittest test_llm_json.py -v
git add -A && git commit -m "fix(pdf): robust LLM JSON parsing for planning extraction"
git push origin main   # ou PR → Render redéploie
```

## Tests locaux

```bash
cd guard-api && python3 -m unittest test_llm_json.py -v
```
